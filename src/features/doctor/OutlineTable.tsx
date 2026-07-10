import { useStore } from '../../state';
import { CopyButton } from '../shared/CopyButton';
import { formatOutlineData, formatOutlineMarkdown } from '../../lib/doctor-helpers';
import type { CoherenceRow, DoctorRowInstrument, DoctorVerdict } from '../../types';
import { useDoctorActions } from './use-doctor-actions';

const TITLE: Record<DoctorRowInstrument, string> = {
  claims: 'Reverse Outline',
  saysDoes: 'Functional Reverse Outline',
  thesisCheck: 'Thesis Coherence Check',
};

/** Verdict pip. Palette 3C: green = done/supports, yellow = THE alert (a claim
 *  that fails the thesis), muted = weakly (thin, not yet an alert). */
function VerdictPip({ verdict }: { verdict: DoctorVerdict | undefined }) {
  if (!verdict) return <span className="text-hld-muted-text">—</span>;
  const cls =
    verdict === 'yes'
      ? 'text-hld-green border-hld-green/40 bg-hld-green/10'
      : verdict === 'weakly'
        ? 'text-hld-muted-text border-hld-border bg-hld-surface'
        : 'text-hld-yellow border-hld-yellow/40 bg-hld-yellow/10';
  return (
    <span className={`inline-block px-1.5 py-0.5 border font-mono text-[8px] uppercase tracking-[0.12em] ${cls}`}>
      {verdict}
    </span>
  );
}

const MISSING = (
  <span className="italic text-hld-yellow/80">the model skipped this ¶ — rerun to fill it</span>
);

/**
 * The three row instruments' shared view. Every row is a door back into the
 * prose: clicking it lands the editor caret on that paragraph (the concrete-
 * operation law — a reading is only useful attached to the live document).
 * Headings render as dividers; a blank row is flagged, never hidden.
 */
export function OutlineTable({ instrument }: { instrument: DoctorRowInstrument }) {
  const thesis = useStore((s) => s.doctorThesis);
  const outlineRows = useStore((s) => s.doctorOutlineRows);
  const saysDoesRows = useStore((s) => s.doctorSaysDoesRows);
  const coherenceRows = useStore((s) => s.doctorCoherenceRows);
  const { revealBlock } = useDoctorActions();

  const copyText =
    instrument === 'claims' && outlineRows
      ? formatOutlineMarkdown(outlineRows, thesis)
      : instrument === 'thesisCheck' && coherenceRows
        ? formatOutlineData(coherenceRows)
        : instrument === 'saysDoes' && saysDoesRows
          ? saysDoesRows
              .filter((r) => r.kind === 'prose')
              .map((r) => `| ${r.index + 1} | ${r.says} | ${r.does} |`)
              .join('\n')
          : '';

  const rows =
    instrument === 'claims' ? outlineRows : instrument === 'saysDoes' ? saysDoesRows : coherenceRows;
  if (!rows) return null;

  const rowButton = (index: number, children: React.ReactNode, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => revealBlock(index)}
      title="Open in the editor at this paragraph"
      className="w-full text-left px-3 py-2 border-b border-hld-border/60 hover:bg-hld-cyan/5 transition-colors flex items-start gap-3 group"
    >
      <span className="font-mono text-[9px] text-hld-muted-text group-hover:text-hld-cyan shrink-0 w-7 text-right pt-0.5">
        {index + 1}
      </span>
      {children}
    </button>
  );

  return (
    <>
      <div className="relative px-4 py-3 border-b border-hld-border shrink-0 flex items-center justify-between gap-3">
        <div className="absolute top-0 left-0 right-0 h-px bg-hld-cyan shadow-[0_0_12px_var(--color-hld-cyan)]" />
        <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          {TITLE[instrument]}
        </div>
        {copyText && <CopyButton text={copyText} label="Copy" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[820px] px-4 py-4">
          {instrument === 'claims' && thesis.trim() && (
            <div className="px-3 py-2 mb-2 border border-hld-border bg-hld-surface font-sans text-[12px] text-slate-300">
              <span className="font-mono uppercase tracking-[0.12em] text-[8px] text-hld-muted-text mr-2">Thesis</span>
              {thesis}
            </div>
          )}
          {rows.map((r) => {
            if (r.kind !== 'prose') {
              const text = instrument === 'claims' ? (r as { claim: string }).claim
                : instrument === 'saysDoes' ? (r as { says: string }).says
                : (r as CoherenceRow).claim;
              return (
                <div key={r.index} className="px-3 pt-4 pb-1 font-mono text-[10px] text-hld-magenta/90 tracking-wide">
                  {text.replace(/^#+\s*/, '')}
                </div>
              );
            }
            if (instrument === 'claims') {
              const claim = (r as { claim: string }).claim;
              return rowButton(
                r.index,
                <span className="font-sans text-[12.5px] text-slate-300 leading-relaxed">{claim || MISSING}</span>,
                `c-${r.index}`,
              );
            }
            if (instrument === 'saysDoes') {
              const row = r as { says: string; does: string };
              return rowButton(
                r.index,
                <span className="flex-1 min-w-0 flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
                  <span className="font-sans text-[12.5px] text-slate-300 md:flex-1">{row.says || MISSING}</span>
                  <span className="font-mono text-[10px] text-hld-cyan/90 md:w-[220px] shrink-0">
                    {row.does || (row.says ? '' : null)}
                  </span>
                </span>,
                `sd-${r.index}`,
              );
            }
            const row = r as CoherenceRow;
            return rowButton(
              r.index,
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="flex items-baseline gap-3">
                  <span className="font-sans text-[12.5px] text-slate-300 flex-1">{row.claim || MISSING}</span>
                  <VerdictPip verdict={row.verdict} />
                </span>
                {row.justification && (
                  <span className="font-mono text-[9px] text-hld-muted-text leading-[1.6]">{row.justification}</span>
                )}
              </span>,
              `tc-${r.index}`,
            );
          })}
        </div>
      </div>
    </>
  );
}
