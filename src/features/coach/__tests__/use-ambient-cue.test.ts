import { describe, expect, it } from 'vitest';
import { isStalled, STALL_MS } from '../use-ambient-cue';

describe('isStalled', () => {
  it('is false before the idle span elapses', () => {
    const t0 = 1_000_000;
    expect(isStalled(t0, t0)).toBe(false);
    expect(isStalled(t0, t0 + STALL_MS - 1)).toBe(false);
  });

  it('fires exactly at and beyond the idle span', () => {
    const t0 = 1_000_000;
    expect(isStalled(t0, t0 + STALL_MS)).toBe(true);
    expect(isStalled(t0, t0 + STALL_MS + 10_000)).toBe(true);
  });

  it('honors a custom stall span', () => {
    expect(isStalled(0, 500, 1_000)).toBe(false);
    expect(isStalled(0, 1_000, 1_000)).toBe(true);
  });
});
