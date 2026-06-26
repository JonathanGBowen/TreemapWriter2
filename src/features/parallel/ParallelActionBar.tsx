import { Check, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { useStore } from '../../state';
import { changedRows, rowsNeedingRegen, type ParallelRow } from '../../state/parallel-state';

const acceptable = (r: ParallelRow): boolean =>
  r.status === 'regenerated' || r.status === 'deleted' || (r.status === 'inserted' && r.draftB != null);

/**
 * The bottom action bar (config/actions live here, not in a fifth column):
 * Generate outline · Regenerate changed · Accept all · Reset all. Counts are
 * derived from the rows so the bar reflects exactly what each action will touch.
 */
export function ParallelActionBar({
  onGenerateOutline,
  onRegenerate,
  onAcceptAll,
  onResetAll,
}: {
  onGenerateOutline: () => void;
  onRegenerate: () => void;
  onAcceptAll: () => void;
  onResetAll: () => void;
}) {
  const rows = useStore((s) => s.rows);
  const busy = useStore((s) => s.isProcessing);

  const needsOutline = rows.some((r) => r.kind === 'prose' && !r.outlineA.trim() && r.status !== 'inserted');
  const toRegen = rowsNeedingRegen(rows).filter((r) => r.draftB == null || r.status === 'inserted').length;
  const acceptCount = rows.filter(acceptable).length;
  const dirty = changedRows(rows).length > 0;

  const proseCount = rows.filter((r) => r.kind === 'prose').length;

  return (
    <div className="shrink-0 h-[52px] border-t border-hld-border bg-hld-surface-2 flex items-center gap-2 px-4">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text">
        {proseCount} paragraph{proseCount === 1 ? '' : 's'}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {needsOutline && (
          <button
            type="button"
            disabled={busy}
            onClick={onGenerateOutline}
            className="hld-lit px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles size={12} /> Generate outline
          </button>
        )}

        <button
          type="button"
          disabled={busy || toRegen === 0}
          onClick={onRegenerate}
          title="Regenerate the paragraphs whose outline you changed"
          className="px-3 py-1.5 border border-hld-cyan/40 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] flex items-center gap-1.5 disabled:opacity-40 disabled:border-hld-border disabled:text-hld-muted-text transition-colors"
        >
          <RefreshCw size={12} /> Regenerate{toRegen ? ` (${toRegen})` : ''}
        </button>

        <button
          type="button"
          disabled={busy || acceptCount === 0}
          onClick={onAcceptAll}
          title="Apply every ready change to your document (one undo reverts all)"
          className="px-3 py-1.5 border border-hld-green/40 text-hld-green hover:bg-hld-green/10 font-mono text-[10px] uppercase tracking-[0.12em] flex items-center gap-1.5 disabled:opacity-40 disabled:border-hld-border disabled:text-hld-muted-text transition-colors"
        >
          <Check size={12} /> Accept all{acceptCount ? ` (${acceptCount})` : ''}
        </button>

        <button
          type="button"
          disabled={!dirty}
          onClick={onResetAll}
          title="Reset every changed point to the original"
          className="px-3 py-1.5 border border-hld-border text-hld-muted-text hover:text-hld-text font-mono text-[10px] uppercase tracking-[0.12em] flex items-center gap-1.5 disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={12} /> Reset all
        </button>
      </div>
    </div>
  );
}
