// Proactive per-model request throttle — a pure leaf (no store / client imports).
//
// Gemini's free tier enforces a per-MINUTE request quota (5/min for flash, 15/min
// for flash-lite & gemma). A burst flow — e.g. generating specs for every level —
// can trip it even though no daily quota is exhausted. Reacting after the 429 is
// fine (the dispatch layer falls down the ladder), but it's better not to trip it
// at all. This token bucket spaces outgoing calls to stay within budget: a burst
// up to the per-minute count is instant, and only beyond that does a call wait.
//
// Limits come from the catalog's `requestsPerMinute` (the single source of truth),
// so the dispatch layer passes the number in — this module stays provider-neutral.

/** Injectable so tests can drive time deterministically. */
export interface ThrottleClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: ThrottleClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

interface Bucket {
  /** Fractional tokens available; refills continuously up to `capacity`. */
  tokens: number;
  /** Timestamp (ms) the bucket was last refilled. */
  last: number;
}

export class RequestThrottle {
  private readonly buckets = new Map<string, Bucket>();
  /** Per-key promise chain so concurrent acquires for one model don't race the bucket. */
  private readonly chains = new Map<string, Promise<void>>();
  private waiting = 0;

  constructor(
    private readonly clock: ThrottleClock = realClock,
    /** Notified true when at least one call is waiting on the throttle, false when none are. */
    private readonly onWaiting?: (waiting: boolean) => void,
  ) {}

  /**
   * Resolve once a call to `key` fits within `rpm` requests/min, delaying if the
   * bucket is empty. `rpm` falsy / non-positive ⇒ unlimited (resolves immediately).
   * Acquires for the same key are serialized so the bucket math is race-free; the
   * actual provider call still runs concurrently (we release before returning).
   */
  async acquire(key: string, rpm: number | undefined): Promise<void> {
    if (!rpm || rpm <= 0) return;
    const prev = this.chains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => {
      release = r;
    });
    // Next acquire for this key waits for mine; swallow rejection so the chain never breaks.
    this.chains.set(
      key,
      prev.then(() => mine).catch(() => undefined),
    );
    await prev.catch(() => undefined);
    try {
      await this.consume(key, rpm);
    } finally {
      release();
    }
  }

  private async consume(key: string, rpm: number): Promise<void> {
    const capacity = rpm;
    const refillPerMs = rpm / 60_000;
    const now = this.clock.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: capacity, last: now };
      this.buckets.set(key, b);
    }
    b.tokens = Math.min(capacity, b.tokens + (now - b.last) * refillPerMs);
    b.last = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return;
    }
    // Not enough budget — wait for exactly one token to accrue, then consume it.
    const waitMs = Math.ceil((1 - b.tokens) / refillPerMs);
    this.enterWait();
    try {
      await this.clock.sleep(waitMs);
    } finally {
      this.exitWait();
    }
    const after = this.clock.now();
    b.tokens = Math.min(capacity, b.tokens + (after - b.last) * refillPerMs) - 1;
    b.last = after;
  }

  private enterWait(): void {
    this.waiting += 1;
    if (this.waiting === 1) this.onWaiting?.(true);
  }

  private exitWait(): void {
    this.waiting = Math.max(0, this.waiting - 1);
    if (this.waiting === 0) this.onWaiting?.(false);
  }
}
