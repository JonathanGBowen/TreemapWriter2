import { describe, expect, it } from 'vitest';
import { RequestThrottle, type ThrottleClock } from '../request-throttle';

/** A deterministic clock whose sleep advances virtual time and records the wait. */
function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  const clock: ThrottleClock = {
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
  };
  return { clock, sleeps };
}

describe('RequestThrottle', () => {
  it('allows a burst up to the per-minute capacity without waiting', async () => {
    const { clock, sleeps } = fakeClock();
    const throttle = new RequestThrottle(clock);
    for (let i = 0; i < 5; i++) await throttle.acquire('gemini:flash', 5);
    expect(sleeps).toHaveLength(0);
  });

  it('spaces the next call once the bucket is drained', async () => {
    const { clock, sleeps } = fakeClock();
    const throttle = new RequestThrottle(clock);
    for (let i = 0; i < 5; i++) await throttle.acquire('gemini:flash', 5);
    await throttle.acquire('gemini:flash', 5);
    // 5/min ⇒ one token accrues every 12s; an empty bucket waits ~12s.
    expect(sleeps).toEqual([12_000]);
  });

  it('treats a falsy rpm as unlimited (never waits)', async () => {
    const { clock, sleeps } = fakeClock();
    const throttle = new RequestThrottle(clock);
    for (let i = 0; i < 100; i++) await throttle.acquire('gemini:x', undefined);
    expect(sleeps).toHaveLength(0);
  });

  it('keys buckets independently per model', async () => {
    const { clock, sleeps } = fakeClock();
    const throttle = new RequestThrottle(clock);
    for (let i = 0; i < 5; i++) await throttle.acquire('a', 5);
    for (let i = 0; i < 5; i++) await throttle.acquire('b', 5);
    expect(sleeps).toHaveLength(0);
  });

  it('signals onWaiting true then false around a wait', async () => {
    const { clock } = fakeClock();
    const events: boolean[] = [];
    const throttle = new RequestThrottle(clock, (w) => events.push(w));
    for (let i = 0; i < 5; i++) await throttle.acquire('k', 5);
    await throttle.acquire('k', 5);
    expect(events).toEqual([true, false]);
  });
});
