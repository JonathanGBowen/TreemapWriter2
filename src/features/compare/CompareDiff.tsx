import { useMemo, useState } from 'react';
import { diffLines, diffWords, type Change } from 'diff';
import { useStore } from '../../state';
import { SegControl } from '../modals/SegControl';
import { resolveOperand } from '../../lib/compareHelpers';
import { ParallelDiff } from './ParallelDiff';

/** The unified (single-column) green/magenta diff — added green, removed magenta
 *  struck through, unchanged muted. Shows a calm note when the versions match. */
function UnifiedDiff({ diff }: { diff: Change[] }) {
  if (diff.length === 1 && !diff[0].added && !diff[0].removed) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-hld-muted-text text-[10px] uppercase tracking-[0.14em]">
          No textual differences between these versions.
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-6 font-mono text-[13px] whitespace-pre-wrap leading-relaxed">
      {diff.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? 'bg-hld-green/20 text-hld-green px-0.5 rounded'
              : part.removed
                ? 'bg-hld-magenta/20 text-hld-magenta line-through opacity-70 px-0.5 rounded'
                : 'text-hld-muted'
          }
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}

/**
 * The textual diff between the two selected versions — the same green/magenta
 * unified diff the Version History modal shows, lifted here and given a
 * line/word granularity toggle plus a Unified/Parallel view toggle. A is the
 * earlier draft, B the later one. Operands resolve from the lazily-loaded
 * snapshots (`loadedA`/`loadedB`); a deep version shows a brief loading state
 * until its content arrives. Parallel view always diffs by line (rows align by
 * line), so the granularity toggle is unified-only.
 */
export function CompareDiff() {
  const localContent = useStore((s) => s.localContent);
  const versionAId = useStore((s) => s.versionAId);
  const versionBId = useStore((s) => s.versionBId);
  const loadedA = useStore((s) => s.loadedA);
  const loadedB = useStore((s) => s.loadedB);
  const [mode, setMode] = useState(0); // 0 = lines, 1 = words
  const [parallel, setParallel] = useState(false); // off by default

  const a = resolveOperand(versionAId, loadedA, localContent);
  const b = resolveOperand(versionBId, loadedB, localContent);
  const aLabel = a?.label ?? '—';
  const bLabel = b?.label ?? '—';

  const diff = useMemo<Change[] | null>(() => {
    if (!a || !b) return null;
    // Parallel view aligns row-by-row on lines, so it forces line granularity.
    return parallel || mode === 0
      ? diffLines(a.markdown, b.markdown)
      : diffWords(a.markdown, b.markdown);
  }, [a?.markdown, b?.markdown, mode, parallel]);

  return (
    <>
      <div className="shrink-0 px-4 py-3 border-b border-hld-border bg-hld-surface-2 flex items-center gap-3">
        <div className="font-mono uppercase tracking-[0.14em] text-[10px] text-hld-muted-text flex items-center gap-2 min-w-0">
          <span className="text-hld-magenta truncate">{aLabel}</span>
          <span>→</span>
          <span className="text-hld-green truncate">{bLabel}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {!parallel && (
            <div className="w-[180px]">
              <SegControl
                ariaLabel="Diff granularity"
                value={mode}
                onChange={setMode}
                options={[
                  { glyph: '≡', label: 'Lines' },
                  { glyph: '··', label: 'Words' },
                ]}
              />
            </div>
          )}
          <div className="w-[180px]">
            <SegControl
              ariaLabel="Diff view"
              value={parallel ? 1 : 0}
              onChange={(i) => setParallel(i === 1)}
              options={[
                { glyph: '▤', label: 'Unified' },
                { glyph: '║', label: 'Parallel' },
              ]}
            />
          </div>
        </div>
      </div>

      {!diff ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-hld-muted-text text-[10px] uppercase tracking-[0.14em]">Loading version…</div>
        </div>
      ) : parallel ? (
        <ParallelDiff diff={diff} aLabel={aLabel} bLabel={bLabel} />
      ) : (
        <UnifiedDiff diff={diff} />
      )}
    </>
  );
}
