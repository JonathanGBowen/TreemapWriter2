// Quota-aware model fallback — the pure core.
//
// When a model hits a transient or quota error, the app should retry on
// progressively smaller models instead of failing the call. This module owns the
// provider-agnostic pieces of that policy: classifying an error, computing when a
// daily quota resets, remembering which models are on cooldown, and building the
// ordered candidate list for a call. It deliberately imports NOTHING from the
// store, preferences, or any client — it is a leaf, like resolve-model-choice.ts,
// so it stays trivially testable and reusable. The dispatch wrapper that drives
// it lives in ai-provider.impl.ts; persistence is owned by the registry.

import type { ModelChoice, ProviderId, QuotaAnnotatedError } from './model-types';

// --- Error classification -------------------------------------------------

/**
 * The only place that knows provider error wording. Everything downstream reasons
 * over this small enum, which keeps the rest of the app provider-neutral.
 *  - 'daily-quota'  a per-DAY limit was hit → long cooldown until the daily reset.
 *  - 'rate-limit'   a per-minute / ambiguous 429 → short backoff, NO long cooldown.
 *  - 'overloaded'   the service is busy/unavailable (503, "high volume") → backoff.
 *  - 'other'        a real error (bad request, auth, parse, network) → don't mask.
 */
export type AIErrorClass = 'daily-quota' | 'rate-limit' | 'overloaded' | 'other';

/** Gather a searchable string from an unknown error without assuming a shape. */
function errorText(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof e.message === 'string') parts.push(e.message);
  if (typeof e.status === 'string') parts.push(e.status);
  if (e.error != null) {
    try {
      parts.push(typeof e.error === 'string' ? e.error : JSON.stringify(e.error));
    } catch {
      /* ignore non-serializable nested error */
    }
  }
  if (parts.length === 0) {
    try {
      parts.push(JSON.stringify(e));
    } catch {
      parts.push(String(err));
    }
  }
  return parts.join(' ');
}

/** Pull an HTTP-ish status code from the common SDK shapes, or from the message. */
function errorStatus(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const nested = (e.error as Record<string, unknown>) ?? {};
    const response = (e.response as Record<string, unknown>) ?? {};
    for (const v of [e.status, e.code, nested.code, nested.status, response.status]) {
      if (typeof v === 'number' && v >= 100 && v < 600) return v;
    }
  }
  const m = /\b(4\d\d|5\d\d)\b/.exec(errorText(err));
  return m ? Number(m[1]) : null;
}

export function classifyAIError(err: unknown): AIErrorClass {
  const status = errorStatus(err);
  const text = errorText(err).toLowerCase();
  // A provider client may have parsed the structured error and attached a
  // definitive minute-vs-day scope. When present it is authoritative.
  const scope = (err as QuotaAnnotatedError | null | undefined)?.__quotaScope;

  const resourceExhausted =
    status === 429 || /resource_exhausted|too many requests|rate.?limit|quota/.test(text);
  const daySignal = /per\s*-?\s*day|perday|\bdaily\b|requests? per day|quota.*\bday\b|\bday\b.*quota/.test(
    text,
  );

  // Daily quota: prefer the structured scope; otherwise fall back to a per-day
  // signal in the message. A structured 'per-minute' scope deliberately SKIPS the
  // text heuristic, so a spurious "day" substring can never upgrade a per-minute
  // burst into a multi-hour daily cooldown (the bug this guards against).
  if (resourceExhausted) {
    if (scope === 'per-day') return 'daily-quota';
    if (scope === undefined && daySignal) return 'daily-quota';
  }

  // Transient unavailability. The user's "high volume of requests / not available"
  // lands here, distinct from a daily quota (req: must NOT trigger the long cooldown).
  if (
    status === 503 ||
    /unavailable|overloaded|high volume|not available|temporarily|try again later|please retry|server error|internal error/.test(
      text,
    )
  ) {
    return 'overloaded';
  }

  // Any remaining resource-exhausted is a per-minute / ambiguous rate limit:
  // short backoff only, so a transient burst can never cause a multi-hour cooldown.
  if (resourceExhausted) return 'rate-limit';

  return 'other';
}

/**
 * True for the INVALID_ARGUMENT failures a model raises when it doesn't accept the
 * thinking field we sent (the conventions differ across Gemini families). The
 * client uses this to retry once with the thinking field stripped, so a mis-seeded
 * catalog convention degrades instead of hard-failing.
 */
