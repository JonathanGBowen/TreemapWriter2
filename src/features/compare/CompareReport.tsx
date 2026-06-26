import { useState } from 'react';
import { useStore } from '../../state';
import { Pip, type PipStatus } from '../shared/Pip';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';
import { WholeVerdictPanel } from '../spec-test/SpecTestWholeVerdict';
import { SpecTestSectionCard } from '../spec-test/SpecTestSectionCard';
import type {
  ComparisonChange,
  ComparisonDirection,
  OpenThread,
  SectionComparisonNote,
} from '../../types';

const DIR_PIP: Record<ComparisonDirection, PipStatus> = {
  improved: 'green',
  regressed: 'magenta',
  mixed: 'yellow',
  lateral: 'cyan',
};

const DIR_LABEL: Record<ComparisonDirection, string> = {
  improved: 'Improved',
  regressed: 'Regressed',
  mixed: 'Mixed',
  lateral: 'Lateral',
};

/** Section header: a tinted pip + an uppercase mono eyebrow. */
function Eyebrow({ pip, children }: { pip: PipStatus; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Pip status={pip} size="sm" />
      <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">{children}</span>
    </div>
  );
}

function Receipts({ change }: { change: ComparisonChange }) {
  if (!change.receipts.length) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {change.receipts.map((r, i) => (
        <blockquote
          key={i}
          className="border-l-2 border-hld-border pl-2 text-[11px] text-hld-muted-text-2 italic"
        >
          <span className={`not-italic font-mono text-[8px] mr-1.5 ${r.side === 'a' ? 'text-hld-magenta' : 'text-hld-green'}`}>
            [{r.side.toUpperCase()}]
          </span>
          {r.quote}
        </blockquote>
      ))}
    </div>
  );
}

