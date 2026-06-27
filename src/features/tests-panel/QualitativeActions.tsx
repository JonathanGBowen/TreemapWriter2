import { useEffect, useRef, useState } from "react";
import { useStore } from "../../state";
import { computeHash } from "../../lib/utils";
import { Pip } from "../shared/Pip";
import type { PipStatus } from "../shared/Pip";
import type { QualitativeSignature, PartQuality, FeltTrouble } from "../../types";
import { useCurrentSection } from "./use-current-section";
import { useQualitativeActions } from "./use-qualitative-actions";

const BELONGING: Record<PartQuality['belonging'], { pip: PipStatus; label: string }> = {
  belongs: { pip: 'green', label: 'belongs' },
  shifted: { pip: 'yellow', label: 'quality shifted' },
  alien: { pip: 'magenta', label: 'alien' },
  'no-baseline': { pip: 'idle', label: 'no signature yet' },
};

/** A faint "the prose has changed since this ran" marker (mirrors GestaltActions). */
function StaleHint({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return <span className="font-mono text-[9px] text-hld-yellow/80 ml-[6px]" title="Text changed since this ran">⟲ stale</span>;
}

/** The document's pervasive quality — Dewey's felt "ground", indicated not stated. */
function SignatureCard({ result, stale }: { result: QualitativeSignature; stale: boolean }) {
  return (
    <div className="px-[15px] py-[13px] bg-[rgba(0,232,245,0.04)] border border-hld-cyan/25">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-cyan mb-[9px] flex items-center gap-[7px]">
        <Pip status="cyan" /> Pervasive quality
        <span className="text-hld-muted-text normal-case tracking-normal">· the ground</span>
        <StaleHint stale={stale} />
      </div>
      <div className="text-[13px] leading-relaxed font-sans text-hld-text">{result.quality}</div>
      {result.registers && result.registers.length > 0 && (
        <div className="flex flex-wrap gap-[6px] mt-[9px]">
          {result.registers.map((r, i) => (
            <span key={i} className="font-mono text-[10px] tracking-[0.04em] text-hld-muted-text-2 px-[7px] py-[2px] border border-hld-border">{r}</span>
          ))}
        </div>
      )}
      {result.note && <div className="text-[12px] leading-relaxed font-sans text-hld-muted-text-2 mt-[8px]">{result.note}</div>}
    </div>
  );
}

/** The Goya test: does this part carry the whole's quality? (assimilation, not claim). */
function PartQualityCard({ result, stale }: { result: PartQuality; stale: boolean }) {
  const b = BELONGING[result.belonging];
  return (
    <div className="px-[15px] py-[13px] bg-[rgba(0,232,245,0.04)] border border-hld-cyan/25">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-cyan mb-[9px] flex items-center gap-[7px]">
        <Pip status={b.pip} /> Goya test
        <span className="text-hld-muted-text normal-case tracking-normal">· {b.label}</span>
        <StaleHint stale={stale} />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div>
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mb-[3px]">the quality this part carries</div>
          <div className="text-[13px] leading-relaxed font-sans text-hld-text">{result.partQuality}</div>
        </div>
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

/** The articulated gap → vector, once the felt trouble has been crossed over. */
function ArticulatedCard({ trouble, stale }: { trouble: FeltTrouble; stale: boolean }) {
  const a = trouble.articulated;
  if (!a) return null;
  return (
    <div className="px-[15px] py-[13px] bg-[rgba(0,232,245,0.05)] border border-hld-cyan/30">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-cyan mb-[7px] flex items-center gap-[7px]">
        <Pip status="cyan" /> The trouble, stated
        <StaleHint stale={stale} />
      </div>
      <div className="flex flex-col gap-[7px]">
        <div className="text-[13px] leading-relaxed font-sans text-hld-text">{a.gap}</div>
        <div className="flex items-baseline gap-[7px]">
          <span className="font-mono text-hld-cyan text-[12px] shrink-0 mt-[1px]">→</span>
          <span className="text-[13px] leading-relaxed font-sans text-hld-text">{a.vector}</span>
        </div>
        {a.location && (
          <div className="text-[12px] leading-relaxed font-sans text-hld-muted-text-2">
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-hld-muted-text mr-[6px]">where</span>
            {a.location}
          </div>
        )}
      </div>
    </div>
  );
}

/** The pre-articulate trouble register: a home for "something is off — can't say
 *  what" (Dewey's problem HAD before it is STATED), and the ramp that articulates it. */
function FeltTroubleRegister() {
  const section = useCurrentSection();
  const isProcessing = useStore((s) => s.isProcessing);
  const entry = useStore((s) => (section ? s.testSuite[section.id] : undefined));
  const { saveFeltNote, runArticulateTrouble } = useQualitativeActions();
  const trouble = entry?.feltTrouble;

  // Local draft so typing is smooth; persist on blur. Resync when the section changes.
  const [draft, setDraft] = useState(trouble?.note ?? '');
  const lastSectionId = useRef(section?.id);
  useEffect(() => {
    if (lastSectionId.current !== section?.id) {
      lastSectionId.current = section?.id;
      setDraft(trouble?.note ?? '');
    }
  }, [section?.id, trouble?.note]);

  if (!section) return null;
  const currentHash = computeHash(section.fullContent);
  const hasNote = draft.trim().length > 0;

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted-text flex items-center gap-[6px]">
        <span className="text-[11px]">◴</span> Felt trouble
        <span className="text-hld-muted-text-2 normal-case tracking-normal">· had before stated</span>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (trouble?.note ?? '')) void saveFeltNote(draft); }}
        rows={2}
        placeholder="Something feels off here — even if you can't yet say what."
        className="w-full pl-[11px] border-l-2 border-hld-border focus:border-hld-cyan text-[13px] leading-relaxed font-sans text-hld-text bg-transparent outline-none resize-none placeholder-hld-muted/50 min-h-[2.6em] transition-colors"
      />
      <button
        type="button"
        onClick={() => { if (draft !== (trouble?.note ?? '')) void saveFeltNote(draft); void runArticulateTrouble(); }}
        disabled={isProcessing || !hasNote}
        title="Convert the felt trouble into a located gap → vector"
        className="self-start flex items-center gap-[5px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
      >
        <span className="text-[11px]">⤷</span> Articulate
      </button>
      {trouble?.articulated && (
        <ArticulatedCard trouble={trouble} stale={trouble.articulatedHash !== currentHash} />
      )}
    </div>
  );
}

