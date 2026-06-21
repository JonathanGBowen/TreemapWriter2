import type { Change } from 'diff';
import { buildAlignedRows, type DiffCell } from '../../lib/compareHelpers';

/**
 * The parallel (side-by-side) diff view. A row-aligned split of the same
 * green/magenta diff the unified view shows: version A on the left (removals
 * magenta), version B on the right (additions green), unchanged text muted and
 * exactly beside itself. One scroll container wraps every row, so the columns
 * move together and stay aligned for free — no scroll-sync needed. Consumes the
 * line-level `Change[]` already memoized in CompareDiff (props only, no store).
 */
function Cell({ cell, side }: { cell: DiffCell; side: 'left' | 'right' }) {
  const base = `flex-1 min-w-0 px-6 whitespace-pre-wrap ${side === 'left' ? 'border-r border-hld-border' : ''}`;
  if (!cell) {
    // Blank gutter — the line exists only on the other side. A faint tint reads
    // as "nothing here" without competing with the real content.
    return <div className={`${base} ${side === 'left' ? 'bg-hld-magenta/5' : 'bg-hld-green/5'}`} />;
  }
  const tone =
    cell.kind === 'added'
      ? 'bg-hld-green/20 text-hld-green'
      : cell.kind === 'removed'
        ? 'bg-hld-magenta/20 text-hld-magenta'
        : 'text-hld-muted';
  // A non-breaking space keeps an empty (but present) line at full row height.
  return <div className={`${base} ${tone}`}>{cell.text === '' ? ' ' : cell.text}</div>;
}

export function ParallelDiff({ diff, aLabel, bLabel }: { diff: Change[]; aLabel: string; bLabel: string }) {
  const rows = buildAlignedRows(diff);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex border-b border-hld-border font-mono uppercase tracking-[0.14em] text-[9px]">
        <div className="flex-1 min-w-0 px-6 py-2 border-r border-hld-border text-hld-magenta truncate">{aLabel}</div>
        <div className="flex-1 min-w-0 px-6 py-2 text-hld-green truncate">{bLabel}</div>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[13px] leading-relaxed">
        {rows.map((row, i) => (
          <div key={i} className="flex">
            <Cell cell={row.left} side="left" />
            <Cell cell={row.right} side="right" />
          </div>
        ))}
      </div>
    </div>
  );
}
