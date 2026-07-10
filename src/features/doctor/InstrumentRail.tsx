import { useStore } from '../../state';
import type { DoctorInstrument } from '../../state/doctor-state';
import { useDoctorActions } from './use-doctor-actions';
import { sourceHashOf } from '../../lib/parallel-helpers';
import { doctorScopeFromState } from './use-doctor-scope';

/** The seven instruments, grouped as the ported app grouped them. */
const GROUPS: { title: string; items: { id: DoctorInstrument; glyph: string; label: string; fine: string }[] }[] = [
  {
    title: 'Reverse outline',
    items: [
      { id: 'claims', glyph: '≔', label: 'Claims outline', fine: 'one ≤70-char claim per ¶' },
      { id: 'saysDoes', glyph: '⇄', label: 'Says / Does', fine: 'content vs function, per ¶' },
      { id: 'thesisCheck', glyph: '⊢', label: 'Thesis check', fine: 'supports the thesis? per ¶' },
    ],
  },
  {
    title: 'Outline diagnostics',
    items: [
      { id: 'flow', glyph: '⇢', label: 'Logical flow', fine: 'weak / abrupt transitions' },
      { id: 'redundancy', glyph: '≡', label: 'Redundancy', fine: 'repeats · monster ¶s' },
      { id: 'gaps', glyph: '?', label: 'Gap finder', fine: 'self-ask stress test' },
    ],
  },
  {
    title: 'One paragraph',
    items: [{ id: 'paragraph', glyph: '¶', label: 'Saying vs doing', fine: 'a single ¶, diagnosed' }],
  },
];

const isRow = (i: DoctorInstrument) => i === 'claims' || i === 'saysDoes' || i === 'thesisCheck';
const isReport = (i: DoctorInstrument) => i === 'flow' || i === 'redundancy' || i === 'gaps';

/** Left rail: pick an instrument, run it. */
export function InstrumentRail() {
  const instrument = useStore((s) => s.doctorInstrument);
  const setInstrument = useStore((s) => s.setDoctorInstrument);
  const status = useStore((s) => s.doctorStatus);
  const reverseOutlines = useStore((s) => s.reverseOutlines);
  const targetId = useStore((s) => s.doctorTargetId);
  const { runRows, runReport } = useDoctorActions();

  const busy = status === 'running' || status === 'streaming';

  // A quiet cross-link, not a data merge: the Parallel editor's persisted
  // outline is an editing substrate; the Doctor never writes it.
  const parallelScopeKey = targetId ?? 'root';
  const hasParallelOutline = reverseOutlines.some((d) => {
    if (d.scopeKey !== parallelScopeKey) return false;
    const s = useStore.getState();
    return d.sourceHash === sourceHashOf(doctorScopeFromState(s)?.text ?? '');
  });

  const run = () => {
    if (isRow(instrument)) void runRows(instrument);
    else if (isReport(instrument)) void runReport(instrument);
    // 'paragraph' runs from its own panel (pick a ¶ first).
  };

  return (
    <div className="w-[230px] shrink-0 border-r border-hld-border bg-hld-surface/40 flex flex-col overflow-y-auto">
      <div className="p-3 flex flex-col gap-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="font-mono uppercase tracking-[0.14em] text-[8px] text-hld-muted-text mb-1.5">
              {g.title}
            </div>
            <div className="flex flex-col gap-1">
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setInstrument(it.id)}
                  aria-pressed={instrument === it.id}
                  className={`text-left px-2.5 py-2 border transition-all ${
                    instrument === it.id
                      ? 'border-hld-cyan/60 bg-hld-cyan/8 text-hld-text'
                      : 'border-transparent text-hld-muted-text hover:text-hld-text hover:border-hld-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={instrument === it.id ? 'text-hld-cyan' : ''}>{it.glyph}</span>
                    <span className="font-mono uppercase tracking-[0.12em] text-[9px] font-bold">{it.label}</span>
                  </div>
                  <div className="font-mono text-[8px] text-hld-muted-text mt-0.5 pl-5">{it.fine}</div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {instrument !== 'paragraph' && (
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="hld-lit px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait"
          >
            {busy ? 'Reading…' : 'Run reading'}
          </button>
        )}

        {hasParallelOutline && (
          <div className="font-mono text-[8px] text-hld-muted-text leading-[1.6] border-t border-hld-border pt-2">
            A Parallel outline exists for this scope — ▥ Parallel opens it for editing.
          </div>
        )}
      </div>
    </div>
  );
}