export function isThinkingConfigError(err: unknown): boolean {
  const text = errorText(err).toLowerCase();
  const status = errorStatus(err);
  const badArg = status === 400 || /invalid_argument|invalid argument/.test(text);
  return badArg && /thinking|thinking_?budget|thinking_?level|thinkingconfig/.test(text);
}

// --- Daily reset clock ----------------------------------------------------

/** Gemini free-tier daily quotas reset at 03:00 America/New_York. */
export const DAILY_RESET_HOUR = 3;
export const DAILY_RESET_TZ = 'America/New_York';

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock parts of `date` in the reset timezone. */
function tzParts(date: Date): DateParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_RESET_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Partial<DateParts> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type === 'literal') continue;
    (p as Record<string, number>)[part.type] = Number(part.value);
  }
  if (p.hour === 24) p.hour = 0; // some engines emit '24' at midnight
  return p as DateParts;
}

/** Offset (ms) of the reset timezone from UTC at the given instant (handles DST). */
function tzOffsetMs(date: Date): number {
  const p = tzParts(date);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - date.getTime();
}

/**
 * The next 03:00 ET (as an absolute UTC epoch ms) at or after `now`. DST-safe via
 * a two-pass offset correction; 03:00 is deliberately clear of both DST shift
 * windows (the spring gap is 02:00→03:00, the fall overlap is 01:00–02:00).
 */
export function nextResetUtc(now: Date): number {
  const p = tzParts(now);
  let { year, month, day } = p;
  if (p.hour >= DAILY_RESET_HOUR) {
    // Advance one ET calendar day.
    const next = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000);
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  // Target ET wall-clock = year-month-day 03:00:00. Solve T such that the ET
  // wall-clock of T is that target: T = W - offset(T), iterated twice so a
  // DST-transition day still resolves to the correct instant.
  const wallAsUtc = Date.UTC(year, month - 1, day, DAILY_RESET_HOUR, 0, 0);
  let t = wallAsUtc - tzOffsetMs(new Date(wallAsUtc));
  t = wallAsUtc - tzOffsetMs(new Date(t));
  return t;
}

