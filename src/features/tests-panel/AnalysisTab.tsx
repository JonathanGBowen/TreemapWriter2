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
import { useCurrentSection } from "./use-current-section";
import { useAnalysisActions } from "./use-analysis-actions";

const versionStamp = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The one interrogation affordance — monochrome at rest, cyan on hover. */
function Ask({ onAsk, label = '⊕ ask' }: { onAsk: () => void; label?: string }) {
  return (
    <button type="button" onClick={onAsk} title="Ask about this — opens a focused dialogue" className="font-mono text-[8.5px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan transition-colors whitespace-nowrap shrink-0">
      {label}
    </button>
  );
}

/** The active analytical lens, and a way into the Grimoire to change it. */
function LensBar({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Choose an analytical lens — opens the Grimoire"
      className="group flex items-center justify-between gap-2 w-full px-[11px] py-[7px] border border-hld-border hover:border-hld-cyan/40 transition-colors"
    >
      <span className="inline-flex items-center gap-[6px] min-w-0">
        <Wand2 size={11} className="text-hld-muted-text group-hover:text-hld-cyan shrink-0 transition-colors" />
        <span className="font-mono text-[8.5px] tracking-[0.12em] uppercase text-hld-muted-text shrink-0">Lens</span>
        <span className="text-[10px] font-sans text-hld-text truncate">{name}</span>
      </span>
      <span className="font-mono text-[8px] tracking-[0.12em] uppercase text-hld-muted-text group-hover:text-hld-cyan shrink-0 transition-colors">Grimoire ▸</span>
    </button>
  );
}

/** The argument promoted to hero: a logical ladder. */
function ArgumentLadder({ argument }: { argument: SectionAnalysis['argument'] }) {
  const pipStyle: CSSProperties = { position: 'absolute', left: -14, top: 5 };
  return (
    <div className="mt-[10px] relative pl-[14px]">
      <div className="absolute left-[3px] top-[4px] bottom-[30px] w-px bg-hld-border" />
      {argument.premises.map((p, i) => (
        <div key={i} className="flex gap-[9px] items-start mb-[9px] relative">
          <Pip status="cyan" size="sm" style={pipStyle} />
          <span className="font-mono text-[8px] font-bold text-hld-muted-text shrink-0 mt-[2px] tracking-[0.06em]">P{i + 1}</span>
          <span className="text-[10.5px] leading-relaxed font-sans text-hld-text">{p}</span>
        </div>
      ))}
      {argument.implicitPremises.map((p, i) => (
        <div key={i} className="flex gap-[9px] items-start mb-[12px] relative">
          <Pip status="idle" size="sm" style={pipStyle} />
          <span className="font-mono text-[7px] font-bold text-hld-muted shrink-0 mt-[3px] tracking-[0.1em] uppercase">impl</span>
          <span className="text-[10px] leading-relaxed font-sans text-hld-muted-text italic">{p}</span>
        </div>
      ))}
      <div className="flex gap-[9px] items-start relative">
        <span className="absolute -left-[16px] top-0 text-hld-cyan text-[12px]">∴</span>
        <div className="text-[10.5px] leading-relaxed font-sans text-hld-text font-semibold bg-hld-cyan/5 border-l-2 border-hld-cyan/40 px-[10px] py-[7px]">{argument.conclusion}</div>
      </div>
    </div>
  );
}

function BulletList({ items, status }: { items: string[]; status: 'green' | 'magenta' }) {
  return (
    <div className="flex flex-col gap-[6px]">
      {items.map((item, i) => (
        <div key={i} className="flex gap-[8px] items-start">
          <Pip status={status} size="sm" style={{ marginTop: 5 }} />
          <span className="text-[10px] leading-relaxed font-sans text-hld-text">{item}</span>
        </div>
      ))}
    </div>
  );
}

/** Read-only provenance transcript (the dialogue a refactor came from). */
function SourceTranscript({ dialogue }: { dialogue: DialogueMessage[] }) {
  return (
    <div className="flex flex-col gap-[6px]">
      {dialogue.map((m, i) => (
        <div key={i} className="text-[10px] font-sans leading-relaxed border-l border-hld-border pl-[9px]">
          <span className={`font-mono text-[7px] uppercase tracking-[0.14em] mr-2 ${m.role === 'user' ? 'text-hld-cyan' : 'text-hld-muted'}`}>{m.role === 'user' ? 'You' : 'Partner'}</span>
          <span className="text-hld-text whitespace-pre-wrap">{m.text}</span>
        </div>
      ))}
    </div>
  );
}

function VersionLine({ versions, active, edited, onSelect }: { versions: AnalysisVersion[]; active: AnalysisVersion; edited: boolean; onSelect: (id: string) => void }) {
  return (
    <div>
      <Zone label="Structural read" meta={active.spellName ?? undefined}>
        <span className="inline-flex items-center gap-[3px]">
          <select value={active.id} onChange={(e) => onSelect(e.target.value)} title="Analysis version" className="bg-transparent border-none outline-none font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan cursor-pointer appearance-none text-right">
            {versions.map((v) => <option key={v.id} value={v.id} className="bg-hld-surface text-hld-text normal-case">{v.label}{v.spellName ? ` · ${v.spellName}` : ''} — {versionStamp(v.timestamp)}</option>)}
          </select>
          <span className="text-hld-muted-text text-[8px] pointer-events-none">▾</span>
        </span>
      </Zone>
      {edited && (
        <div className="flex items-center gap-[7px] mt-[7px]">
          <Pip status="yellow" size="sm" />
          <span className="font-mono text-[8.5px] tracking-[0.1em] uppercase text-hld-muted-text">Section edited since — re-analyze to refresh</span>
        </div>
      )}
    </div>
  );
}

