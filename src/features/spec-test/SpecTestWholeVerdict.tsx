import { Pip } from '../shared/Pip';
import { TRUTH_PIP, TRUTH_LABEL, DIR_LABEL } from './spec-test-config';
import type { CommitmentFinding, ComparisonReceipt, SpecTestReport, WholeVerdict } from '../../types';

function Receipts({ receipts }: { receipts: ComparisonReceipt[] }) {
  if (!receipts.length) return null;
  return (
    <div className="mt-2">
      <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-muted-text">receipts — what grounds the verdict</div>
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
    </div>
  );
}

function MeshFindings({ title, findings, color }: { title: string; findings: CommitmentFinding[]; color: string }) {
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

/**
 * The WHOLE verdict — the spine the report (and the Compare fold) lead with. Truth
 * chip + whole-direction + the verdict, the center-of-gravity read, the recentering
 * vector (when the whole regressed), and the deterministic mesh delta. The `tally`,
 * when shown, is transparency only — never the verdict.
 */
export function WholeVerdictPanel({
  whole,
  tally,
  audit,
}: {
  whole: WholeVerdict;
  tally?: SpecTestReport['tally'];
  audit?: string;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Pip status={TRUTH_PIP[whole.truth]} size="md" />
        <span
          className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold"
          style={{ color: `var(--color-hld-${TRUTH_PIP[whole.truth]})` }}
        >
          {TRUTH_LABEL[whole.truth]}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-hld-muted-text">· {DIR_LABEL[whole.direction]} as a whole</span>
      </div>
      <p className="text-[13px] text-hld-text leading-relaxed">{whole.verdict}</p>

      {whole.receipts && <Receipts receipts={whole.receipts} />}

      {whole.centerOfGravity && (
        <div className="mt-2">
          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-muted-text">center of gravity</div>
          <p className="text-[12px] text-hld-muted-text-2 leading-snug">{whole.centerOfGravity}</p>
        </div>
      )}

      {whole.recenteringVector && (
        <div className="mt-2 border-l-2 border-hld-cyan/50 pl-2.5 py-1 bg-hld-cyan/5">
          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-hld-cyan">recentering vector — what the structure now demands</div>
          <p className="text-[12px] text-hld-text leading-snug">{whole.recenteringVector}</p>
        </div>
      )}

      {(whole.meshDelta.introduced.length > 0 || whole.meshDelta.healed.length > 0) && (
        <div className="mt-2">
          <MeshFindings title="commitment joins severed (tF evidence)" findings={whole.meshDelta.introduced} color="text-hld-magenta" />
          <MeshFindings title="commitment joins repaired" findings={whole.meshDelta.healed} color="text-hld-green" />
        </div>
      )}

      {tally && (
        <div className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text">
          {tally.deepRead} deep-read · {tally.skeletonOnly} skeleton · gained {tally.gained} / regressed {tally.regressed} / deflated {tally.deflated}
          {tally.tF ? ` · tF ${tally.tF}` : ''}
          {tally.fT ? ` · fT ${tally.fT}` : ''}
        </div>
      )}
      {audit && <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-hld-muted-text">{audit}</div>}
    </section>
  );
}
