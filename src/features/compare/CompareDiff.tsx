import { useMemo, useState } from 'react';
import { diffLines, diffWords, type Change } from 'diff';
import { useStore } from '../../state';
import { SegControl } from '../modals/SegControl';
import { operandFor } from './use-comparison-actions';

/**
 * The textual diff between the two selected versions — the same green/magenta
 * unified diff the Version History modal shows, lifted here and given a
 * line/word granularity toggle. A is the earlier draft, B the later one.
 */
export function CompareDiff() {
  const revisions = useStore((s) => s.revisions);
  const localContent = useStore((s) => s.localContent);
  const versionAId = useStore((s) => s.versionAId);
  const versionBId = useStore((s) => s.versionBId);
  const [mode, setMode] = useState(0); // 0 = lines, 1 = words

  const a = operandFor(versionAId, revisions, localContent);
  const b = operandFor(versionBId, revisions, localContent);

  const diff = useMemo<Change[] | null>(() => {
    if (!a || !b) return null;
    return mode === 0 ? diffLines(a.markdown, b.markdown) : diffWords(a.markdown, b.markdown);
  }, [a, b, mode]);

  return (
    <>
      <div className="shrink-0 px-4 py-3 border-b border-hld-border bg-hld-surface2 flex items-center gap-3">
        <div className="font-mono uppercase tracking-[0.14em] text-[10px] text-hld-muted-text flex items-center gap-2 min-w-0">
          <span className="text-hld-magenta truncate">{a?.label ?? '—'}</span>
          <span>→</span>
          <span className="text-hld-green truncate">{b?.label ?? '—'}</span>
        </div>
        <div className="ml-auto w-[180px]">
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
      </div>

      <div className="flex-1 overflow-y-auto p-6 font-mono text-[13px] whitespace-pre-wrap leading-relaxed">
        {!diff ? (
          <div className="text-hld-muted-text text-[10px] uppercase tracking-[0.14em]">
            One of the selected versions is unavailable.
          </div>
        ) : diff.length === 1 && !diff[0].added && !diff[0].removed ? (
          <div className="text-hld-muted-text text-[10px] uppercase tracking-[0.14em]">
            No textual differences between these versions.
          </div>
        ) : (
          diff.map((part, i) => (
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
          ))
        )}
      </div>
    </>
  );
}
