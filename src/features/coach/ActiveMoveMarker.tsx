import React, { useState } from 'react';
import { useStore } from '../../state';
import { useCurrentSection } from '../tests-panel/use-current-section';
import { Pip, type PipStatus } from '../shared/Pip';
import { selectActiveMove } from './active-move';
import type { MoveStatus } from '../../types';

const PIP: Record<MoveStatus, PipStatus> = {
  missing: 'yellow',
  partial: 'yellow',
  unclear: 'yellow',
  present: 'green',
};

const SOURCE_LABEL: Record<'vector' | 'move' | 'spec', string> = {
  vector: 'Next move',
  move: 'Next move',
  spec: 'Start here',
};

/**
 * The point-of-action move cue (F5). When the section the caret sits in still owes
 * a move, a quiet status pip hangs in the prose's left margin (below the resume
 * marker); hover/focus reveals the one-line demand and the gap behind it — the
 * instruction *co-located with the prose*, so it never has to be carried from the
 * Spec panel (defeats split-attention). Click opens the coach for a fuller plan.
 *
 * No AI call: it reads the already-cached `lastDiagnostic`/spec. Self-mounting and
 * gated by the same `ambientCueEnabled` switch as the other non-initiated cues, so
 * there is no new config knob. A button (not a bare div) so it is keyboard-focusable.
 */
export const ActiveMoveMarker: React.FC = () => {
  const enabled = useStore((s) => s.ambientCueEnabled);
  const section = useCurrentSection();
  const entry = useStore((s) => (section ? s.testSuite[section.id] : undefined));
  const openCoach = useStore((s) => s.setShowCoachModal);
  const [revealed, setRevealed] = useState(false);

  if (!enabled || !section) return null;
  const cue = selectActiveMove(section, entry);
  if (!cue) return null;

  return (
    <button
      type="button"
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
      onClick={() => openCoach(true)}
      aria-label={`Next move: ${cue.text}. Open the coach.`}
      className="absolute left-[22px] top-[212px] z-20 flex items-start gap-[9px] text-left bg-transparent cursor-pointer"
    >
      <span className="mt-[3px] shrink-0">
        <Pip status={PIP[cue.status]} size="md" title={`Next move (${cue.status})`} />
      </span>
      {revealed && (
        <span className="flex flex-col gap-[4px] max-w-[230px]">
          <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-muted-text">
            {SOURCE_LABEL[cue.source]}
          </span>
          <span className="text-[11px] leading-[1.35] text-hld-text">{cue.text}</span>
          {cue.detail && (
            <span className="font-mono text-[8.5px] tracking-[0.04em] text-hld-muted-text leading-[1.4]">
              {cue.detail}
            </span>
          )}
        </span>
      )}
    </button>
  );
};
