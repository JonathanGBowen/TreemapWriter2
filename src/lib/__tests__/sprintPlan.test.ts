import { describe, expect, it } from 'vitest';
import { DEFAULT_ARGUMENT_SHAPES } from '../argumentShapes';
import {
  MIN_MOVE_SEC,
  ensureReinstateFirst,
  formatClock,
  goalPlan,
  lastSentenceOf,
  minutesOf,
  planFromShape,
  renormalizeDurations,
  scaleWeightsToSeconds,
} from '../sprintPlan';
import type { SprintMove } from '../../types';

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe('scaleWeightsToSeconds', () => {
  it('allocates proportionally and sums to the total exactly', () => {
    const out = scaleWeightsToSeconds([3, 8, 6, 12, 6], 2100);
    expect(sum(out)).toBe(2100);
    expect(out).toHaveLength(5);
    // The biggest weight (12) gets the most time; the smallest (3) the least.
    expect(Math.max(...out)).toBe(out[3]);
    expect(Math.min(...out)).toBe(out[0]);
  });

  it('respects the per-move floor', () => {
    const out = scaleWeightsToSeconds([1, 1, 100], 600);
    expect(sum(out)).toBe(600);
    expect(out.every((s) => s >= MIN_MOVE_SEC)).toBe(true);
  });

  it('degrades gracefully when the budget cannot satisfy every floor', () => {
    const out = scaleWeightsToSeconds([1, 1, 1, 1], 100); // 4 moves, only 100s
    expect(sum(out)).toBe(100);
    expect(out.every((s) => s >= 1)).toBe(true);
  });

  it('handles the empty case', () => {
    expect(scaleWeightsToSeconds([], 600)).toEqual([]);
  });
});

describe('planFromShape', () => {
  it('unrolls every shape so durations sum exactly to the natural total', () => {
    for (const shape of DEFAULT_ARGUMENT_SHAPES) {
      const plan = planFromShape(shape, { targetSectionId: 'sec-1' });
      const naturalSec = shape.moves.reduce((a, m) => a + m.weight, 0) * 60;
      expect(plan.totalSec).toBe(naturalSec);
      expect(sum(plan.moves.map((m) => m.durationSec))).toBe(plan.totalSec);
      expect(plan.moves).toHaveLength(shape.moves.length);
      expect(plan.moves[0].role).toBe('reinstate');
      expect(plan.shapeId).toBe(shape.id);
      expect(plan.targetSectionId).toBe('sec-1');
      expect(plan.moves.every((m) => m.durationSec >= MIN_MOVE_SEC)).toBe(true);
      // ids deterministic + unique within a plan
      const ids = plan.moves.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('scales to a chosen total', () => {
    const shape = DEFAULT_ARGUMENT_SHAPES[0];
    const plan = planFromShape(shape, { totalMin: 25 });
    expect(plan.totalSec).toBe(25 * 60);
    expect(sum(plan.moves.map((m) => m.durationSec))).toBe(25 * 60);
  });
});

describe('renormalizeDurations', () => {
  it('forces an arbitrary set of moves to sum to the total', () => {
    const moves: SprintMove[] = [
      { id: 'a', title: 'A', role: 'reinstate', durationSec: 30, instructions: ['x'] },
      { id: 'b', title: 'B', role: 'draft', durationSec: 999, instructions: ['y'] },
      { id: 'c', title: 'C', role: 'bridge', durationSec: 120, instructions: ['z'] },
    ];
    const out = renormalizeDurations(moves, 1800);
    expect(sum(out.map((m) => m.durationSec))).toBe(1800);
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('goalPlan', () => {
  it('is a two-move plan that opens with reinstate and sums to the total', () => {
    const plan = goalPlan('sec-9', 10);
    expect(plan.moves).toHaveLength(2);
    expect(plan.moves[0].role).toBe('reinstate');
    expect(plan.shapeId).toBeNull();
    expect(plan.targetSectionId).toBe('sec-9');
    expect(sum(plan.moves.map((m) => m.durationSec))).toBe(plan.totalSec);
  });
});

describe('ensureReinstateFirst', () => {
  it('prepends a reinstate move when missing, and is a no-op otherwise', () => {
    const draftOnly: SprintMove[] = [
      { id: 'b', title: 'B', role: 'draft', durationSec: 600, instructions: ['y'] },
    ];
    const fixed = ensureReinstateFirst(draftOnly);
    expect(fixed[0].role).toBe('reinstate');
    expect(fixed).toHaveLength(2);
    expect(ensureReinstateFirst(fixed)).toHaveLength(2);
  });
});

describe('lastSentenceOf', () => {
  it('strips the header line and returns the final sentence verbatim', () => {
    const content = '## 3.2 The Strategy\nFirst point here. But this concedes too much, which is';
    expect(lastSentenceOf(content)).toBe('But this concedes too much, which is');
  });

  it('returns the last complete sentence when one exists', () => {
    expect(lastSentenceOf('Alpha. Beta. Gamma.')).toBe('Gamma.');
  });

  it('returns empty string for empty / header-only content', () => {
    expect(lastSentenceOf('')).toBe('');
    expect(lastSentenceOf('# Title')).toBe('');
  });
});

describe('formatClock / minutesOf', () => {
  it('formats MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(462)).toBe('07:42');
    expect(formatClock(-5)).toBe('00:00');
  });

  it('rounds to whole minutes, floored at 1', () => {
    expect(minutesOf(2100)).toBe(35);
    expect(minutesOf(20)).toBe(1);
  });
});
