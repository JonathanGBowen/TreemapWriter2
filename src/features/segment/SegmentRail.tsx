import { useStore } from '../../state';
import { Pip, type PipStatus } from '../shared/Pip';
import type { SegmentLevelStatus } from '../../state/segment-state';

const PIP_FOR: Record<SegmentLevelStatus, PipStatus> = {
  idle: 'dim',
  generating: 'cyan',
  proposed: 'yellow',
  accepted: 'green',
  empty: 'dim',
  error: 'yellow',
};

const depthLabel = (depth: number, targetLevel: number): string =>
  depth === 0 ? 'Top level' : `Level ${targetLevel}`;

/**
 * The hierarchy ladder: one row per discovered level (top level → deeper), with a
 * status pip and the live cursor. A progress map, not a navigator — the descent is
 * forward-only, so rows above the cursor are accepted and rows below are pending.
 */
export function SegmentRail() {
  const levels = useStore((s) => s.segmentLevels);
  const cursor = useStore((s) => s.segmentCursor);
  const baseLevel = useStore((s) => s.baseLevel);

  const rowCount = Math.max(cursor + 1, levels.length);
  const rows = Array.from({ length: rowCount }, (_, depth) => depth);

  return (
    <div className="w-[210px] shrink-0 border-r border-hld-border bg-hld-surface-3 overflow-y-auto py-[10px]">
      <div className="px-[14px] pb-[8px] font-mono text-[9px] uppercase tracking-[0.16em] text-hld-muted-text">
        Hierarchy
      </div>
      <div className="flex flex-col">
        {rows.map((depth) => {
          const level = levels[depth];
          const status: SegmentLevelStatus = level?.status ?? 'idle';
          const current = depth === cursor;
          const pulse = status === 'generating';
          const targetLevel = level?.targetLevel ?? baseLevel + depth;
          const acceptedEdits = level ? level.edits.filter((e) => e.status === 'accepted').length : 0;
          return (
            <div
              key={depth}
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
                  {depthLabel(depth, targetLevel)}
                </div>
                {level && level.status !== 'idle' && (
                  <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-muted-text">
                    {level.status === 'empty'
                      ? 'whole — no seams'
                      : `${acceptedEdits} ${acceptedEdits === 1 ? 'edit' : 'edits'}`}
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
