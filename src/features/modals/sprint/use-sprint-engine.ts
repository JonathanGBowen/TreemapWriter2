// Living Sprints — the timer/advance engine (Direction B). Owns the high-frequency
// countdown (50ms tick, kept local — never in the store, to avoid 50ms-cadence
// store writes) and the *strict auto-advance* contract: at zero, the current
// move's text is saved through the existing save path BEFORE advancing, so a
// forced transition never costs a keystroke. Pause / +N min / manual advance
// (Next, Cmd/Ctrl+Enter) all funnel through the one `advance()` so the
// save-before-advance invariant holds everywhere.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SprintMove, SprintPlan } from '../../../types';

const TICK_MS = 50;

export interface AdvanceCallbacks {
  getBuffer: () => string;
  onPersist: (text: string) => void;
  onComplete: () => void;
  onDing?: () => void;
}

/**
 * The strict-auto-advance transition, as a pure function so the safety-critical
 * ordering is unit-testable without a DOM. It ALWAYS persists the current buffer
 * FIRST (the never-lose-input guarantee), dings, then either completes (last
 * move) or returns the next move's state for the caller to apply. Used by both
 * the timer expiry and manual advance, so the invariant holds on every path.
 */
export function performAdvance(
  moves: SprintMove[],
  index: number,
  cb: AdvanceCallbacks,
): { index: number; timeLeftMs: number } | null {
  cb.onPersist(cb.getBuffer()); // (a) save before anything moves
  cb.onDing?.();
  if (index >= moves.length - 1) {
    cb.onComplete();
    return null;
  }
  const next = index + 1;
  return { index: next, timeLeftMs: moves[next].durationSec * 1000 };
}

export interface UseSprintEngineArgs {
  plan: SprintPlan | null;
  /** Tick only while true (the runner is mounted + active). */
  running: boolean;
  /** Read the current editor buffer at save time. */
  getBuffer: () => string;
  /** Persist the buffer (the existing onSaveContent/onSaveGoal path). */
  onPersist: (text: string) => void;
  /** Fired after the final move's clock expires (or manual finish). */
  onComplete: () => void;
  /** Fired when a new move becomes active (focus the editor, etc.). */
  onAdvance?: (nextIndex: number) => void;
  /** The transition cue (gated by the caller on the cues pref). */
  onDing?: () => void;
}

export interface SprintEngine {
  moveIndex: number;
  move: SprintMove | null;
  timeLeftMs: number;
  paused: boolean;
  togglePause: () => void;
  addMinutes: (minutes: number) => void;
  /** Manual advance (Next button / Cmd-Enter). Saves, then moves on. */
  advance: () => void;
}

export function useSprintEngine(args: UseSprintEngineArgs): SprintEngine {
  const { plan, running } = args;
  const moves = plan?.moves ?? [];

  const [moveIndex, setMoveIndex] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [paused, setPaused] = useState(false);

  // Refs so the 50ms interval (created once per run) always sees live values
  // without re-subscribing on every tick.
  const indexRef = useRef(0);
  const timeRef = useRef(0);
  const cb = useRef(args);
  cb.current = args;

  const setTime = useCallback((ms: number) => {
    timeRef.current = ms;
    setTimeLeftMs(ms);
  }, []);

  const setIndex = useCallback((i: number) => {
    indexRef.current = i;
    setMoveIndex(i);
  }, []);

  // (Re)start the engine whenever a new plan is handed in.
  useEffect(() => {
    if (!plan || plan.moves.length === 0) return;
    setIndex(0);
    setTime(plan.moves[0].durationSec * 1000);
    setPaused(false);
  }, [plan, setIndex, setTime]);

  const advance = useCallback(() => {
    const c = cb.current;
    const result = performAdvance(c.plan?.moves ?? [], indexRef.current, {
      getBuffer: c.getBuffer,
      onPersist: c.onPersist,
      onComplete: c.onComplete,
      onDing: c.onDing,
    });
    if (!result) return;
    setIndex(result.index);
    setTime(result.timeLeftMs);
    c.onAdvance?.(result.index);
  }, [setIndex, setTime]);

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // The clock. Decrements via a ref-read so there's no stale closure; expiry
  // routes through advance() (the single save-then-move path).
  useEffect(() => {
    if (!running || paused || !plan || plan.moves.length === 0) return;
    const id = setInterval(() => {
      const next = timeRef.current - TICK_MS;
      if (next <= 0) {
        advanceRef.current();
      } else {
        setTime(next);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, paused, plan, setTime]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const addMinutes = useCallback(
    (minutes: number) => setTime(timeRef.current + minutes * 60_000),
    [setTime],
  );

  return {
    moveIndex,
    move: moves[moveIndex] ?? null,
    timeLeftMs,
    paused,
    togglePause,
    addMinutes,
    advance,
  };
}
