import { useStore } from '../../state';
import type { ParallelRow } from '../../state/parallel-state';
import { OriginalCell, DraftBCell } from './DraftCell';
import { BulletCell } from './BulletCell';

const HEADERS = [
  { label: 'Original', tone: 'text-hld-muted-text' },
  { label: 'Reverse outline', tone: 'text-hld-cyan' },
  { label: 'Your outline', tone: 'text-hld-green' },
  { label: 'New draft', tone: 'text-hld-green' },
] as const;

/**
 * The four-column aligned view: draftA · outlineA · outlineB · draftB. ONE scroll
 * container wraps every row, so the columns move together and stay aligned by
 * paragraph block for free — the ParallelDiff trick, extended 2→4 cells. Each row
 * is a paragraph and its three companions.
 */
export function ParallelGrid({
  onAccept,
  onPersistOutline,
}: {
  onAccept: (row: ParallelRow) => void;
  onPersistOutline: () => void;
}) {
  const rows = useStore((s) => s.rows);
  const regeneratingIds = useStore((s) => s.regeneratingIds);
  const editOutlineA = useStore((s) => s.editOutlineA);
  const editOutlineB = useStore((s) => s.editOutlineB);
  const insertRowAfter = useStore((s) => s.insertRowAfter);
  const deleteRow = useStore((s) => s.deleteRow);
  const resetRow = useStore((s) => s.resetRow);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex border-b border-hld-border font-mono uppercase tracking-[0.14em] text-[9px] bg-hld-surface-2">
        {HEADERS.map((h, i) => (
          <div
            key={h.label}
            className={`flex-1 min-w-0 px-5 py-2 truncate ${h.tone} ${i < 3 ? 'border-r border-hld-border' : ''}`}
          >
            {h.label}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows.map((row) => {
          const prose = row.kind === 'prose';
          return (
            <div key={row.id} className="flex border-b border-hld-border/40 hover:bg-white/[0.012]">
              <OriginalCell text={row.draftA} />
              <BulletCell
                value={row.outlineA}
                editable={prose && row.status !== 'inserted'}
                accent="a"
                placeholder={row.status === 'inserted' ? '(new)' : 'distill this paragraph…'}
                onChange={(v) => editOutlineA(row.id, v)}
                onBlur={onPersistOutline}
              />
              <BulletCell
                value={row.outlineB}
                editable={prose}
                accent="b"
                status={row.status}
                placeholder="state what this paragraph should say…"
                onChange={(v) => editOutlineB(row.id, v)}
                onInsert={() => insertRowAfter(row.id)}
                onDelete={() => deleteRow(row.id)}
              />
              <DraftBCell
                row={row}
                regenerating={regeneratingIds.includes(row.id)}
                onAccept={onAccept}
                onReset={resetRow}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
