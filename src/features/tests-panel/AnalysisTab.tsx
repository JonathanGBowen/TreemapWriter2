import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Network, RefreshCw, Wand2 } from "lucide-react";
import type { AnalysisVersion, DialogueMessage, SectionAnalysis } from "../../types";
import { useStore } from "../../state";
import { computeHash } from "../../lib/utils";
import { interrogateContextFor } from "../../lib/analysis-helpers";
import { DEFAULT_SPELLS } from "../../lib/defaultSpells";
import { Zone } from "../shared/Zone";
import { Pip } from "../shared/Pip";
import { Disclosure } from "../shared/Disclosure";
import { PanelHeader } from "./PanelHeader";
import { useCurrentSection } from '../shared/use-current-section';
import { useAnalysisActions } from "./use-analysis-actions";
import { SegControl } from "../modals/SegControl";

const versionDate = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric' });

/** The one interrogation affordance — monochrome at rest, cyan on hover. */
function Ask({ onAsk, label = '⊕ ask' }: { onAsk: () => void; label?: string }) {
  return (
    <button type="button" onClick={onAsk} title="Ask about this — opens a focused dialogue" className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan transition-colors whitespace-nowrap shrink-0">
      {label}
    </button>
  );
}

/** The active analytical lens, and a quiet way into the Grimoire to change it. */
function LensBar({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Choose an analytical lens — opens the Grimoire"
      className="group flex items-center justify-between gap-2 w-full px-[12px] py-[9px] border border-hld-border hover:border-hld-cyan/40 transition-colors"
    >
      <span className="inline-flex items-center gap-[8px] min-w-0">
        <Wand2 size={12} className="text-hld-muted-text-2 group-hover:text-hld-cyan shrink-0 transition-colors" />
        <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text-2 shrink-0">Lens</span>
        <span className="text-[13px] font-sans text-hld-text truncate">{name}</span>
      </span>
      <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text-2 group-hover:text-hld-cyan shrink-0 transition-colors">Grimoire ▸</span>
    </button>
  );
}

/** Draft/Completed reading-stance toggle for Analysis. Reads its own store state. */
function AnalysisModeToggle() {
  const mode = useStore((s) => s.analysisMode);
  const setMode = useStore((s) => s.setAnalysisMode);
  return (
    <div title="Draft: reconstruct the argument as it stands, treating stubs and gaps as scaffolding, not flaws. Completed: read it as finished work.">
      <SegControl
        ariaLabel="Analysis reading mode"
        value={mode === 'final' ? 1 : 0}
        onChange={(i) => setMode(i === 1 ? 'final' : 'draft')}
        options={[{ glyph: '✎', label: 'Draft' }, { glyph: '✓', label: 'Completed' }]}
      />
    </div>
  );
}

/** Quiet version caption for the orientation header: a yellow pip when the section
 *  was edited since, plus the version dropdown (with its lens) as plain muted text. */
function VersionMeta({ versions, active, edited, onSelect }: { versions: AnalysisVersion[]; active: AnalysisVersion; edited: boolean; onSelect: (id: string) => void }) {
  return (
    <span className="inline-flex items-center gap-[6px]">
      {edited && <Pip status="yellow" size="sm" title="Section edited since this read — re-analyze to refresh" />}
      <span className="inline-flex items-center gap-[3px]">
        <select
          value={active.id}
          onChange={(e) => onSelect(e.target.value)}
          title="Analysis version"
          className="bg-transparent border-none outline-none font-sans text-[11px] text-hld-muted-text-2 hover:text-hld-cyan cursor-pointer appearance-none text-right"
        >
          {versions.map((v) => <option key={v.id} value={v.id} className="bg-hld-surface text-hld-text">{v.label}{v.spellName ? ` · ${v.spellName}` : ''} · {versionDate(v.timestamp)}</option>)}
        </select>
        <span className="text-hld-muted-text text-[8px] pointer-events-none">▾</span>
      </span>
    </span>
  );
}

