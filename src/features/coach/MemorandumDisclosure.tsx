import React, { useState } from 'react';
import { useStore } from '../../state';
import { MEMORANDUM_CAP } from '../../state/document-state';

/**
 * The Memorandum — one capped, plain-markdown note of the writer's standing
 * intent (docs/dialogue-design.md §IV). Edited in place. Whatever is shown here
 * is exactly what any dialogue/coach prompt receives — the symmetry rule made
 * visible. Near-zero footprint until first use: an empty, unopened memorandum
 * renders only a single ghost line to begin one (no panel, no nag).
 */
export const MemorandumDisclosure: React.FC = () => {
  const memorandum = useStore((s) => s.memorandum);
  const setMemorandum = useStore((s) => s.setMemorandum);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const [open, setOpen] = useState(false);

  const persist = () => void saveCurrentState().catch(() => {});
  const remaining = MEMORANDUM_CAP - memorandum.length;

  // Empty and unopened: a single quiet line, no container — the feature stays
  // out of the way until the writer (or an accepted proposal) first fills it.
  if (!memorandum.trim() && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Note a standing intent the AI should honor — a decision, an open question, a don't-suggest veto"
        className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text/70 hover:text-hld-cyan transition-colors"
      >
        ＋ memorandum
      </button>
    );
  }

  return (
    <div className="w-full max-w-[320px] border border-hld-border/60 bg-hld-surface-2/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-[7px] px-[10px] py-[8px] font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan transition-colors"
        title="Standing intent the AI honors — decisions, open questions, don't-suggest vetoes"
      >
        <span aria-hidden className="w-[5px] h-[5px] rotate-45 bg-hld-muted-text/60 shrink-0" />
        <span>Memorandum</span>
        {!open && memorandum.trim() && (
          <span className="ml-1 normal-case tracking-normal text-hld-muted-text-2 truncate">
            · {memorandum.trim().slice(0, 40)}{memorandum.trim().length > 40 ? '…' : ''}
          </span>
        )}
        <span aria-hidden className={`ml-auto text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && (
        <div className="px-[10px] pb-[10px] flex flex-col gap-[6px]">
          <textarea
            value={memorandum}
            maxLength={MEMORANDUM_CAP}
            onChange={(e) => setMemorandum(e.target.value)}
            onBlur={persist}
            rows={4}
            placeholder="Standing intent about the work — e.g. “ch. 2 framing is settled; don't suggest splitting §4.”"
            className="w-full bg-hld-bg border border-hld-border px-2 py-1.5 font-sans text-[12px] leading-relaxed text-hld-text placeholder:text-hld-muted-text/50 focus:border-hld-cyan/50 focus:outline-none resize-none"
          />
          <div className="text-right font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted-text">
            {remaining} left
          </div>
        </div>
      )}
    </div>
  );
};