/** Deweyan qualitative surfaces — the felt sibling of GestaltActions. Quiet by
 *  design: pervasive quality (the ground, on root) + the Goya test (on a part) +
 *  the pre-articulate trouble register. See docs/dewey-design.md. */
export function QualitativeActions() {
  const section = useCurrentSection();
  const isProcessing = useStore((s) => s.isProcessing);
  const entry = useStore((s) => (section ? s.testSuite[section.id] : undefined));
  const markdown = useStore((s) => s.markdown);
  const { runReadPervasiveQuality, runReadPartQuality } = useQualitativeActions();

  if (!section) return null;
  const isRoot = section.id === 'root';
  const signature = entry?.qualitativeSignature;
  const partQuality = entry?.partQuality;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-[14px]">
        {isRoot ? (
          <button
            type="button"
            onClick={runReadPervasiveQuality}
            disabled={isProcessing}
            title="Indicate the pervasive quality running through the whole document (the felt ground)"
            className="flex items-center gap-[5px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-[11px]">≋</span> Pervasive quality
          </button>
        ) : (
          <button
            type="button"
            onClick={runReadPartQuality}
            disabled={isProcessing}
            title="Read whether this part carries the whole's quality (the Goya test)"
            className="flex items-center gap-[5px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-[11px]">≋</span> Goya test
          </button>
        )}
      </div>
      {isRoot && signature && (
        <SignatureCard result={signature} stale={signature.inputHash !== computeHash(markdown)} />
      )}
      {!isRoot && partQuality && (
        <PartQualityCard result={partQuality} stale={partQuality.inputHash !== computeHash(section.fullContent)} />
      )}
      <FeltTroubleRegister />
    </div>
  );
}