function ChangeBlock({ pip, title, changes }: { pip: PipStatus; title: string; changes: ComparisonChange[] }) {
  if (!changes.length) return null;
  return (
    <section className="mb-5">
      <Eyebrow pip={pip}>{title} · {changes.length}</Eyebrow>
      <div className="space-y-3">
        {changes.map((c, i) => (
          <div key={i}>
            <div className="text-[13px] text-hld-text leading-snug">{c.summary}</div>
            {c.aspect && (
              <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text">{c.aspect}</div>
            )}
            <Receipts change={c} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionNotes({ notes }: { notes: SectionComparisonNote[] }) {
  const [open, setOpen] = useState(true);
  if (!notes.length) return null;
  return (
    <section className="mb-5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full">
        <Eyebrow pip="purple">{open ? '▾' : '▸'} By section · {notes.length}</Eyebrow>
      </button>
      {open && (
        <div className="space-y-2.5">
          {notes.map((n, i) => (
            <div key={i} className="border-l border-hld-border pl-2.5">
              <div className="flex items-center gap-2">
                <Pip status={DIR_PIP[n.direction]} size="sm" title={DIR_LABEL[n.direction]} />
                <span className="text-[12px] text-hld-text font-medium truncate">{n.sectionTitle}</span>
                {!n.presentInA && <span className="font-mono text-[8px] text-hld-green">NEW IN B</span>}
                {!n.presentInB && <span className="font-mono text-[8px] text-hld-magenta">CUT IN B</span>}
              </div>
              <div className="text-[12px] text-hld-muted-text-2 leading-snug mt-0.5">{n.note}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Draft-mode checklist of still-open work — neutral, never a verdict. */
function OpenThreads({ threads }: { threads: OpenThread[] }) {
  if (!threads.length) return null;
  return (
    <section className="mb-5">
      <Eyebrow pip="cyan">Open threads · {threads.length}</Eyebrow>
      <div className="space-y-2">
        {threads.map((t, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-hld-cyan/70 text-[12px] leading-snug shrink-0">◇</span>
            <div>
              <div className="text-[13px] text-hld-text leading-snug">{t.summary}</div>
              {t.location && (
                <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text">{t.location}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The spec-anchored fold: the SAME whole verdict + per-section cards the Spec Test
 *  workspace renders, scoped to the Compare operands. Same engine, compact view. */
function SpecAnchoredBody() {
  const status = useStore((s) => s.comparisonStatus);
  const report = useStore((s) => s.specAnchoredResult);

  if (status === 'running') {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <span className="w-3 h-3 rounded-full border-[1.5px] border-hld-cyan/25 border-t-hld-cyan animate-spin" />
        <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">Testing parts, then the whole…</div>
        <AgentTraceTicker
          kinds={['runSpecTestSection', 'runSpecTestWhole']}
          className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-[300px] min-w-0"
        />
      </div>
    );
  }
  if (!report) {
    return (
      <div className="px-2 py-12 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text leading-[1.8]">
        Pick two versions and run — the report leads with whether B served the WHOLE against your held specs, then the parts beneath.
      </div>
    );
  }
  return (
    <>
      <WholeVerdictPanel
        whole={report.whole}
        tally={report.tally}
        audit={`${report.mode} · rubric: ${report.rubricSource} · scope: ${report.scopeLabel}`}
      />
      <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text mb-2">By section · {report.sections.length}</div>
      <div className="space-y-1.5">
        {report.sections.map((s, i) => (
          <SpecTestSectionCard key={`${s.sectionTitle}-${i}`} section={s} />
        ))}
      </div>
    </>
  );
}

/** The right-hand evaluation panel: verdict, drift, gains, losses, by-section. */
export function CompareReport() {
  const status = useStore((s) => s.comparisonStatus);
  const comparison = useStore((s) => s.comparison);
  const specAnchored = useStore((s) => s.compareSpecAnchored);

  return (
    <>
      <div className="relative px-4 py-3 border-b border-hld-border shrink-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-hld-cyan shadow-[0_0_12px_var(--color-hld-cyan)]" />
        <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
          {specAnchored ? 'Spec test' : 'Evaluation'}{comparison?.mode === 'draft' ? ' · Draft' : comparison?.mode === 'final' ? ' · Completed' : ''}{!specAnchored && comparison?.lensName ? ` · ${comparison.lensName}` : ''}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {specAnchored ? (
          <SpecAnchoredBody />
        ) : status === 'running' ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="w-3 h-3 rounded-full border-[1.5px] border-hld-cyan/25 border-t-hld-cyan animate-spin" />
            <div className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-cyan">Comparing versions…</div>
            <div className="font-mono text-[9px] text-hld-muted-text max-w-[240px] leading-[1.6]">
              Reconstructing how the argument changed — drift, gains, losses. No claim without a receipt.
            </div>
            <AgentTraceTicker
              kinds={['compareVersions']}
              className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-[300px] min-w-0"
            />
          </div>
        ) : !comparison ? (
          <div className="px-2 py-12 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-hld-muted-text leading-[1.8]">
            Pick two versions and run an evaluation to see conceptual drift, improvements, and possible losses.
          </div>
        ) : (
          <>
            <section className="mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <Pip status={DIR_PIP[comparison.direction]} size="md" />
                <span className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold" style={{ color: `var(--color-hld-${DIR_PIP[comparison.direction]})` }}>
                  {DIR_LABEL[comparison.direction]}
                </span>
              </div>
              <p className="text-[13px] text-hld-text leading-relaxed">{comparison.verdict}</p>
            </section>

            {comparison.conceptualDrift && (
              <section className="mb-5">
                <Eyebrow pip="cyan">Conceptual drift</Eyebrow>
                <p className="text-[13px] text-hld-muted-text-2 leading-relaxed">{comparison.conceptualDrift}</p>
              </section>
            )}

            <ChangeBlock pip="green" title="Improvements" changes={comparison.improvements} />
            {comparison.mode === 'draft' && <OpenThreads threads={comparison.openThreads ?? []} />}
            <ChangeBlock
              pip="magenta"
              title={comparison.mode === 'draft' ? 'Regressions / drift' : 'Possible losses'}
              changes={comparison.losses}
            />
            <ChangeBlock pip="yellow" title="Argument moves" changes={comparison.moveChanges} />
            <SectionNotes notes={comparison.sectionNotes} />
          </>
        )}
      </div>
    </>
  );
}
