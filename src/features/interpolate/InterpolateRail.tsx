import { useStore } from '../../state';
import { Pip, type PipStatus } from '../shared/Pip';
import type { StageStatus } from '../../state/interpolation-state';

/** Stage status → the shared pip vocabulary. */
const PIP_FOR: Record<StageStatus, PipStatus> = {
  idle: 'dim',
  generating: 'cyan',
  streaming: 'cyan',
  proposed: 'yellow',
  accepted: 'green',
  error: 'magenta',
};

/**
 * The hierarchy ladder: one row per stage (root → chapters → deeper levels), with a
 * status pip and the live cursor. A progress map, not a navigator — the walk is
 * forward-only, so rows above the cursor are accepted and rows below are pending.
 */
export function InterpolateRail() {
  const stages = useStore((s) => s.interpStages);
  const cursor = useStore((s) => s.stageCursor);
  const stageWork = useStore((s) => s.stageWork);

  return (
    <div className="w-[210px] shrink-0 border-r border-hld-border bg-[#080d13] overflow-y-auto py-[10px]">
      <div className="px-[14px] pb-[8px] font-mono text-[9px] uppercase tracking-[0.16em] text-hld-muted-text">
        Hierarchy
      </div>
      <div className="flex flex-col">
        {stages.map((st, i) => {
          const status = stageWork[st.id]?.status ?? 'idle';
          const current = i === cursor;
          const pulse = status === 'generating' || status === 'streaming';
          return (
            <div
              key={st.id}
              className={`flex items-center gap-[9px] px-[14px] py-[9px] border-l-2 ${
                current ? 'border-hld-cyan bg-hld-cyan/5' : 'border-transparent'
              }`}
            >
              <Pip status={current && status === 'idle' ? 'cyan' : PIP_FOR[status]} pulse={pulse} />
              <div className="min-w-0">
                <div
                  className={`font-mono text-[10px] tracking-[0.08em] truncate ${
                    current ? 'text-hld-text font-bold' : 'text-hld-muted-text-2'
                  }`}
                >
                  {st.label}
                </div>
                {st.kind === 'level' && (
                  <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-muted-text">
                    {st.nodeIds.length} {st.nodeIds.length === 1 ? 'section' : 'sections'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