/** The argument promoted to hero: a logical ladder, monochrome structure. */
function ArgumentLadder({ argument }: { argument: SectionAnalysis['argument'] }) {
  const pipStyle: CSSProperties = { position: 'absolute', left: -16, top: 6 };
  return (
    <div className="mt-[12px] relative pl-[16px]">
      <div className="absolute left-[3px] top-[5px] bottom-[30px] w-px bg-hld-border" />
      {argument.premises.map((p, i) => (
        <div key={i} className="flex gap-[11px] items-start mb-[12px] relative">
          <Pip status="cyan" size="sm" style={pipStyle} />
          <span className="font-mono text-[10px] font-semibold text-hld-muted-text-2 shrink-0 mt-[1px] w-[22px]">P{i + 1}</span>
          <span className="text-[13px] leading-relaxed font-sans text-hld-text">{p}</span>
        </div>
      ))}
      {argument.implicitPremises.map((p, i) => (
        <div key={i} className="flex gap-[11px] items-start mb-[12px] relative">
          <Pip status="idle" size="sm" style={pipStyle} />
          <span className="font-mono text-[9px] font-semibold text-hld-muted shrink-0 mt-[2px] tracking-[0.1em] uppercase w-[22px]">impl</span>
          <span className="text-[13px] leading-relaxed font-sans text-hld-muted-text-2 italic">{p}</span>
        </div>
      ))}
      <div className="flex gap-[11px] items-start relative">
        <span className="absolute -left-[16px] top-0 text-hld-cyan text-[15px]">∴</span>
        <div className="text-[13px] leading-relaxed font-sans text-hld-text font-semibold border-l-2 border-hld-border pl-[11px] py-[2px]">{argument.conclusion}</div>
      </div>
    </div>
  );
}

function BulletList({ items, status }: { items: string[]; status: 'green' | 'magenta' }) {
  return (
    <div className="flex flex-col gap-[8px]">
      {items.map((item, i) => (
        <div key={i} className="flex gap-[10px] items-start">
          <Pip status={status} size="sm" style={{ marginTop: 6 }} />
          <span className="text-[13px] leading-relaxed font-sans text-hld-text">{item}</span>
        </div>
      ))}
    </div>
  );
}

/** Read-only provenance transcript (the dialogue a refactor came from). */
function SourceTranscript({ dialogue }: { dialogue: DialogueMessage[] }) {
  return (
    <div className="flex flex-col gap-[8px]">
      {dialogue.map((m, i) => (
        <div key={i} className="text-[12px] font-sans leading-relaxed border-l border-hld-border pl-[9px]">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] mr-2 text-hld-muted-text-2">{m.role === 'user' ? 'You' : 'Partner'}</span>
          <span className="text-hld-text whitespace-pre-wrap">{m.text}</span>
        </div>
      ))}
    </div>
  );
}

function ReanalyzeFooter({ busy, onRun }: { busy: boolean; onRun: () => void }) {
  return (
    <div className="px-[16px] py-[14px] border-t border-hld-border shrink-0">
      <button type="button" onClick={onRun} disabled={busy} className="w-full py-[11px] flex items-center justify-center gap-2 border border-hld-border text-hld-muted-text-2 hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[10px] tracking-[0.12em] uppercase disabled:opacity-40 transition-colors">
        <RefreshCw size={11} /> {busy ? 'Analyzing…' : 'Re-analyze'}
      </button>
    </div>
  );
}

function AnalysisEmpty({ busy, onRun, lensName, onOpenGrimoire }: { busy: boolean; onRun: () => void; lensName: string; onOpenGrimoire: () => void }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-hld-surface-3">
      <div className="px-[16px] pt-[16px] flex flex-col gap-[10px]">
        <LensBar name={lensName} onOpen={onOpenGrimoire} />
        <AnalysisModeToggle />
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-[16px] p-[24px] text-center">
        <span className="w-[22px] h-[22px] rotate-45 border border-hld-muted" />
        <div className="text-[13px] leading-relaxed font-sans text-hld-muted-text-2 max-w-[260px]">
          No structural read yet. Analyze this section to surface its argument — the premises, the hidden assumption, and where it&apos;s open to objection.
        </div>
        <button type="button" onClick={onRun} disabled={busy} style={{ '--br-color': 'var(--color-hld-cyan)' } as CSSProperties} className="bracketed hld-lit px-[22px] py-[11px] flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40">
          <Network size={11} /> {busy ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>
    </div>
  );
}

/** Concepts · Support · Objections · Source — opened one at a time. Interrogation
 *  lives only here (the Objections "take to dialogue" affordance). */
