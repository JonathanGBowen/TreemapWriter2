import React, { useState } from 'react';
import { useAmbientCue } from './use-ambient-cue';
import { useReentryOpening } from './use-reentry-opening';
import { useUnstickOpening } from './use-open-dialogue';
import { useStore } from '../../state';
import { useCurrentSection } from '../tests-panel/use-current-section';

/**
 * The Quiet-target re-entry marker. Replaces the floating "You were here" nudge
 * with a slim cyan bar in the prose's left margin: the manuscript stays the
 * column, and the resume affordance hangs off it instead of over it.
 *
 * Shown only once a section has a remembered caret (committed when you leave a
 * section), so it always names a place you can return to — never ambient
 * decoration. At rest it's just the bar; it reveals "Resume · you were here" +
 * "Go deeper" on hover, and — preserving the non-initiated ADHD cue — auto-reveals
 * with "Still here?" on a mid-section stall. Click restores the caret; Go deeper
 * opens the coach (the same action the old nudge fired).
 */
export const ResumeMarker: React.FC<{ onResume: () => void }> = ({ onResume }) => {
  const cue = useAmbientCue();
  const openReentry = useReentryOpening();
  const openUnstick = useUnstickOpening();
  const currentSection = useCurrentSection();
  const hasCaret = useStore((s) => (currentSection ? !!s.sectionCaret[currentSection.id] : false));
  const [hovered, setHovered] = useState(false);

  if (!hasCaret) return null;

  const revealed = hovered || cue.stalled;
  const label = cue.stalled ? 'Still here?' : 'Resume · you were here';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onResume}
      className="absolute left-[24px] top-[150px] z-20 flex items-center gap-[9px] cursor-pointer"
    >
      <span
        className="w-[4px] h-[42px] bg-hld-cyan shrink-0 shadow-[0_0_8px_rgba(0,232,245,0.55)] transition-shadow hover:shadow-[0_0_15px_rgba(0,232,245,0.9)]"
        title="Resume — return to where you left off"
      />
      {revealed && (
        <span className="flex flex-col gap-[5px]">
          <span className="font-mono text-[8px] tracking-[0.14em] uppercase text-hld-cyan whitespace-nowrap">
            {label}
          </span>
          {cue.stalled && currentSection ? (
            // A mid-section stall escalates to the bounded unstick dialogue —
            // section-grained, with permission-to-stop (the repointed 90 s cue).
            <button
              onClick={(e) => { e.stopPropagation(); openUnstick(currentSection.id); }}
              className="self-start inline-flex items-center gap-[5px] font-mono text-[8px] tracking-[0.1em] uppercase text-hld-cyan bg-transparent border border-hld-cyan/40 px-[8px] py-[3px] hover:bg-hld-cyan/10 transition-colors"
              title="Talk this stall through — a next move, a recentering, or permission to stop"
            >
              <span className="text-[10px] leading-none">⊕</span> Unstick
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); cue.goDeeper(); }}
              className="self-start inline-flex items-center gap-[5px] font-mono text-[8px] tracking-[0.1em] uppercase text-hld-cyan bg-transparent border border-hld-cyan/40 px-[8px] py-[3px] hover:bg-hld-cyan/10 transition-colors"
              title="Open the coach for a fuller plan"
            >
              <span className="text-[10px] leading-none">⤢</span> Go deeper
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); void openReentry(); }}
            className="self-start inline-flex items-center gap-[5px] font-mono text-[8px] tracking-[0.1em] uppercase text-hld-cyan bg-transparent border border-hld-cyan/40 px-[8px] py-[3px] hover:bg-hld-cyan/10 transition-colors"
            title="Where was I? — a short dialogue over your recent activity"
          >
            <span className="text-[10px] leading-none">⊕</span> Where was I?
          </button>
        </span>
      )}
    </div>
  );
};
