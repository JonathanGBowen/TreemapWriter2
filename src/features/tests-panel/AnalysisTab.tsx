import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MessageSquareQuote, Network, RefreshCw } from "lucide-react";
import type { AnalysisVersion, DialogueMessage, SectionAnalysis } from "../../types";
import { useStore } from "../../state";
import { computeHash } from "../../lib/utils";
import { interrogateContextFor } from "../../lib/analysis-helpers";
import { DEFAULT_ANALYSIS_LENSES, DEFAULT_LENS_ID, findLens } from "../../lib/analysis-lenses";
import { useCurrentSection } from "./use-current-section";
import { useAnalysisActions } from "./use-analysis-actions";

const versionStamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const VersionRow: React.FC<{
  versions: AnalysisVersion[];
  active: AnalysisVersion;
  edited: boolean;
  onSelect: (versionId: string) => void;
  onAskEntire: () => void;
}> = ({ versions, active, edited, onSelect, onAskEntire }) => (
  <div className="flex items-center gap-[6px]">
    <div className="relative flex-1 min-w-0">
      <select
        className="w-full pl-2 pr-6 py-1.5 text-[8px] font-mono uppercase tracking-[0.14em] bg-hld-surface2 border border-hld-border rounded-none text-hld-text outline-none focus:border-hld-cyan appearance-none cursor-pointer"
        value={active.id}
        onChange={(e) => onSelect(e.target.value)}
      >
        {versions.map(v => (
          <option key={v.id} value={v.id}>
            {v.label} — {versionStamp(v.timestamp)}
          </option>
        ))}
      </select>
    </div>
    {edited && (
      <span
        className="text-[7px] font-mono font-bold uppercase tracking-[0.14em] text-hld-yellow shrink-0"
        title="The section text has changed since this version was generated"
      >
        Edited since
      </span>
    )}
    <button
      onClick={onAskEntire}
      className="w-[26px] h-[26px] flex items-center justify-center border border-hld-border text-hld-muted hover:text-hld-cyan hover:bg-hld-cyan/10 hover:border-hld-cyan transition-all shrink-0"
      title="Interrogate the entire analysis"
    >
      <MessageSquareQuote size={12} />
    </button>
  </div>
);

