import { useState } from 'react';
import { Pip } from '../shared/Pip';
import { MOVE_STATUS_PIP, MOVE_STATUS_LABEL } from '../tests-panel/diagnostic-config';
import {
  TRUTH_PIP,
  TRUTH_LABEL,
  DIR_LABEL,
  DELTA_PIP,
  DELTA_LABEL,
  SIGNATURE_LABEL,
  SCOPE_LABEL,
} from './spec-test-config';
import type { CommitmentFinding, ComparisonReceipt, MoveDelta, SectionSpecTest } from '../../types';

function Receipts({ receipts }: { receipts: ComparisonReceipt[] }) {
  if (!receipts.length) return null;
  return (
    <div className="mt-1 space-y-1">
      {receipts.map((r, i) => (
        <blockquote key={i} className="border-l-2 border-hld-border pl-2 text-[11px] text-hld-muted-text-2 italic">
          <span className={`not-italic font-mono text-[8px] mr-1.5 ${r.side === 'a' ? 'text-hld-magenta' : 'text-hld-green'}`}>
            [{r.side.toUpperCase()}]
          </span>
          {r.quote}
        </blockquote>
      ))}
    </div>
  );
}

function Findings({ title, findings, color }: { title: string; findings: CommitmentFinding[]; color: string }) {
  if (!findings.length) return null;
  return (
    <div className="mt-1.5">
      <div className={`font-mono text-[8px] uppercase tracking-[0.12em] ${color}`}>{title} · {findings.length}</div>
      {findings.map((f, i) => (
        <div key={i} className="text-[11px] text-hld-muted-text-2 leading-snug">
          <span className="font-mono text-[8px] text-hld-muted-text mr-1">[{f.kind}]</span>
          {f.detail}
          {f.relatedSectionTitle ? <span className="text-hld-muted-text"> · {f.relatedSectionTitle}</span> : null}
        </div>
      ))}
    </div>
  );
}

function MoveRow({ m }: { m: MoveDelta }) {
  return (
    <div className="py-1.5 border-t border-hld-border/50">
      <div className="flex items-center gap-2 min-w-0">
        <Pip status={MOVE_STATUS_PIP[m.statusA]} size="sm" title={`A: ${MOVE_STATUS_LABEL[m.statusA]}`} />
        <span className="text-hld-muted-text text-[10px]">→</span>
        <Pip status={MOVE_STATUS_PIP[m.statusB]} size="sm" title={`B: ${MOVE_STATUS_LABEL[m.statusB]}`} />
        <Pip status={DELTA_PIP[m.delta]} size="sm" />
        <span
          className="font-mono text-[8px] uppercase tracking-[0.1em]"
          style={{ color: `var(--color-hld-${DELTA_PIP[m.delta]})` }}
        >
          {DELTA_LABEL[m.delta]}
        </span>
        <span className="text-[12px] text-hld-text leading-snug truncate">{m.moveDescription}</span>
      </div>
      {(m.advanceA || m.advanceB) && (
        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text">
          advance: {m.advanceA ?? '—'} → {m.advanceB ?? '—'}
        </div>
      )}
      {m.diagnosis && <div className="mt-0.5 text-[11px] text-hld-muted-text-2 leading-snug">{m.diagnosis}</div>}
      <Receipts receipts={m.receipts} />
    </div>
  );
}

/** One section's part-level result — collapsed to a header row, expandable to its
 *  move table + whole-signature + commitment delta when it was deep-read. */
export function SpecTestSectionCard({ section }: { section: SectionSpecTest }) {
  const [open, setOpen] = useState(false);
  const deep = section.moveDeltas.length > 0 || !!section.commitmentDelta;
  return (
    <div className="border border-hld-border rounded-sm bg-hld-surface-3">
      <button
        type="button"
        onClick={() => deep && setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left ${deep ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <Pip status={TRUTH_PIP[section.truth]} size="sm" title={TRUTH_LABEL[section.truth]} />
        <span className="text-[12px] text-hld-text font-medium truncate">{section.sectionTitle}</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text shrink-0">
          {SCOPE_LABEL[section.scopeReason]}
        </span>
        <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text shrink-0">
          {DIR_LABEL[section.direction]}
        </span>
        {deep && <span className="text-hld-muted-text text-[10px] shrink-0">{open ? '▾' : '▸'}</span>}
      </button>
      <div className="px-3 pb-2">
        <div className="text-[12px] text-hld-muted-text-2 leading-snug">{section.summary}</div>
        {deep && open && (
          <div className="mt-2">
            <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-muted-text">
              whole signature: {SIGNATURE_LABEL[section.wholeSignature.a]} → {SIGNATURE_LABEL[section.wholeSignature.b]}
            </div>
            {section.wholeReceipts && <Receipts receipts={section.wholeReceipts} />}
            {section.commitmentDelta && (
              <>
                <Findings title="introduced breaks" findings={section.commitmentDelta.introduced} color="text-hld-magenta" />
                <Findings title="healed breaks" findings={section.commitmentDelta.healed} color="text-hld-green" />
              </>
            )}
            <div className="mt-1">
              {section.moveDeltas.map((m) => (
                <MoveRow key={m.moveId} m={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
