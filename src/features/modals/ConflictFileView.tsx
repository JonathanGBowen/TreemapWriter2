// Phase 5 — one conflicted file's resolution UI, used by ConflictResolutionModal.
//
// Three shapes:
//   text         — per-hunk LOCAL/REMOTE picker (from conflict-merge.ts), plus a
//                  whole-file shortcut and a manual-edit textarea escape hatch.
//   binary       — whole-file LOCAL/REMOTE pick (byte-exact, resolved by OID).
//   modifyDelete — keep the surviving side or accept the deletion (no default;
//                  deleting project.md asks for explicit confirmation).
//
// Reports the resolved choice up via onChange(path, Resolution | null); null
// means "still unresolved" and gates the modal's submit.

import React, { useEffect, useMemo, useState } from 'react';
import type { ConflictFile, Resolution } from '../../types';
import { conflictCount, hasUnresolvedMarkers, parseMergedText, reassemble } from './conflict-merge';

interface Props {
  file: ConflictFile;
  onChange: (path: string, resolution: Resolution | null) => void;
}

const PANE = 'whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed p-2 max-h-48 overflow-auto';

export const ConflictFileView: React.FC<Props> = ({ file, onChange }) => {
  const segments = useMemo(
    () => (file.kind === 'text' && file.merged != null ? parseMergedText(file.merged) : []),
    [file],
  );
  const total = conflictCount(segments);

  const [choices, setChoices] = useState<Array<'ours' | 'theirs' | null>>(
    () => new Array(total).fill(null),
  );
  const [mode, setMode] = useState<'choose' | 'edit'>('choose');
  const [editText, setEditText] = useState<string>(file.merged ?? '');
  const [selected, setSelected] = useState<'ours' | 'theirs' | 'delete' | null>(null);

  // A text file that git2 flagged but diffy merged cleanly has no hunks to
  // pick — auto-resolve it to the (marker-free) merged content so it doesn't
  // block submit.
  useEffect(() => {
    if (file.kind === 'text' && file.merged != null && total === 0) {
      onChange(file.path, { kind: 'content', path: file.path, text: file.merged });
    }
  }, [file, total, onChange]);

  // --- text resolution ---
  const reportText = (next: Array<'ours' | 'theirs' | null>) => {
    if (next.some((c) => c === null)) return onChange(file.path, null);
    const filled = next as Array<'ours' | 'theirs'>;
    if (filled.every((c) => c === 'ours')) return onChange(file.path, { kind: 'ours', path: file.path });
    if (filled.every((c) => c === 'theirs')) return onChange(file.path, { kind: 'theirs', path: file.path });
    onChange(file.path, { kind: 'content', path: file.path, text: reassemble(segments, filled) });
  };
  const pick = (idx: number, side: 'ours' | 'theirs') => {
    const next = choices.slice();
    next[idx] = side;
    setChoices(next);
    reportText(next);
  };
  const pickAll = (side: 'ours' | 'theirs') => {
    const next = new Array(total).fill(side) as Array<'ours' | 'theirs'>;
    setChoices(next);
    setMode('choose');
    reportText(next);
  };
  const onEdit = (text: string) => {
    setEditText(text);
    onChange(file.path, hasUnresolvedMarkers(text) ? null : { kind: 'content', path: file.path, text });
  };
  const toggleMode = () => {
    if (mode === 'choose') {
      setMode('edit');
      onEdit(editText);
    } else {
      setMode('choose');
      reportText(choices);
    }
  };

  // --- whole-file (binary) / modify-delete resolution ---
  const chooseWhole = (side: 'ours' | 'theirs') => {
    setSelected(side);
    onChange(file.path, { kind: side, path: file.path });
  };
  const survivingSide: 'ours' | 'theirs' = file.ourDeleted ? 'theirs' : 'ours';
  const acceptDelete = () => {
    setSelected('delete');
    onChange(file.path, { kind: 'delete', path: file.path });
  };

  const sideBtn = (active: boolean, accent: string) =>
    `px-3 py-1.5 border text-[10px] font-mono uppercase tracking-[0.1em] transition-colors ${
      active ? `${accent} text-hld-bg` : 'bg-transparent text-hld-text border-hld-border hover:bg-hld-surface-2'
    }`;

  return (
    <div className="border border-hld-border bg-hld-surface">
      <div className="flex items-center justify-between p-2 border-b border-hld-border bg-hld-surface-2">
        <span className="font-mono text-[11px] text-hld-text break-all">{file.path}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text">{file.kind}</span>
      </div>

      {file.kind === 'text' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 p-2 border-b border-hld-border">
            <button onClick={() => pickAll('ours')} className={sideBtn(false, 'bg-hld-cyan border-hld-cyan')}>
              Use LOCAL
            </button>
            <button onClick={() => pickAll('theirs')} className={sideBtn(false, 'bg-hld-magenta border-hld-magenta')}>
              Use REMOTE
            </button>
            <button onClick={toggleMode} className={sideBtn(mode === 'edit', 'bg-hld-yellow border-hld-yellow')}>
              {mode === 'edit' ? 'Back to hunks' : 'Edit manually'}
            </button>
          </div>

          {mode === 'edit' ? (
            <textarea
              value={editText}
              onChange={(e) => onEdit(e.target.value)}
              spellCheck={false}
              className={`${PANE} bg-hld-bg text-hld-text border-0 focus:outline-none w-full h-48 resize-y`}
            />
          ) : (
            <div className="flex flex-col">
              {segments.map((seg, i) =>
                seg.kind === 'stable' ? (
                  seg.lines.join('\n').trim() === '' ? null : (
                    <pre key={i} className={`${PANE} text-hld-muted-text bg-hld-bg`}>{seg.lines.join('\n')}</pre>
                  )
                ) : (
                  <ConflictHunkRow
                    key={i}
                    index={hunkIndex(segments, i)}
                    ours={seg.ours.join('\n')}
                    theirs={seg.theirs.join('\n')}
                    choice={choices[hunkIndex(segments, i)]}
                    onPick={pick}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}

      {file.kind === 'binary' && (
        <div className="flex items-center gap-2 p-3">
          <span className="text-[11px] text-hld-muted-text font-mono flex-1">
            Binary / non-text file — pick one side wholesale.
          </span>
          <button onClick={() => chooseWhole('ours')} className={sideBtn(selected === 'ours', 'bg-hld-cyan border-hld-cyan')}>
            Use LOCAL
          </button>
          <button onClick={() => chooseWhole('theirs')} className={sideBtn(selected === 'theirs', 'bg-hld-magenta border-hld-magenta')}>
            Use REMOTE
          </button>
        </div>
      )}

      {file.kind === 'modifyDelete' && (
        <div className="flex items-center gap-2 p-3">
          <span className="text-[11px] text-hld-muted-text font-mono flex-1">
            {file.ourDeleted ? 'You deleted this; remote modified it.' : 'Remote deleted this; you modified it.'}
          </span>
          <button
            onClick={() => chooseWhole(survivingSide)}
            className={sideBtn(selected === survivingSide, 'bg-hld-cyan border-hld-cyan')}
          >
            Keep file
          </button>
          <button onClick={acceptDelete} className={sideBtn(selected === 'delete', 'bg-hld-magenta border-hld-magenta')}>
            Delete file
          </button>
        </div>
      )}
    </div>
  );
};

/** Map a segment index to its conflict-hunk ordinal (for the choices array). */
function hunkIndex(segments: ReturnType<typeof parseMergedText>, segIndex: number): number {
  let n = 0;
  for (let i = 0; i < segIndex; i++) if (segments[i].kind === 'conflict') n++;
  return n;
}

const ConflictHunkRow: React.FC<{
  index: number;
  ours: string;
  theirs: string;
  choice: 'ours' | 'theirs' | null;
  onPick: (idx: number, side: 'ours' | 'theirs') => void;
}> = ({ index, ours, theirs, choice, onPick }) => (
  <div className="grid grid-cols-2 border-t border-hld-border">
    <button
      onClick={() => onPick(index, 'ours')}
      className={`text-left border-r border-hld-border ${choice === 'ours' ? 'bg-hld-cyan/15' : 'hover:bg-hld-surface-2'}`}
    >
      <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-hld-cyan px-2 pt-1">LOCAL</div>
      <pre className={`${PANE} text-hld-text`}>{ours || '∅'}</pre>
    </button>
    <button
      onClick={() => onPick(index, 'theirs')}
      className={`text-left ${choice === 'theirs' ? 'bg-hld-magenta/15' : 'hover:bg-hld-surface-2'}`}
    >
      <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-hld-magenta px-2 pt-1">REMOTE</div>
      <pre className={`${PANE} text-hld-text`}>{theirs || '∅'}</pre>
    </button>
  </div>
);
