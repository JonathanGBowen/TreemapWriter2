import { describe, expect, it, vi } from 'vitest';
import { performAdvance, type AdvanceCallbacks } from '../use-sprint-engine';
import type { SprintMove } from '../../../../types';

const moves: SprintMove[] = [
  { id: 'm0', title: 'Reinstate', role: 'reinstate', durationSec: 120, instructions: ['x'] },
  { id: 'm1', title: 'Draft', role: 'draft', durationSec: 600, instructions: ['y'] },
  { id: 'm2', title: 'Bridge', role: 'bridge', durationSec: 240, instructions: ['z'] },
];

function spies(buffer: string): { cb: AdvanceCallbacks; order: string[] } {
  const order: string[] = [];
  return {
    order,
    cb: {
      getBuffer: () => buffer,
      onPersist: vi.fn(() => order.push('persist')),
      onDing: vi.fn(() => order.push('ding')),
      onComplete: vi.fn(() => order.push('complete')),
    },
  };
}

describe('performAdvance (strict auto-advance)', () => {
  it('saves the buffer BEFORE advancing — never loses input on a forced transition', () => {
    const { cb, order } = spies('half-written paragraph');
    const result = performAdvance(moves, 0, cb);

    expect(cb.onPersist).toHaveBeenCalledWith('half-written paragraph');
    // persist must happen before the move changes (or completes).
    expect(order[0]).toBe('persist');
    expect(result).toEqual({ index: 1, timeLeftMs: 600 * 1000 });
  });

  it('advances to the next move with that move’s clock', () => {
    const { cb } = spies('text');
    expect(performAdvance(moves, 1, cb)).toEqual({ index: 2, timeLeftMs: 240 * 1000 });
  });

  it('completes (and still persists) when the last move expires', () => {
    const { cb, order } = spies('final text');
    const result = performAdvance(moves, moves.length - 1, cb);

    expect(result).toBeNull();
    expect(cb.onPersist).toHaveBeenCalledWith('final text');
    expect(cb.onComplete).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['persist', 'ding', 'complete']);
  });

  it('dings on every transition (the cue is gated upstream by the cues pref)', () => {
    const { cb } = spies('t');
    performAdvance(moves, 0, cb);
    expect(cb.onDing).toHaveBeenCalledTimes(1);
  });
});
