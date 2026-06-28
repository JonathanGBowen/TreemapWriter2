// Gemini structured-error parsing. Lives next to gemini-client.ts because, like
// the client, it is the ONE place that understands Gemini's error shape — it
// turns a raw @google/genai rejection into the provider-neutral hints defined in
// model-types (`__quotaScope`, `__retryDelayMs`) that the fallback policy reads.
//
// Why this matters: a per-MINUTE rate limit (wait seconds) and a per-DAY quota
// (wait until the 3 AM reset) are different situations the user must be able to
// tell apart. Gemini distinguishes them in the structured error body — a
// QuotaFailure naming a "...PerMinute..." or "...PerDay..." metric, and a
// RetryInfo with a retryDelay. Reading text alone (the old behavior) guesses; this
// reads the structure when present and only then falls back to text.

import type { QuotaScope, QuotaAnnotatedError } from '../model-types';

/** Collect every string we can reach inside an unknown error, defensively. */
function harvestText(err: unknown, depth = 0): string {
  if (err == null || depth > 4) return '';
  if (typeof err === 'string') return err;
  if (typeof err !== 'object') return String(err);
  const parts: string[] = [];
  try {
    // A whole-object stringify catches nested `details`/`violations`/`retryDelay`
    // regardless of the exact path the SDK used to surface them.
    parts.push(JSON.stringify(err));
  } catch {
    /* circular or non-serializable — fall through to field probing */
  }
  const e = err as Record<string, unknown>;
  for (const key of ['message', 'status', 'statusText']) {
    if (typeof e[key] === 'string') parts.push(e[key] as string);
  }
  // `message` is frequently itself a JSON string of the error body.
  if (typeof e.message === 'string') {
    try {
      parts.push(harvestText(JSON.parse(e.message), depth + 1));
    } catch {
      /* not JSON — already pushed as text above */
    }
  }
  return parts.join(' ');
}

/**
 * Per-minute vs per-day, parsed from the error if it names a quota metric/id.
 * Returns undefined when the error doesn't clearly say (the caller then keeps the
 * existing text heuristic). Per-minute is checked first because a metric id like
 * `GenerateRequestsPerMinutePerProjectPerModel` contains BOTH tokens — "minute"
 * is the binding one there.
 */
export function geminiQuotaScope(err: unknown): QuotaScope | undefined {
  const text = harvestText(err);
  if (!text) return undefined;
  if (/per[\s_-]*minute|perminute|requests?\s*per\s*min\b/i.test(text)) return 'per-minute';
  if (/per[\s_-]*day|perday|requests?\s*per\s*day|\bdaily\b/i.test(text)) return 'per-day';
  return undefined;
}

/** Server-suggested retry delay in ms, from a `retryDelay: "31s"` style field. */
export function geminiRetryDelayMs(err: unknown): number | undefined {
  const text = harvestText(err);
  // RetryInfo: "retryDelay":"31s" (also tolerate "retry after 31s" / "retry in 31.5s").
  const m =
    /retry[_\s-]*delay["':\s]*"?(\d+(?:\.\d+)?)\s*s/i.exec(text) ??
    /retry\s*(?:after|in)\s*(\d+(?:\.\d+)?)\s*s/i.exec(text);
  if (!m) return undefined;
  const seconds = Number(m[1]);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined;
}

/**
 * Attach provider-neutral quota hints to a Gemini error in place and return it, so
 * the fallback policy can classify it precisely. Never throws and never replaces
 * the error (preserving message/status/stack for the existing text heuristics and
 * for missing-key detection). A no-op when nothing useful was found or the error
 * isn't an extensible object.
 */
export function annotateGeminiError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  try {
    const scope = geminiQuotaScope(err);
    const retryDelayMs = geminiRetryDelayMs(err);
    if (scope === undefined && retryDelayMs === undefined) return err;
    const target = err as QuotaAnnotatedError;
    if (scope !== undefined) target.__quotaScope = scope;
    if (retryDelayMs !== undefined) target.__retryDelayMs = retryDelayMs;
  } catch {
    /* frozen/exotic error object — leave it untouched, text heuristic still applies */
  }
  return err;
}
