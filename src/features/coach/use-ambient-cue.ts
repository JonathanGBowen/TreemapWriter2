import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { useCurrentSection } from '../tests-panel/use-current-section';
import { buildReinstatement } from '../../lib/reinstate';

/** Idle span before a mid-section stall surfaces the next-priority nudge. */
export const STALL_MS = 90_000;
const TICK_MS = 5_000;

/** Pure stall predicate (extracted so the timing rule is unit-testable). */
export const isStalled = (
  lastEditMs: number,
  nowMs: number,
  stallMs: number = STALL_MS,
): boolean => nowMs - lastEditMs >= stallMs;

export interface AmbientCueData {
  /** The cue should be shown right now (re-entry, or a re-armed stall). */
  visible: boolean;
  /** The visit has gone idle mid-section — escalates the cue past a dismiss. */
  stalled: boolean;
  /** The claim this section must earn (for the re-entry line). */
  goal: string;
  /** Verbatim last sentence written here (re-entry continuity). */
  lastSentence: string;
  /** The single most useful next move, from the last diagnostic. */
  nextPriority: string | null;
  /** Honor prefers-reduced-motion: appear, don't animate. */
  reducedMotion: boolean;
  /** Soft-dismiss for this section; re-arms on re-entry or on a later stall. */
  dismiss: () => void;
  /** Open the streaming coach for the richer, AI-backed plan (one glance away). */
  goDeeper: () => void;
}

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
};

/**
 * The non-initiated cue. The clinical brief is explicit: support "must not
 * depend on my own initiative to activate it." So this watches the live buffer
 * and surfaces the next move with no button press — on re-entry (section change)
 * and again on a mid-section stall. All data is local (reinstatement +
 * lastDiagnostic.nextPriority); there is no AI call on this path, so it is
 * instant and always available.
 */
export function useAmbientCue(): AmbientCueData {
  const enabled = useStore((s) => s.ambientCueEnabled);
  const sections = useStore((s) => s.sections);
  const testSuite = useStore((s) => s.testSuite);
  const localContent = useStore((s) => s.localContent);
  const dismissedForId = useStore((s) => s.cueDismissedForId);
  const setDismissedForId = useStore((s) => s.setCueDismissedForId);
  const setShowCoachModal = useStore((s) => s.setShowCoachModal);
  const currentSection = useCurrentSection();
  const reducedMotion = usePrefersReducedMotion();

  const sectionId = currentSection?.id ?? null;
  const entry = sectionId ? testSuite[sectionId] : undefined;
  const solved = entry?.status === 'success';

  const { goal, lastSentence } = useMemo(
    () => buildReinstatement(currentSection, entry),
    [currentSection?.id, entry],
  );
  const nextPriority = entry?.lastDiagnostic?.nextPriority?.trim() || null;

  // Re-entry: a new section clears the prior soft-dismiss so it cues again.
  useEffect(() => {
    setDismissedForId(null);
  }, [sectionId, setDismissedForId]);

  // Stall timer: reset on every edit and on section change; fire after STALL_MS.
  const [stalled, setStalled] = useState(false);
  const lastEditRef = useRef<number>(Date.now());
  useEffect(() => {
    lastEditRef.current = Date.now();
    setStalled(false);
  }, [localContent, sectionId]);
  useEffect(() => {
    if (!enabled || !sectionId || solved) return;
    const t = setInterval(() => {
      if (isStalled(lastEditRef.current, Date.now())) setStalled(true);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [enabled, sectionId, solved]);

  const hasContent = !!(nextPriority || goal || lastSentence);
  const dismissedHere = dismissedForId === sectionId;
  const visible = enabled && !!sectionId && hasContent && (!dismissedHere || stalled);

  return {
    visible,
    stalled,
    goal,
    lastSentence,
    nextPriority,
    reducedMotion,
    dismiss: () => setDismissedForId(sectionId),
    goDeeper: () => setShowCoachModal(true),
  };
}
