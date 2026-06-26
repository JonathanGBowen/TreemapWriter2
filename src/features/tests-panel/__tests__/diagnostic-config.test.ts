import { describe, expect, it } from 'vitest';
import {
  READINESS,
  READINESS_TOTAL,
  summarizeReadiness,
} from '../diagnostic-config';
import type { ReadinessLevel } from '../../../types';

describe('summarizeReadiness', () => {
  it('treats null/undefined as undiagnosed — all steps hollow, idle pip', () => {
    for (const level of [null, undefined]) {
      const s = summarizeReadiness(level);
      expect(s).toEqual({
        filled: 0,
        total: READINESS_TOTAL,
        pip: 'idle',
        label: 'Undiagnosed',
        diagnosed: false,
      });
    }
  });

  it('fills steps up to the level and carries that level’s pip + label', () => {
    expect(summarizeReadiness('draft')).toEqual({
      filled: 1, total: 4, pip: 'magenta', label: 'Draft', diagnosed: true,
    });
    expect(summarizeReadiness('developing')).toEqual({
      filled: 2, total: 4, pip: 'yellow', label: 'Developing', diagnosed: true,
    });
    expect(summarizeReadiness('nearly-there')).toEqual({
      filled: 3, total: 4, pip: 'cyan', label: 'Nearly there', diagnosed: true,
    });
    expect(summarizeReadiness('solid')).toEqual({
      filled: 4, total: 4, pip: 'green', label: 'Solid', diagnosed: true,
    });
  });

  it('never fills more than the total, and stays in sync with READINESS', () => {
    const levels = Object.keys(READINESS) as ReadinessLevel[];
    for (const level of levels) {
      const s = summarizeReadiness(level);
      expect(s.filled).toBeGreaterThanOrEqual(1);
      expect(s.filled).toBeLessThanOrEqual(READINESS_TOTAL);
      expect(s.filled).toBe(READINESS[level].level);
      expect(s.pip).toBe(READINESS[level].pip);
      expect(s.diagnosed).toBe(true);
    }
  });
});
