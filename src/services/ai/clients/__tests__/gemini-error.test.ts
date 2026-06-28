import { describe, expect, it } from 'vitest';
import { geminiQuotaScope, geminiRetryDelayMs, annotateGeminiError } from '../gemini-error';
import type { QuotaAnnotatedError } from '../../model-types';

describe('geminiQuotaScope', () => {
  it('detects a per-minute quota from a metric id', () => {
    expect(
      geminiQuotaScope({ message: 'Quota exceeded for GenerateRequestsPerMinutePerProjectPerModel' }),
    ).toBe('per-minute');
  });

  it('detects a per-day quota from a metric id', () => {
    expect(
      geminiQuotaScope({ message: 'Quota exceeded for GenerateRequestsPerDayPerProjectPerModel' }),
    ).toBe('per-day');
  });

  it('reads the structured QuotaFailure details array', () => {
    const err = {
      error: {
        code: 429,
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric: 'generativelanguage.googleapis.com/generate_requests',
                quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
              },
            ],
          },
        ],
      },
    };
    expect(geminiQuotaScope(err)).toBe('per-minute');
  });

  it('returns undefined when the scope is unknown', () => {
    expect(geminiQuotaScope({ message: 'some other error' })).toBeUndefined();
    expect(geminiQuotaScope(null)).toBeUndefined();
  });
});

describe('geminiRetryDelayMs', () => {
  it('parses a RetryInfo retryDelay', () => {
    expect(geminiRetryDelayMs({ message: '...,"retryDelay":"31s"}' })).toBe(31_000);
  });

  it('parses a prose "retry in"', () => {
    expect(geminiRetryDelayMs({ message: 'Please retry in 12.5s.' })).toBe(12_500);
  });

  it('returns undefined when no delay is present', () => {
    expect(geminiRetryDelayMs({ message: 'no delay here' })).toBeUndefined();
  });
});

describe('annotateGeminiError', () => {
  it('attaches scope + delay in place and returns the same error', () => {
    const err = {
      status: 429,
      message: 'GenerateRequestsPerMinutePerProjectPerModel; "retryDelay":"20s"',
    };
    const out = annotateGeminiError(err) as QuotaAnnotatedError;
    expect(out).toBe(err);
    expect(out.__quotaScope).toBe('per-minute');
    expect(out.__retryDelayMs).toBe(20_000);
  });

  it('is a no-op for a plain non-quota error', () => {
    const err = { message: 'API key not valid' } as QuotaAnnotatedError;
    annotateGeminiError(err);
    expect(err.__quotaScope).toBeUndefined();
    expect(err.__retryDelayMs).toBeUndefined();
  });

  it('never throws on a non-object', () => {
    expect(() => annotateGeminiError('boom')).not.toThrow();
    expect(annotateGeminiError(undefined)).toBeUndefined();
  });
});