function ReanalyzeFooter({ busy, onRun }: { busy: boolean; onRun: () => void }) {
  return (
    <div className="px-[14px] py-[12px] border-t border-hld-border shrink-0">
      <button type="button" onClick={onRun} disabled={busy} className="w-full py-[10px] flex items-center justify-center gap-2 border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 font-mono text-[9px] tracking-[0.14em] uppercase disabled:opacity-40 transition-colors">
        <RefreshCw size={11} /> {busy ? 'Analyzing…' : 'Re-analyze'}
      </button>
    </div>
  );
}

function AnalysisEmpty({ busy, onRun, lensName, onOpenGrimoire }: { busy: boolean; onRun: () => void; lensName: string; onOpenGrimoire: () => void }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#080d13]">
      <div className="px-[14px] pt-[12px]">
        <LensBar name={lensName} onOpen={onOpenGrimoire} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-[16px] p-[24px] text-center">
        <span className="w-[22px] h-[22px] rotate-45 border border-hld-muted" />
        <div className="text-[10.5px] leading-relaxed font-sans text-hld-muted-text max-w-[240px]">
          No structural read yet. Analyze this section to surface its argument — the premises, the hidden assumption, and where it&apos;s open to objection.
        </div>
        <button type="button" onClick={onRun} disabled={busy} style={{ '--br-color': 'var(--color-hld-cyan)' } as CSSProperties} className="bracketed hld-lit px-[22px] py-[11px] flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40">
          <Network size={11} /> {busy ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>
    </div>
  );
}

/** Concepts · Support · Objections · Source — opened one at a time. */
function ReadingIndex({ r, sourceDialogue, ask }: { r: SectionAnalysis; sourceDialogue?: DialogueMessage[]; ask: (ctx: string) => void }) {
  return (
    <div className="mt-[2px]">
      {r.keyConcepts.length > 0 && (
        <Disclosure label="Key concepts" count={r.keyConcepts.length}>
          <div className="flex flex-col gap-[5px]">
            {r.keyConcepts.map((c, i) => (
              <div key={i} className="text-[10px] leading-relaxed font-sans"><span className="font-bold text-hld-text">{c.term}</span><span className="text-hld-muted-text"> — {c.definition}</span></div>
            ))}
            <div className="mt-[4px]"><Ask onAsk={() => ask(interrogateContextFor.concepts(r))} /></div>
          </div>
        </Disclosure>
      )}
      {r.supportingArguments.length > 0 && (
        <Disclosure label="Support" count={r.supportingArguments.length}>
          <BulletList items={r.supportingArguments} status="green" />
          <div className="mt-[2px]"><Ask onAsk={() => ask(interrogateContextFor.support(r))} /></div>
        </Disclosure>
      )}
      {r.potentialObjections.length > 0 && (
        <Disclosure label="Objections" count={r.potentialObjections.length} pip="magenta" defaultOpen>
          <BulletList items={r.potentialObjections} status="magenta" />
          <div className="mt-[6px] flex justify-end">
            <span className="inline-flex items-center px-[9px] py-[5px] border border-hld-cyan/25 bg-hld-cyan/[0.04]">
              <Ask onAsk={() => ask(interrogateContextFor.objections(r))} label="⊕ take this objection to dialogue" />
            </span>
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

  const state = testSuite[currentSection.id]?.analysis;
  const versions = state?.versions ?? [];
  const active = versions.find((v) => v.id === state?.activeVersionId) ?? versions[0];

  if (!active) return <AnalysisEmpty busy={isProcessing} onRun={runAnalysis} lensName={activeSpellName} onOpenGrimoire={openGrimoire} />;

  const r = active.result;
  const ask = (ctx: string) => interrogate(ctx);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#080d13]">
      <div className="flex-1 min-h-0 overflow-y-auto px-[14px] py-[12px] flex flex-col gap-[14px]">
        <LensBar name={activeSpellName} onOpen={openGrimoire} />
        <VersionLine versions={versions} active={active} edited={active.inputHash !== contentHash} onSelect={(id) => setActiveAnalysisVersion(currentSection.id, id)} />

        <div>
          <Zone label="Thesis"><Ask onAsk={() => ask(interrogateContextFor.thesis(r))} /></Zone>
          <div className="mt-[8px] px-[11px] py-[9px] bg-hld-surface2/60 border-t border-hld-border text-[11px] leading-relaxed font-sans text-hld-text">{r.centralThesis}</div>
        </div>

        <div>
          <Zone label="Argument" meta={`${r.argument.premises.length} premises · ${r.argument.implicitPremises.length} implicit`}>
            <Ask onAsk={() => ask(interrogateContextFor.argument(r))} />
          </Zone>
          <ArgumentLadder argument={r.argument} />
        </div>

        <ReadingIndex r={r} sourceDialogue={active.sourceDialogue} ask={ask} />
      </div>

      <ReanalyzeFooter busy={isProcessing} onRun={runAnalysis} />
    </div>
  );
}