/** Collapsible read-only transcript of the dialogue that produced a refactor. */
const SourceDialogue: React.FC<{ dialogue: DialogueMessage[] }> = ({ dialogue }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-hld-border pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted flex items-center gap-1 hover:text-hld-cyan transition-colors"
      >
        <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Source Dialogue
      </button>
      {open && (
        <div className="mt-2 space-y-[6px] animate-in fade-in slide-in-from-top-1 duration-200 p-[8px]">
          {dialogue.map((m, i) => (
            <div key={i} className="text-[10px] font-sans leading-[1.6] border border-hld-border px-2 py-1">
              <span className={`text-[7px] font-mono uppercase tracking-[0.14em] mr-2 ${m.role === 'user' ? 'text-hld-cyan' : 'text-hld-muted'}`}>
                {m.role === 'user' ? 'You' : 'Partner'}
              </span>
              <span className="text-hld-text whitespace-pre-wrap">{m.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** One analysis section card: micro-label header + interrogate glyph + body. */
const AnalysisCard: React.FC<{
  label: string;
  accent: string;
  onAsk: () => void;
  children: React.ReactNode;
}> = ({ label, accent, onAsk, children }) => (
  <div className="bg-[#080d13] border border-hld-border p-[8px]">
    <div className="flex justify-between items-center mb-[6px] border-b border-hld-border/50 pb-[6px]">
      <div className={`text-[7px] font-mono font-bold tracking-[0.14em] uppercase flex items-center gap-[4px] ${accent}`}>
        <div className="w-[4px] h-[4px] bg-current rotate-45 shadow-[0_0_6px_currentColor]" />
        {label}
      </div>
      <button
        onClick={onAsk}
        className="text-hld-muted/70 hover:text-hld-cyan transition-colors"
        title={`Interrogate: ${label.toLowerCase()}`}
      >
        <MessageSquareQuote size={10} />
      </button>
    </div>
    {children}
  </div>
);

const ArgumentBody: React.FC<{ argument: SectionAnalysis['argument'] }> = ({ argument }) => (
  <div className="space-y-[4px]">
    {argument.premises.map((p, i) => (
      <div key={i} className="flex gap-[6px] items-start">
        <span className="text-[8px] font-mono font-bold text-hld-cyan shrink-0 mt-[2px]">P{i + 1}</span>
        <span className="text-[10px] text-hld-text font-sans leading-[1.6]">{p}</span>
      </div>
    ))}
    {argument.implicitPremises.length > 0 && (
      <div className="pt-[4px]">
        <div className="text-[6px] font-mono uppercase tracking-[0.15em] text-hld-purple mb-[3px]">Implicit</div>
        {argument.implicitPremises.map((p, i) => (
          <div key={i} className="flex gap-[6px] items-start">
            <span className="text-[8px] font-mono font-bold text-hld-purple shrink-0 mt-[2px]">IP{i + 1}</span>
            <span className="text-[10px] text-hld-text/90 font-sans leading-[1.6]">{p}</span>
          </div>
        ))}
      </div>
    )}
    <div className="mt-[8px] border-l-2 border-hld-cyan pl-2 italic text-[10px] text-hld-text font-sans leading-[1.6]">
      {argument.conclusion}
    </div>
  </div>
);

const BulletList: React.FC<{ items: string[]; marker: string }> = ({ items, marker }) => (
  <div className="space-y-[4px]">
    {items.map((item, i) => (
      <div key={i} className="flex gap-[6px] items-start">
        <div className={`w-[4px] h-[4px] rotate-45 shrink-0 mt-[6px] ${marker}`} />
        <span className="text-[10px] text-hld-text font-sans leading-[1.6]">{item}</span>
      </div>
    ))}
  </div>
);

/** The five analysis cards, each with its own interrogate affordance. */
const AnalysisCards: React.FC<{
  result: SectionAnalysis;
  onInterrogate: (context: string) => void;
}> = ({ result, onInterrogate }) => (
  <>
    <AnalysisCard label="Thesis" accent="text-hld-cyan" onAsk={() => onInterrogate(interrogateContextFor.thesis(result))}>
      <p className="text-[10px] text-hld-text font-sans leading-[1.6]">{result.centralThesis}</p>
    </AnalysisCard>

    {result.keyConcepts.length > 0 && (
      <AnalysisCard label="Concepts" accent="text-hld-yellow" onAsk={() => onInterrogate(interrogateContextFor.concepts(result))}>
        <div className="space-y-[4px]">
          {result.keyConcepts.map((c, i) => (
            <div key={i} className="text-[10px] font-sans leading-[1.6]">
              <span className="font-bold text-hld-cyan">{c.term}</span>
              <span className="text-hld-text"> — {c.definition}</span>
            </div>
          ))}
        </div>
      </AnalysisCard>
    )}

    <AnalysisCard label="Argument" accent="text-hld-magenta" onAsk={() => onInterrogate(interrogateContextFor.argument(result))}>
      <ArgumentBody argument={result.argument} />
    </AnalysisCard>

    {result.supportingArguments.length > 0 && (
      <AnalysisCard label="Support" accent="text-hld-green" onAsk={() => onInterrogate(interrogateContextFor.support(result))}>
        <BulletList items={result.supportingArguments} marker="bg-hld-green" />
      </AnalysisCard>
    )}

    {result.potentialObjections.length > 0 && (
      <AnalysisCard label="Objections" accent="text-hld-purple" onAsk={() => onInterrogate(interrogateContextFor.objections(result))}>
        <BulletList items={result.potentialObjections} marker="bg-hld-magenta" />
      </AnalysisCard>
    )}
  </>
);

/** Lens selector + Analyze button. The lens frames the next analysis. */
const AnalyzeFooter: React.FC<{
  hasVersion: boolean;
  busy: boolean;
  lensId: string;
  onLensChange: (id: string) => void;
  onRun: () => void;
}> = ({ hasVersion, busy, lensId, onLensChange, onRun }) => (
  <div className="space-y-[6px]">
    <div className="flex items-center gap-[6px]">
      <span className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-muted shrink-0">Lens</span>
      <div className="relative flex-1">
        <select
          value={lensId}
          disabled={busy}
          onChange={(e) => onLensChange(e.target.value)}
          className="w-full pl-2 pr-6 py-1.5 text-[8px] font-mono uppercase tracking-[0.14em] bg-hld-surface2 border border-hld-border rounded-none text-hld-text outline-none focus:border-hld-cyan appearance-none cursor-pointer disabled:opacity-35"
          title="Analytical lens for the next analysis"
        >
          {DEFAULT_ANALYSIS_LENSES.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <div className="absolute right-[6px] top-1/2 -translate-y-1/2 pointer-events-none text-hld-muted">
          <ChevronDown size={10} />
        </div>
      </div>
    </div>
    <button
      onClick={onRun}
      disabled={busy}
      className="w-full p-[11px] bg-transparent border border-[rgba(0,232,245,0.3)] text-hld-cyan font-mono uppercase tracking-[0.14em] text-[8px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[rgba(0,232,245,0.06)] hover:shadow-[0_0_20px_rgba(0,232,245,0.25)] bracketed"
      style={{"--br-color": "var(--tw-colors-hld-cyan)"} as React.CSSProperties}
    >
      {busy
        ? <>Analyzing...</>
        : hasVersion
          ? <><RefreshCw size={10} /> Re-analyze</>
          : <><Network size={10} /> Analyze</>}
    </button>
  </div>
);

export const AnalysisTab: React.FC = () => {
  const testSuite = useStore(s => s.testSuite);
  const isProcessing = useStore(s => s.isProcessing);
  const setActiveAnalysisVersion = useStore(s => s.setActiveAnalysisVersion);
  const currentSection = useCurrentSection();
  const { runAnalysis, interrogate } = useAnalysisActions();
  // Memoize the (linear) content hash so it isn't recomputed on every render —
  // AnalysisTab re-renders on any testSuite change. Declared before the early
  // return to satisfy the rules of hooks.
  const contentHash = useMemo(
    () => computeHash(currentSection?.fullContent ?? ''),
    [currentSection?.fullContent],
  );
  // null = "not explicitly chosen": fall back to the active version's lens,
  // so Re-analyze repeats it and the picker reflects what you're looking at.
  const [chosenLensId, setChosenLensId] = useState<string | null>(null);

  if (!currentSection) return null;

  const state = testSuite[currentSection.id]?.analysis;
  const versions = state?.versions ?? [];
  const active = versions.find(v => v.id === state?.activeVersionId) ?? versions[0];
  // Surfaced, never auto-invalidated: versions are history, not cache.
  const edited = !!active && active.inputHash !== contentHash;

  const effectiveLensId = chosenLensId ?? active?.lensId ?? DEFAULT_LENS_ID;
  const analyzeFooter = (
    <AnalyzeFooter
      hasVersion={!!active}
      busy={isProcessing}
      lensId={effectiveLensId}
      onLensChange={setChosenLensId}
      onRun={() => runAnalysis(findLens(effectiveLensId))}
    />
  );

  if (!active) {
    return (
      <div className="flex-1 overflow-y-auto p-3 bg-[#080d13] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center text-hld-muted">
          <Network size={32} className="mb-2 opacity-50" />
          <p className="font-mono uppercase tracking-[0.14em] text-[8px]">No analysis</p>
        </div>
        {analyzeFooter}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-[10px] bg-[#080d13]">
      <VersionRow
        versions={versions}
        active={active}
        edited={edited}
        onSelect={(versionId) => setActiveAnalysisVersion(currentSection.id, versionId)}
        onAskEntire={() => interrogate(interrogateContextFor.entire(active.result))}
      />

      {active.lensName && (
        <div className="flex items-center gap-[4px] text-[7px] font-mono uppercase tracking-[0.15em] text-hld-muted-text">
          <div className="w-[3px] h-[3px] rotate-45 bg-hld-cyan shadow-[0_0_5px_var(--tw-colors-hld-cyan)]" />
          Lens · {active.lensName}
        </div>
      )}

      <AnalysisCards result={active.result} onInterrogate={interrogate} />

      {/* Source dialogue (refactor provenance) */}
      {active.sourceDialogue && active.sourceDialogue.length > 0 && (
        <SourceDialogue dialogue={active.sourceDialogue} />
      )}

      {analyzeFooter}
    </div>
  );
};
