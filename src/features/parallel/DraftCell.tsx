import { Check, Loader2, RotateCcw } from 'lucide-react';
import type { ParallelRow } from '../../state/parallel-state';

const PROSE = 'font-serif text-[13px] leading-[1.6] whitespace-pre-wrap break-words';

/** Column 1 — the original paragraph, read-only reference. */
export function OriginalCell({ text }: { text: string }) {
  return (
    <div className="flex-1 min-w-0 px-5 py-3 border-r border-hld-border">
      {text ? (
        <p className={`${PROSE} text-hld-text/90`}>{text}</p>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text/50">
          (new — inserted point)
        </p>
      )}
    </div>
  );
}

/**
 * Column 4 — the regenerated draft (draftB). Per-row Glass-Box proposal: a changed
 * paragraph shows its rewrite (green) with Accept / Reject, a deletion shows the
 * struck original, an unchanged row recedes (it equals the original). Accept writes
 * the one paragraph through to the document; Reject (reset) drops the change.
 */
export function DraftBCell({
  row,
  regenerating,
  onAccept,
  onReset,
}: {
  row: ParallelRow;
  regenerating: boolean;
  onAccept: (row: ParallelRow) => void;
  onReset: (id: string) => void;
}) {
  const cell = 'flex-1 min-w-0 px-5 py-3 relative';

  if (regenerating) {
    return (
      <div className={cell}>
        <div className="flex items-center gap-2 text-hld-cyan/70 font-mono text-[10px] uppercase tracking-[0.12em]">
          <Loader2 size={12} className="animate-spin" />
          regenerating
        </div>
      </div>
    );
  }

  if (row.status === 'deleted') {
    return (
      <div className={`${cell} bg-hld-magenta/[0.05]`}>
        <p className={`${PROSE} text-hld-magenta/70 line-through`}>{row.draftA}</p>
        <Controls accent="magenta" acceptLabel="Apply deletion" onAccept={() => onAccept(row)} onReset={() => onReset(row.id)} />
      </div>
    );
  }

  if (row.status === 'edited' || (row.status === 'inserted' && row.draftB == null)) {
    return (
      <div className={cell}>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text/60">
          → regenerate to draft this {row.status === 'inserted' ? 'new point' : 'change'}
        </p>
      </div>
    );
  }

  if (row.status === 'error') {
    return (
      <div className={cell}>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-magenta/70">
          regeneration failed — left unchanged
        </p>
        <Controls accent="magenta" hideAccept onReset={() => onReset(row.id)} />
      </div>
    );
  }

  if (row.status === 'accepted') {
    return (
      <div className={cell}>
        <p className={`${PROSE} text-hld-text/60`}>{row.draftB}</p>
        <div className="mt-1.5 flex items-center gap-1 text-hld-green/70 font-mono text-[9px] uppercase tracking-[0.12em]">
          <Check size={11} /> applied
        </div>
      </div>
    );
  }

  if (row.status === 'regenerated') {
    return (
      <div className={`${cell} bg-hld-green/[0.05]`}>
        <p className={`${PROSE} text-hld-green`}>{row.draftB}</p>
        <Controls accent="green" acceptLabel="Accept" onAccept={() => onAccept(row)} onReset={() => onReset(row.id)} />
      </div>
    );
  }

  // unchanged — draftB equals draftA; recede so the eye skips it.
  return (
    <div className={cell}>
      <p className={`${PROSE} text-hld-muted-text/45`}>{row.draftB ?? row.draftA}</p>
    </div>
  );
}

function Controls({
  accent,
  acceptLabel,
  hideAccept,
  onAccept,
  onReset,
}: {
  accent: 'green' | 'magenta';
  acceptLabel?: string;
  hideAccept?: boolean;
  onAccept?: () => void;
  onReset: () => void;
}) {
  const acceptCls =
    accent === 'green'
      ? 'border-hld-green/40 text-hld-green hover:bg-hld-green/10'
      : 'border-hld-magenta/40 text-hld-magenta hover:bg-hld-magenta/10';
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {!hideAccept && (
        <button
          type="button"
          onClick={onAccept}
          className={`px-2 py-1 border font-mono text-[9px] uppercase tracking-[0.1em] transition-colors flex items-center gap-1 ${acceptCls}`}
        >
          <Check size={10} /> {acceptLabel ?? 'Accept'}
        </button>
      )}
      <button
        type="button"
        onClick={onReset}
        title="Reset to original"
        className="px-2 py-1 border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[9px] uppercase tracking-[0.1em] transition-colors flex items-center gap-1"
      >
        <RotateCcw size={10} /> reset
      </button>
    </div>
  );
}
