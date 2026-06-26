import { describe, expect, it, vi } from 'vitest';
import {
  AllModelsExhaustedError,
  buildCandidates,
  classifyAIError,
  DEFAULT_FALLBACK_LADDER,
  formatResetEt,
  isThinkingConfigError,
  ModelCooldowns,
  nextResetUtc,
  withTransientRetry,
} from '../model-fallback';
import type { ModelChoice } from '../model-types';

describe('classifyAIError', () => {
  it('classifies a per-day quota as daily-quota', () => {
    expect(
      classifyAIError({
        status: 429,
        message: 'Quota exceeded for metric GenerateRequestsPerDayPerProjectPerModel.',
      }),
    ).toBe('daily-quota');
    expect(
      classifyAIError({ message: 'RESOURCE_EXHAUSTED: requests per day limit reached' }),
    ).toBe('daily-quota');
  });

  it('classifies a generic / per-minute 429 as rate-limit (never daily)', () => {
    expect(classifyAIError({ status: 429, message: 'Resource has been exhausted (check quota).' })).toBe(
      'rate-limit',
    );
    expect(classifyAIError({ message: '429 Too Many Requests' })).toBe('rate-limit');
  });

  it('classifies overload / high-volume as overloaded (not daily)', () => {
    expect(classifyAIError({ status: 503, message: 'The model is overloaded. Try again later.' })).toBe(
      'overloaded',
    );
    expect(
      classifyAIError({
        message: 'The system is dealing with a high volume of requests and is not available at this time.',
      }),
    ).toBe('overloaded');
  });

  it('classifies real failures as other', () => {
    expect(classifyAIError({ status: 400, message: 'Invalid argument' })).toBe('other');
    expect(classifyAIError({ message: 'API key not valid' })).toBe('other');
    expect(classifyAIError(new Error('boom'))).toBe('other');
    expect(classifyAIError(null)).toBe('other');
  });

  it('reads a nested error.status shape', () => {
    expect(
      classifyAIError({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'per day' } }),
    ).toBe('daily-quota');
  });
});

describe('isThinkingConfigError', () => {
  it('detects an INVALID_ARGUMENT about a thinking field', () => {
    expect(
      isThinkingConfigError({ status: 400, message: 'Invalid argument: thinking_budget unsupported' }),
    ).toBe(true);
    expect(isThinkingConfigError({ message: 'INVALID_ARGUMENT: thinkingLevel not allowed' })).toBe(true);
  });
  it('ignores unrelated 400s and non-400s', () => {
    expect(isThinkingConfigError({ status: 400, message: 'bad request' })).toBe(false);
    expect(isThinkingConfigError({ status: 429, message: 'thinking' })).toBe(false);
  });
});

describe('nextResetUtc', () => {
  it('targets 3:00 AM ET and lands on 08:00 UTC in winter (EST)', () => {
    const reset = nextResetUtc(new Date('2025-01-15T12:00:00Z')); // 07:00 EST → next day
    expect(new Date(reset).toISOString()).toBe('2025-01-16T08:00:00.000Z');
    expect(formatResetEt(reset)).toMatch(/3:00\s*AM ET/);
  });

  it('lands on 07:00 UTC in summer (EDT) — one hour earlier than winter', () => {
    const reset = nextResetUtc(new Date('2025-07-15T12:00:00Z')); // 08:00 EDT → next day
    expect(new Date(reset).toISOString()).toBe('2025-07-16T07:00:00.000Z');
    expect(formatResetEt(reset)).toMatch(/3:00\s*AM ET/);
  });

  it('uses the same ET day when before 3 AM ET', () => {
    const reset = nextResetUtc(new Date('2025-01-15T06:00:00Z')); // 01:00 EST, before 3 AM
    expect(new Date(reset).toISOString()).toBe('2025-01-15T08:00:00.000Z');
  });

  it('resolves correctly on the spring-forward day (two-pass offset)', () => {
    const reset = nextResetUtc(new Date('2025-03-09T06:00:00Z')); // 01:00 EST, reset is 03:00 EDT
    expect(new Date(reset).toISOString()).toBe('2025-03-09T07:00:00.000Z');
  });
});

describe('ModelCooldowns', () => {
  const now = Date.parse('2025-01-15T12:00:00Z');

  it('marks, reports active, and lifts a cooldown', () => {
    const cd = new ModelCooldowns();
    expect(cd.isActive('gemini', 'm', now)).toBe(false);
    cd.markDailyQuota('gemini', 'm', now);
    expect(cd.isActive('gemini', 'm', now)).toBe(true);
    // Inactive once the reset time passes.
    const reset = cd.snapshot()[0].resetUtc;
    expect(cd.isActive('gemini', 'm', reset + 1)).toBe(false);
    cd.clear('gemini', 'm');
    expect(cd.snapshot()).toHaveLength(0);
  });

  it('prunes expired entries and notifies the sink on change', () => {
    const cd = new ModelCooldowns();
    const sink = vi.fn();
    cd.setSink(sink);
    cd.markDailyQuota('gemini', 'm', now);
    expect(sink).toHaveBeenCalledTimes(1);
    cd.prune(cd.snapshot()[0].resetUtc + 1);
    expect(cd.snapshot()).toHaveLength(0);
    expect(sink).toHaveBeenCalledTimes(2);
  });

  it('round-trips through snapshot/load without emitting', () => {
    const cd = new ModelCooldowns();
    cd.markDailyQuota('gemini', 'a', now);
    const snap = cd.snapshot();
    const cd2 = new ModelCooldowns();
    const sink = vi.fn();
    cd2.setSink(sink);
    cd2.load(snap);
    expect(cd2.isActive('gemini', 'a', now)).toBe(true);
    expect(sink).not.toHaveBeenCalled();
  });
});

describe('buildCandidates', () => {
  const ladder: ModelChoice[] = DEFAULT_FALLBACK_LADDER;

  it('returns the start plus every rung below it, preserving the start choice', () => {
    const start: ModelChoice = { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: -1 };
    const out = buildCandidates(start, ladder);
    expect(out[0]).toEqual(start); // start (with its thinking intent) leads
    expect(out.map((c) => c.model)).toEqual([
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
      'gemma-4-31b-it',
      'gemma-4-26b-a4b-it',
    ]);
  });

  it('returns only the start when it is not in the ladder (an explicit pin)', () => {
    const start: ModelChoice = { provider: 'anthropic', model: 'claude-opus-4-8' };
    expect(buildCandidates(start, ladder)).toEqual([start]);
  });
});

describe('withTransientRetry', () => {
  const fast = { sleep: async () => {}, random: () => 0 };

  it('returns on first success', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(withTransientRetry(fn, fast)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient error then succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      if (calls++ === 0) throw { status: 503, message: 'overloaded' };
      return 'ok';
    });
    await expect(withTransientRetry(fn, fast)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows a daily-quota error immediately (no retry)', async () => {
    const fn = vi.fn(async () => {
      throw { status: 429, message: 'requests per day exceeded' };
    });
    await expect(withTransientRetry(fn, fast)).rejects.toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on a persistent transient error', async () => {
    const fn = vi.fn(async () => {
      throw { status: 503, message: 'overloaded' };
    });
    await expect(withTransientRetry(fn, { ...fast, maxAttempts: 3 })).rejects.toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('AllModelsExhaustedError', () => {
  it('carries its reason', () => {
    const err = new AllModelsExhaustedError('context', 'too big');
    expect(err).toBeInstanceOf(Error);
    expect(err.reason).toBe('context');
    expect(err.name).toBe('AllModelsExhaustedError');
  });
});
