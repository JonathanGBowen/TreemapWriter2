// Living Sprints — pure plan logic. Turns an ArgumentShape (relative weights)
// into a concrete SprintPlan whose move durations sum *exactly* to the chosen
// total, re-normalizes AI-generated durations the same way, and extracts the
// reinstatement bits. No React, no store — fully unit-testable.

import type { ArgumentShape, SprintMove, SprintMoveRole, SprintPlan } from '../types';

/** Per-move floor so no move is unusably short, even when weights are tiny. */
export const MIN_MOVE_SEC = 60;

/**
 * Allocate `totalSec` across `weights` (relative), proportionally, with a floor
 * of `minSec` per slot, and fix rounding so the result sums to `totalSec`
 * exactly. The remainder is absorbed by the highest-weight slots first (so the
 * floor-pinned small moves keep their time). Mirrors the Songwriting Sprint's
 * "scale to total" rule.
 */
export function scaleWeightsToSeconds(
  weights: number[],
  totalSec: number,
  minSec = MIN_MOVE_SEC,
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  // If the floors alone exceed the budget, distribute evenly (degenerate case).
  if (totalSec <= n * minSec) {
    const each = Math.max(1, Math.floor(totalSec / n));
    const out = new Array(n).fill(each);
    let rem = totalSec - each * n;
    for (let i = 0; rem > 0; i = (i + 1) % n, rem--) out[i] += 1;
    return out;
  }
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const secs = weights.map((w) => Math.max(minSec, Math.round((w / sumW) * totalSec)));

  // Order slots by weight desc; spend/recover the rounding diff there first.
  const order = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w)
    .map((o) => o.i);

  let diff = totalSec - secs.reduce((a, b) => a + b, 0);
  let guard = 0;
  const guardMax = (Math.abs(diff) + n) * 4 + 16;
  while (diff !== 0 && guard < guardMax) {
    const i = order[guard % n];
    if (diff > 0) {
      secs[i] += 1;
      diff -= 1;
    } else if (secs[i] > minSec) {
      secs[i] -= 1;
      diff += 1;
    }
    guard++;
  }
  return secs;
}

/** Stable, deterministic move id within a plan. */
function moveId(prefix: string, index: number): string {
  return `${prefix}-m${index}`;
}

export interface PlanFromShapeOpts {
  targetSectionId?: string;
  /** Override the total minutes; defaults to the shape's natural weight-sum. */
  totalMin?: number;
}

/** Unroll a shape into a runnable plan at the chosen (or natural) total minutes. */
export function planFromShape(shape: ArgumentShape, opts: PlanFromShapeOpts = {}): SprintPlan {
  const naturalMin = shape.moves.reduce((a, m) => a + m.weight, 0);
  const totalMin = opts.totalMin && opts.totalMin > 0 ? opts.totalMin : naturalMin;
  const totalSec = Math.max(shape.moves.length * MIN_MOVE_SEC, Math.round(totalMin * 60));
  const secs = scaleWeightsToSeconds(
    shape.moves.map((m) => m.weight),
    totalSec,
  );
  const moves: SprintMove[] = shape.moves.map((m, i) => ({
    id: moveId(shape.id, i),
    title: m.title,
    instructions: [...m.instructions],
    durationSec: secs[i],
    role: m.role,
    ...(m.fromRequiredMoveId ? { fromRequiredMoveId: m.fromRequiredMoveId } : {}),
  }));
  return {
    shapeId: shape.id,
    targetSectionId: opts.targetSectionId ?? '',
    totalSec: secs.reduce((a, b) => a + b, 0),
    moves,
  };
}

/** Force a set of moves' durations to sum to `totalSec` (used after AI parse). */
export function renormalizeDurations(moves: SprintMove[], totalSec: number): SprintMove[] {
  if (moves.length === 0) return moves;
  const secs = scaleWeightsToSeconds(
    moves.map((m) => Math.max(1, Math.round(m.durationSec))),
    totalSec,
  );
  return moves.map((m, i) => ({ ...m, durationSec: secs[i] }));
}

/** The canonical opening move: reinstate context before the clock matters. */
export function reinstateMove(durationSec = 120): SprintMove {
  return {
    id: 'reinstate-0',
    title: 'Reinstate',
    role: 'reinstate',
    durationSec,
    instructions: [
      `Reread the section goal + your last sentence.`,
      `State in one line where you are.`,
      `Skim the reattached fragments.`,
    ],
  };
}

/** Guarantee a plan opens with a reinstate move (AI output may omit it). */
export function ensureReinstateFirst(moves: SprintMove[], durationSec = 120): SprintMove[] {
  if (moves[0]?.role === 'reinstate') return moves;
  return [reinstateMove(durationSec), ...moves];
}

/** A trivial Goal-sprint plan: reinstate, then define the section's claim. */
export function goalPlan(targetSectionId: string, totalMin = 10): SprintPlan {
  const total = Math.max(2 * MIN_MOVE_SEC, Math.round(totalMin * 60));
  const reinstateSec = Math.min(120, Math.max(MIN_MOVE_SEC, Math.round(total * 0.3)));
  const moves: SprintMove[] = [
    reinstateMove(reinstateSec),
    {
      id: 'goal-define',
      title: 'Define the goal',
      role: 'frame',
      durationSec: total - reinstateSec,
      instructions: [
        `Write the single sentence this section must earn.`,
        `No hedging, no "in some sense".`,
        `One claim — you can refine it next pass.`,
      ],
    },
  ];
  return { shapeId: null, targetSectionId, totalSec: total, moves };
}

/** MM:SS for a countdown. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Whole minutes for a duration, rounded, floored at 1. */
export function minutesOf(totalSeconds: number): number {
  return Math.max(1, Math.round(totalSeconds / 60));
}

/**
 * Last sentence of a section's body (the header line is stripped). Used by the
 * Reinstate card — shown verbatim, italic, "where you left off".
 */
export function lastSentenceOf(content: string): string {
  if (!content) return '';
  const lines = content.split('\n');
  if (/^#{1,6}\s+/.test(lines[0] ?? '')) lines.shift();
  const text = lines.join('\n').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const matches = text.match(/[^.!?]*[.!?]+(?=\s|$)|[^.!?]+$/g);
  if (!matches || matches.length === 0) return text.slice(-240).trim();
  return matches[matches.length - 1].trim();
}

/** Roles in display order, for any place that needs a stable role list. */
export const SPRINT_MOVE_ROLES: SprintMoveRole[] = [
  'reinstate',
  'frame',
  'marshal',
  'draft',
  'stress',
  'synthesize',
  'bridge',
];
