import { useStore } from '../../state';
import { Spinner } from '../shared/Spinner';
import { doctorScopeFromState } from './use-doctor-scope';
import { useDoctorActions } from './use-doctor-actions';

/** First line of a block, trimmed for the picker list. */
const excerpt = (text: string, len = 110): string => {
  const first = text.trim().split('\n')[0];
  return first.length > len ? `${first.slice(0, len)}…` : first;
};

/**
 * The single-paragraph Saying-vs-Doing instrument: pick a prose ¶ from the
 * scope on the left, its SAYS / DOES / Coherence Check card renders on the
 * right. The ported PARAGRAPH_DIAGNOSTIC, pointed at the live document instead
 * of a paste box.
 */
export function ParagraphDiagnostic() {
  const blocks = useStore((s) => doctorScopeFromState(s)?.blocks ?? []);
  const pickedIndex = useStore((s) => s.doctorParagraphIndex);
  const diag = useStore((s) => s.doctorParagraphDiag);
  const status = useStore((s) => s.doctorStatus);
  const { runParagraph, revealBlock } = useDoctorActions();

  const busy = status === 'running' || status === 'streaming';
  const prose = blocks.filter((b) => b.kind === 'prose');

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-[46%] min-w-[280px] border-r border-hld-border overflow-y-auto">
        <div className="px-3 py-2 font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text border-b border-hld-border sticky top-0 bg-hld-surface-3">
          Pick a paragraph ({prose.length})
        </div>
        {prose.map((b) => (
          <button
            key={b.index}
            type="button"
            disabled={busy}
            onClick={() => void runParagraph(b.index)}
            aria-pressed={pickedIndex === b.index}
            className={`w-full text-left px-3 py-2 border-b border-hld-border/50 transition-colors flex items-start gap-2.5 ${
              pickedIndex === b.index ? 'bg-hld-cyan/8 border-l-2 border-l-hld-cyan' : 'hover:bg-hld-cyan/5'
            } disabled:opacity-60`}
          >
            <span className="font-mono text-[9px] text-hld-muted-text shrink-0 w-6 text-right">{b.index + 1}</span>
            <span className="font-sans text-[11.5px] text-slate-400 leading-snug">{excerpt(b.text)}</span>
          </button>
        ))}
        {prose.length === 0 && (
          <div className="px-4 py-8 font-mono text-[9px] text-hld-muted-text text-center">
            No prose paragraphs in this scope yet.
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {busy && pickedIndex != null ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Spinner />
            <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">
              Consulting the Logician…
            </div>
          </div>
        ) : diag && pickedIndex != null ? (
          <div className="mx-auto max-w-[640px] px-6 py-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => revealBlock(pickedIndex)}
              className="text-left font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text hover:text-hld-cyan transition-colors"
              title="Open in the editor at this paragraph"
            >
              ¶ {pickedIndex + 1} — open in the editor ↗
            </button>
            <div className="border border-hld-border">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-4 md:border-r border-b md:border-b-0 border-hld-border">
                  <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan mb-2">
                    What it SAYS
                  </div>
                  <div className="font-sans text-[12.5px] text-slate-300 leading-relaxed">{diag.says}</div>
                </div>
                <div className="p-4">
                  <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan mb-2">
                    What it DOES
                  </div>
                  <div className="font-sans text-[12.5px] text-slate-300 leading-relaxed">{diag.does}</div>
                </div>
              </div>
              <div className="p-4 border-t border-hld-border bg-hld-surface/60">
                <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text mb-2">
                  Coherence check
                </div>
                <div className="font-sans text-[12px] text-slate-300 leading-relaxed">{diag.coherence}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full px-8 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text leading-[1.8] max-w-[380px]">
              Pick a paragraph on the left — the Logician separates what it says from what it does.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
