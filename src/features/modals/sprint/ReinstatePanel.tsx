// Living Sprints — the Reinstate card (Direction D, context half). Rendered as
// the body of the opening move, in place of the editor. Three stacked blocks:
// the goal this section must earn, the exact last sentence (verbatim, italic),
// and the prior fragments reattached. It is *shown*, not asked — the writer
// reads, the clock runs, the sprint begins warm. Built from `hld-*` tokens + Pip.

import { Pip } from '../../shared/Pip';
import type { Reinstatement } from '../../../lib/reinstate';
import type { SprintGoalFraming } from '../../../types';

interface ReinstatePanelProps {
  reinstatement: Reinstatement;
  lastTouchedDays: number | null;
  /** The coach-captured goal for this sprint (supersedes the spec-derived goal). */
  goal?: SprintGoalFraming;
}

function BlockLabel({ pip, children }: { pip: 'cyan' | 'magenta' | 'yellow'; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[7px] font-mono text-[9px] tracking-[0.16em] uppercase text-hld-muted-text mb-[7px]">
      <Pip status={pip} size="sm" />
      {children}
    </div>
  );
}

export function ReinstatePanel({ reinstatement, lastTouchedDays, goal: framing }: ReinstatePanelProps) {
  const { goal, lastSentence, fragments } = reinstatement;
  const ago = lastTouchedDays == null ? '' : ` — ${lastTouchedDays}d ago`;
  // The coach-captured goal wins over the spec-derived one when present.
  const sprintGoal = framing?.wish?.trim() || goal;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[16px] pr-1">
      <div>
        <BlockLabel pip="cyan">This sprint must earn</BlockLabel>
        {sprintGoal ? (
          <div className="text-[13px] leading-relaxed text-hld-text border-l-2 border-hld-cyan pl-3">{sprintGoal}</div>
        ) : (
          <div className="text-[12px] text-hld-muted-text italic pl-3">No goal set yet — define one in this sprint.</div>
        )}
      </div>

      {framing?.model === 'woop' && (framing.obstacle || framing.ifThen) && (
        <div>
          <BlockLabel pip="yellow">If you slip, here's your move</BlockLabel>
          {framing.obstacle && (
            <div className="text-[12px] leading-relaxed text-hld-muted-text pl-3">⚠ {framing.obstacle}</div>
          )}
          {framing.ifThen && (
            <div className="text-[12.5px] leading-relaxed text-hld-yellow border-l-2 border-hld-yellow/50 pl-3 mt-[5px]">
              {framing.ifThen}
            </div>
          )}
        </div>
      )}

      <div>
        <BlockLabel pip="magenta">Last sentence you wrote{ago}</BlockLabel>
        {lastSentence ? (
          <div className="text-[13px] leading-relaxed text-white italic bg-hld-bgDeep border border-hld-border px-[13px] py-[11px]">
            “{lastSentence}”
          </div>
        ) : (
          <div className="text-[12px] text-hld-muted-text italic">This section is empty — you start fresh.</div>
        )}
      </div>

      <div>
        <BlockLabel pip="yellow">Fragments you wrote before · reattached</BlockLabel>
        {fragments.length > 0 ? (
          <div className="flex flex-col gap-[7px]">
            {fragments.map((f, i) => (
              <div
                key={i}
                className="flex gap-[9px] text-[11.5px] leading-snug text-hld-muted-text bg-hld-bgDeep border border-hld-border px-[10px] py-[8px]"
              >
                <Pip status="yellow" size="sm" className="mt-[4px]" />
                <span>
                  <b className="text-hld-text font-medium">{f.source}</b> — {f.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-hld-muted-text italic">No fragments reattached for this section.</div>
        )}
      </div>
    </div>
  );
}
