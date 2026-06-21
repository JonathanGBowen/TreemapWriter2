// Living Sprints — pure, immutable edit ops on a plan's move list (the Goblin
// editor's engine). Every structural op keeps the list summing to `totalSec`
// exactly (via `renormalizeDurations`) and re-keys move ids so React keys stay
// stable. The reinstate opener is protected: it always stays first and can't be
// removed. No React, no store — fully unit-testable.

import type { SprintMove } from '../types';
import { MIN_MOVE_SEC, renormalizeDurations, scaleWeightsToSeconds } from './sprintPlan';

/** Re-id moves deterministically after a structural change. */
export function rekeyMoves(moves: SprintMove[]): SprintMove[] {
  return moves.map((m, i) => ({ ...m, id: `edit-m${i}` }));
}

/** Whether a move at `index` can be removed (never the reinstate opener; keep ≥2). */
export function canRemoveStep(moves: SprintMove[], index: number): boolean {
  if (index < 0 || index >= moves.length) return false;
  if (moves[index].role === 'reinstate') return false;
  return moves.length > 2;
}

/**
 * Goblin recursive breakdown: replace the move at `index` with `children`,
 * splitting the parent's seconds across them proportionally (by the children's
 * own durations as weights), then renormalize the whole list to `totalSec`. The
 * reinstate opener is never broken down (returns the list unchanged).
 */
export function replaceStepWithChildren(
  moves: SprintMove[],
  index: number,
  children: SprintMove[],
  totalSec: number,
): SprintMove[] {
  if (index < 0 || index >= moves.length || children.length === 0) return moves;
  if (moves[index].role === 'reinstate') return moves;

  const parentSec = Math.max(children.length * MIN_MOVE_SEC, moves[index].durationSec);
  const childSecs = scaleWeightsToSeconds(
    children.map((c) => Math.max(1, Math.round(c.durationSec))),
    parentSec,
  );
  const sized = children.map((c, i) => ({ ...c, durationSec: childSecs[i] }));

  const next = [...moves.slice(0, index), ...sized, ...moves.slice(index + 1)];
  return rekeyMoves(renormalizeDurations(next, totalSec));
}

/** Insert a new move at `index` (clamped), then renormalize to `totalSec`. */
export function insertStep(
  moves: SprintMove[],
  index: number,
  move: SprintMove,
  totalSec: number,
): SprintMove[] {
  // Never insert before the reinstate opener.
  const at = Math.min(moves.length, Math.max(1, index));
  const next = [...moves.slice(0, at), move, ...moves.slice(at)];
  return rekeyMoves(renormalizeDurations(next, totalSec));
}

/** Remove the move at `index` (no-op if protected), then renormalize. */
export function removeStep(moves: SprintMove[], index: number, totalSec: number): SprintMove[] {
  if (!canRemoveStep(moves, index)) return moves;
  const next = [...moves.slice(0, index), ...moves.slice(index + 1)];
  return rekeyMoves(renormalizeDurations(next, totalSec));
}

/**
 * Reorder: move the step at `from` to `to`. Durations are unchanged (so the
 * total is preserved without renormalizing). The reinstate opener is pinned at
 * index 0 — it can't be moved, and nothing can be placed above it.
 */
export function moveStep(moves: SprintMove[], from: number, to: number): SprintMove[] {
  if (from === to || from < 0 || from >= moves.length) return moves;
  if (moves[from].role === 'reinstate') return moves;
  const dest = Math.min(moves.length - 1, Math.max(1, to));
  if (dest === from) return moves;
  const next = [...moves];
  const [picked] = next.splice(from, 1);
  next.splice(dest, 0, picked);
  return rekeyMoves(next);
}

/** Patch a move's title and/or instructions in place (durations untouched). */
export function editStep(
  moves: SprintMove[],
  index: number,
  patch: { title?: string; instructions?: string[] },
): SprintMove[] {
  if (index < 0 || index >= moves.length) return moves;
  return moves.map((m, i) =>
    i === index
      ? {
          ...m,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.instructions !== undefined ? { instructions: patch.instructions } : {}),
        }
      : m,
  );
}