/** Short ET time label for the cooldown readout, e.g. "3:00 AM ET". */
export function formatResetEt(resetUtc: number): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_RESET_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${fmt.format(new Date(resetUtc))} ET`;
}

// --- Cooldown registry ----------------------------------------------------

export interface CooldownEntry {
  provider: ProviderId;
  model: string;
  /** Absolute UTC epoch ms at which the model becomes callable again. */
  resetUtc: number;
}

export type CooldownSnapshot = CooldownEntry[];

const cooldownKey = (provider: ProviderId, model: string): string => `${provider}:${model}`;

/**
 * App-wide memory of which models are quota-exhausted and until when. Absolute
 * reset timestamps survive reload, sleep, and clock changes. The registry owns
 * persistence and wires the sink; this class holds no store/prefs dependency.
 */
export class ModelCooldowns {
  private readonly map = new Map<string, CooldownEntry>();
  private sink: ((snapshot: CooldownSnapshot) => void) | null = null;

  /** Register a listener notified (with a fresh snapshot) on every change. */
  setSink(sink: ((snapshot: CooldownSnapshot) => void) | null): void {
    this.sink = sink;
  }

  /** Pure read: is this model currently on a daily-quota cooldown? */
  isActive(provider: ProviderId, model: string, now: number): boolean {
    const entry = this.map.get(cooldownKey(provider, model));
    return entry != null && now < entry.resetUtc;
  }

  /** Mark a model as out until the next daily reset after `now`. */
  markDailyQuota(provider: ProviderId, model: string, now: number): void {
    this.map.set(cooldownKey(provider, model), {
      provider,
      model,
      resetUtc: nextResetUtc(new Date(now)),
    });
    this.prune(now);
    this.emit();
  }

  /** Manually lift a cooldown (the UI's "Clear" affordance). */
  clear(provider: ProviderId, model: string): void {
    if (this.map.delete(cooldownKey(provider, model))) this.emit();
  }

  /** Drop entries whose reset time has passed. */
  prune(now: number): void {
    let changed = false;
    for (const [key, entry] of this.map) {
      if (now >= entry.resetUtc) {
        this.map.delete(key);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  /** Current entries, sorted by soonest reset. */
  snapshot(): CooldownSnapshot {
    return [...this.map.values()].sort((a, b) => a.resetUtc - b.resetUtc);
  }

  /** Rehydrate from persistence (e.g. at boot). Does not notify the sink. */
  load(snapshot: CooldownSnapshot | null | undefined): void {
    this.map.clear();
    if (!Array.isArray(snapshot)) return;
    for (const e of snapshot) {
      if (e && typeof e.model === 'string' && typeof e.resetUtc === 'number') {
        this.map.set(cooldownKey(e.provider, e.model), {
          provider: e.provider,
          model: e.model,
          resetUtc: e.resetUtc,
        });
      }
    }
  }

  private emit(): void {
    this.sink?.(this.snapshot());
  }
}

// --- Fallback settings + candidate ladder ---------------------------------

export interface FallbackSettings {
  /** Master switch. When off, a call runs only its configured model. */
  enabled: boolean;
  /**
   * Ordered models to try, strongest → weakest. Provider-tagged so the ladder can
   * mix providers; the default is the Gemini/Gemma family in descending capability.
   */
  ladder: ModelChoice[];
}

// DEFAULT_FALLBACK_LADDER / DEFAULT_FALLBACK_SETTINGS now live in `model-defaults.ts`,
// derived from the catalog's ordered Gemini list (the single source of truth). This
// file keeps the FallbackSettings *type* and the policy below — it imports nothing
// but model-types, so it stays a trivially testable leaf.

/**
 * The ordered candidates for a call: the configured start choice, then every
 * ladder rung BELOW it (progressively smaller). When the start model isn't in the
 * ladder (e.g. a deliberate per-call override, or a non-ladder provider) the call
 * runs only that model — an explicit pin is not a fallback root.
 */
export function buildCandidates(start: ModelChoice, ladder: ModelChoice[]): ModelChoice[] {
  const idx = ladder.findIndex((m) => m.provider === start.provider && m.model === start.model);
  if (idx < 0) return [start];
  const seen = new Set<string>();
  const out: ModelChoice[] = [];
  // `start` leads so its thinkingBudget intent is preserved; the ladder duplicate
  // at idx is deduped away.
  for (const c of [start, ...ladder.slice(idx)]) {
    const key = cooldownKey(c.provider, c.model);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

// --- Transient retry ------------------------------------------------------

export interface TransientRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  /** Injectable for tests (default: setTimeout). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests (default: Math.random). */
  random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Cap on how long a server-suggested retry delay is honored IN PLACE. Past this,
 * it's faster to fall to the next model's (separate) quota bucket than to wait —
 * which the dispatch layer does once this throws. The full delay is still surfaced
 * to the user for messaging.
 */
const MAX_HINTED_DELAY_MS = 8000;

/**
 * Run `fn`, retrying in place ONLY for transient classes (overloaded / per-minute
 * rate limit) with exponential backoff + jitter. Daily-quota and real errors throw
 * immediately so the caller can mark a cooldown / surface the failure. When the
 * error carries a server retry hint (`__retryDelayMs`), the wait is at least that
 * long (capped), so a short per-minute window is respected before retrying.
 */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  opts: TransientRetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 1500;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const cls = classifyAIError(err);
      const transient = cls === 'overloaded' || cls === 'rate-limit';
      if (!transient || attempt >= maxAttempts - 1) throw err;
      const backoff = base * 2 ** attempt * (0.5 + random());
      const hinted = (err as QuotaAnnotatedError).__retryDelayMs;
      const delay =
        typeof hinted === 'number' && hinted > 0
          ? Math.max(backoff, Math.min(hinted, MAX_HINTED_DELAY_MS))
          : backoff;
      await sleep(delay);
    }
  }
}

// --- Exhaustion ----------------------------------------------------------

/**
 *  - 'quota'       every candidate is on a per-DAY cooldown → wait until the reset.
 *  - 'rate-limit'  every candidate hit a per-MINUTE / transient limit → retry soon.
 *  - 'context'     no available model's window can hold the request.
 * The 'quota' vs 'rate-limit' split is what lets the UI tell the user whether to
 * wait hours or seconds (instead of always blaming the daily quota).
 */
export type ExhaustionReason = 'quota' | 'context' | 'rate-limit';

/** Thrown when no candidate could run the call. */
export class AllModelsExhaustedError extends Error {
  constructor(
    public readonly reason: ExhaustionReason,
    message: string,
    public readonly cause?: unknown,
    /** Server-suggested wait (ms) for the per-minute 'rate-limit' case, if known. */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AllModelsExhaustedError';
  }
}
