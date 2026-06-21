import { describe, expect, it } from 'vitest';
import {
  canRemoveStep,
  editStep,
  insertStep,
  moveStep,
  removeStep,
  replaceStepWithChildren,
} from '../sprintEdit';
import { MIN_MOVE_SEC } from '../sprintPlan';
import type { SprintMove } from '../../types';

const sum = (ms: SprintMove[]) => ms.reduce((a, m) => a + m.durationSec, 0);

const PLAN: SprintMove[] = [
  { id: 'a', title: 'Reinstate', role: 'reinstate', durationSec: 180, instructions: ['x'] },
  { id: 'b', title: 'Frame the claim', role: 'frame', durationSec: 420, instructions: ['y'] },
  { id: 'c', title: 'Draft the reply', role: 'draft', durationSec: 900, instructions: ['z'] },
  { id: 'd', title: 'Bridge', role: 'bridge', durationSec: 300, instructions: ['w'] },
];
const TOTAL = 1800;

describe('replaceStepWithChildren', () => {
  it('replaces a step with its children and keeps the total exact', () => {
    const children: SprintMove[] = [
      { id: 'x', title: 'Outline the reply', role: 'draft', durationSec: 1, instructions: [] },
      { id: 'y', title: 'Write the reply', role: 'draft', durationSec: 2, instructions: [] },
    ];
    const out = replaceStepWithChildren(PLAN, 2, children, TOTAL);
    expect(sum(out)).toBe(TOTAL);
    expect(out).toHaveLength(5);
    expect(out.map((m) => m.title)).toContain('Outline the reply');
    expect(out.map((m) => m.title)).toContain('Write the reply');
    // ids re-keyed + unique
    const ids = out.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    // reinstate still first
    expect(out[0].role).toBe('reinstate');
  });

  it('refuses to break down the reinstate opener', () => {
    const out = replaceStepWithChildren(PLAN, 0, [PLAN[1]], TOTAL);
    expect(out).toBe(PLAN);
  });

  it('is a no-op with no children', () => {
    expect(replaceStepWithChildren(PLAN, 2, [], TOTAL)).toBe(PLAN);
  });
});

describe('insertStep', () => {
  it('inserts and renormalizes to the total, never above reinstate', () => {
    const fresh: SprintMove = { id: 'n', title: 'New', role: 'marshal', durationSec: 120, instructions: [] };
    const out = insertStep(PLAN, 0, fresh, TOTAL); // index 0 clamps to 1
    expect(sum(out)).toBe(TOTAL);
    expect(out).toHaveLength(5);
    expect(out[0].role).toBe('reinstate');
    expect(out[1].title).toBe('New');
  });
});

describe('removeStep / canRemoveStep', () => {
  it('removes a normal step and renormalizes to the total', () => {
    const out = removeStep(PLAN, 3, TOTAL);
    expect(out).toHaveLength(3);
    expect(sum(out)).toBe(TOTAL);
  });

  it('never removes the reinstate opener', () => {
    expect(canRemoveStep(PLAN, 0)).toBe(false);
    expect(removeStep(PLAN, 0, TOTAL)).toBe(PLAN);
  });

  it('never drops below two moves', () => {
    const two: SprintMove[] = [PLAN[0], PLAN[1]];
    expect(canRemoveStep(two, 1)).toBe(false);
    expect(removeStep(two, 1, 600)).toBe(two);
  });

  it('keeps every move at or above the floor after removal', () => {
    const out = removeStep(PLAN, 1, TOTAL);
    expect(out.every((m) => m.durationSec >= MIN_MOVE_SEC)).toBe(true);
  });
});

describe('moveStep', () => {
  it('reorders without changing the total and pins reinstate first', () => {
    const out = moveStep(PLAN, 3, 1);
    expect(sum(out)).toBe(sum(PLAN));
    expect(out[0].role).toBe('reinstate');
    expect(out[1].title).toBe('Bridge');
  });

  it('refuses to move the reinstate opener', () => {
    expect(moveStep(PLAN, 0, 2)).toBe(PLAN);
  });

  it('clamps a destination of 0 to just-after reinstate', () => {
    const out = moveStep(PLAN, 2, 0);
    expect(out[0].role).toBe('reinstate');
    expect(out[1].title).toBe('Draft the reply');
  });
});

describe('editStep', () => {
  it('patches title and instructions without touching durations', () => {
    const out = editStep(PLAN, 1, { title: 'Reframe', instructions: ['a', 'b'] });
    expect(out[1].title).toBe('Reframe');
    expect(out[1].instructions).toEqual(['a', 'b']);
    expect(out[1].durationSec).toBe(PLAN[1].durationSec);
    expect(sum(out)).toBe(sum(PLAN));
  });
});