function ReadingIndex({ r, sourceDialogue, ask }: { r: SectionAnalysis; sourceDialogue?: DialogueMessage[]; ask: (ctx: string) => void }) {
  return (
    <div className="mt-[2px]">
      {r.keyConcepts.length > 0 && (
        <Disclosure label="Key concepts" count={r.keyConcepts.length}>
          <div className="flex flex-col gap-[8px]">
            {r.keyConcepts.map((c, i) => (
              <div key={i} className="text-[13px] leading-relaxed font-sans"><span className="font-semibold text-hld-text">{c.term}</span><span className="text-hld-muted-text-2"> — {c.definition}</span></div>
            ))}
          </div>
        </Disclosure>
      )}
      {r.supportingArguments.length > 0 && (
        <Disclosure label="Support" count={r.supportingArguments.length}>
          <BulletList items={r.supportingArguments} status="green" />
        </Disclosure>
      )}
      {r.potentialObjections.length > 0 && (
        <Disclosure label="Objections" count={r.potentialObjections.length} pip="magenta" defaultOpen>
          <BulletList items={r.potentialObjections} status="magenta" />
          <div className="mt-[10px] flex justify-end">
            <Ask onAsk={() => ask(interrogateContextFor.objections(r))} label="⊕ take this objection to dialogue" />
          </div>
        </Disclosure>
      )}
      {sourceDialogue && sourceDialogue.length > 0 && (
        <Disclosure label="Source dialogue" count={`${sourceDialogue.length} turns`}>
          <SourceTranscript dialogue={sourceDialogue} />
        </Disclosure>
      )}
    </div>
  );
}

export function AnalysisTab() {
  const testSuite = useStore((s) => s.testSuite);
  const isProcessing = useStore((s) => s.isProcessing);
  const setActiveAnalysisVersion = useStore((s) => s.setActiveAnalysisVersion);
  const activeSpellId = useStore((s) => s.activeSpellId);
  const customSpells = useStore((s) => s.customSpells);
  const setShowGrimoireModal = useStore((s) => s.setShowGrimoireModal);
  const currentSection = useCurrentSection();
  const { runAnalysis, interrogate } = useAnalysisActions();
  const contentHash = useMemo(() => computeHash(currentSection?.fullContent ?? ''), [currentSection?.fullContent]);

  if (!currentSection) return null;

  const activeSpellName = activeSpellId
    ? [...DEFAULT_SPELLS, ...customSpells].find((s) => s.id === activeSpellId)?.name ?? 'Plain reconstruction'
    : 'Plain reconstruction';
  const openGrimoire = () => setShowGrimoireModal(true);

  const entry = testSuite[currentSection.id];
  const state = entry?.analysis;
  const versions = state?.versions ?? [];
  const active = versions.find((v) => v.id === state?.activeVersionId) ?? versions[0];

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-hld-surface-3">
      <PanelHeader
        section={currentSection}
        diagnostic={entry?.lastDiagnostic}
        meta={active ? <VersionMeta versions={versions} active={active} edited={active.inputHash !== contentHash} onSelect={(id) => setActiveAnalysisVersion(currentSection.id, id)} /> : undefined}
        onOpenSettings={openGrimoire}
        settingsLabel="Analytical lens · Grimoire"
      />
      {!active ? (
        <AnalysisEmpty busy={isProcessing} onRun={runAnalysis} lensName={activeSpellName} onOpenGrimoire={openGrimoire} />
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-[16px] py-[16px] flex flex-col gap-[18px]">
            <LensBar name={activeSpellName} onOpen={openGrimoire} />
            <AnalysisModeToggle />

            <div>
              <Zone label="Thesis" />
              <div className="mt-[8px] px-[13px] py-[12px] bg-hld-surface-2/50 border-l-2 border-hld-border text-[13px] leading-relaxed font-sans text-hld-text">{active.result.centralThesis}</div>
            </div>

            <div>
              <Zone label="Argument" meta={`${active.result.argument.premises.length} premises · ${active.result.argument.implicitPremises.length} implicit`} />
              <ArgumentLadder argument={active.result.argument} />
            </div>

            <ReadingIndex r={active.result} sourceDialogue={active.sourceDialogue} ask={(ctx) => interrogate(ctx)} />
          </div>

          <ReanalyzeFooter busy={isProcessing} onRun={runAnalysis} />
        </>
      )}
    </div>
  );
}
