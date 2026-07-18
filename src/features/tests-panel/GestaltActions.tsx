import { useStore } from "../../state";
import { computeHash } from "../../lib/utils";
import { Pip } from "../shared/Pip";
import type { PipStatus } from "../shared/Pip";
import type { WholeFromPart, Recenterings } from "../../types";
import { useCurrentSection } from '../shared/use-current-section';
import { useGestaltActions } from "./use-gestalt-actions";

const ALIGNMENT: Record<WholeFromPart['alignment'], { pip: PipStatus; label: string }> = {
  aligned: { pip: 'green', label: 'aligned' },
  partial: { pip: 'yellow', label: 'center shifted' },
  adrift: { pip: 'yellow', label: 'adrift' },
  'no-baseline': { pip: 'idle', label: 'no baseline' },
};

/** A faint "the prose has changed since this ran" marker. */
function StaleHint({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return <span className="font-mono text-[9px] text-hld-yellow/80 ml-[6px]" title="Section text changed since this ran">⟲ stale</span>;
}

/** The Beethoven test result: the whole as read from this part, vs. the real claim. */
function WholeFromPartCard({ result, stale, documentClaim }: { result: WholeFromPart; stale: boolean; documentClaim?: string }) {
  const a = ALIGNMENT[result.alignment];
  return (
    <div className="px-[15px] py-[13px] bg-[rgba(0,232,245,0.04)] border border-hld-cyan/25">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-cyan mb-[9px] flex items-center gap-[7px]">
        <Pip status={a.pip} /> Whole from here
        <span className="text-hld-muted-text normal-case tracking-normal">· {a.label}</span>
        <StaleHint stale={stale} />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div>
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mb-[3px]">read from this part</div>
          <div className="text-[13px] leading-relaxed font-sans text-hld-text">{result.reconstructedClaim}</div>
        </div>
        {documentClaim && (
          <div>
            <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mb-[3px]">the document's actual claim</div>
            <div className="text-[13px] leading-relaxed font-sans text-hld-muted-text-2 pl-[9px] border-l border-hld-border">{documentClaim}</div>
          </div>
        )}
        {result.divergence && (
          <div className="text-[13px] leading-relaxed font-sans text-hld-text">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mr-[6px]">divergence</span>
            {result.divergence}
          </div>
        )}
        {result.note && <div className="text-[12px] leading-relaxed font-sans text-hld-muted-text-2">{result.note}</div>}
      </div>
    </div>
  );
}

/** The recentering result: alternative centers of gravity + question-the-goal. */
function RecenteringsCard({ result, stale }: { result: Recenterings; stale: boolean }) {
  return (
    <div className="px-[15px] py-[13px] bg-[rgba(170,0,255,0.05)] border border-hld-feat-running/30">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-feat-running mb-[9px] flex items-center gap-[7px]">
        <Pip status="purple" /> Recenter
        <StaleHint stale={stale} />
      </div>
      <div className="flex flex-col gap-[10px]">
        {result.options.map((o, i) => (
          <div key={i} className="pl-[9px] border-l border-hld-feat-running/30">
            <div className="text-[13px] leading-relaxed font-sans text-hld-text font-semibold">{o.center}</div>
            <div className="text-[12px] leading-relaxed font-sans text-hld-muted-text-2 mt-[2px]">{o.rationale}</div>
            <div className="text-[12px] leading-relaxed font-sans text-hld-muted-text-2 mt-[2px]">
              <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mr-[5px]">changes</span>
              {o.whatChanges}
            </div>
          </div>
        ))}
        {result.questionTheGoal && (
          <div className="mt-[2px] pt-[9px] border-t border-hld-border/60 text-[13px] leading-relaxed font-sans text-hld-text">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mr-[6px]">the goal itself</span>
            {result.questionTheGoal}
          </div>
        )}
      </div>
    </div>
  );
}

/** Secondary, glyphic action row + result cards for the two gestalt whole/part ops.
 *  Quiet by design (P4): the lit primary action stays Run Diagnostic. */
export function GestaltActions() {
  const section = useCurrentSection();
  const isProcessing = useStore((s) => s.isProcessing);
  const entry = useStore((s) => (section ? s.testSuite[section.id] : undefined));
  const rootClaim = useStore((s) => s.testSuite['root']?.spec?.mainClaim?.trim() || undefined);
  const { runReconstructWhole, runRecenter } = useGestaltActions();

  if (!section) return null;
  const isRoot = section.id === 'root';
  const currentHash = computeHash(section.fullContent);
  const whole = entry?.wholeFromPart;
  const recenterings = entry?.recenterings;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-[14px]">
        {!isRoot && (
          <button
            type="button"
            onClick={runReconstructWhole}
            disabled={isProcessing}
            title="Reconstruct the document's claim from this section alone, and measure the drift"
            className="flex items-center gap-[5px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-[11px]">◬</span> Whole from here
          </button>
        )}
        <button
          type="button"
          onClick={runRecenter}
          disabled={isProcessing}
          title="Propose alternative centerings of this section, and question its goal"
          className="flex items-center gap-[5px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-feat-running disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          <span className="text-[11px]">⟳</span> Recenter
        </button>
      </div>
      {whole && (
        <WholeFromPartCard
          result={whole}
          stale={whole.inputHash !== currentHash}
          documentClaim={whole.alignment === 'no-baseline' ? undefined : rootClaim}
        />
      )}
      {recenterings && <RecenteringsCard result={recenterings} stale={recenterings.inputHash !== currentHash} />}
    </div>
  );
}
