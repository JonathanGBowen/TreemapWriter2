import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Section, SectionSpec, SectionFunction, TestSuiteEntry } from "../../types";
import { SECTION_FUNCTIONS } from "../../lib/constants";
import { useStore } from "../../state";
import { useCurrentSection } from "./use-current-section";
import { Zone } from "../shared/Zone";
import { Disclosure } from "../shared/Disclosure";
import { PanelHeader } from "./PanelHeader";
import { MoveList } from "./MoveList";
import { DependencyChips } from "./DependencyChips";
import { PanelFooter } from "./PanelFooter";
import { EmptyState } from "./EmptyState";

function flatten(sections: Section[]) {
  const flat: { id: string; title: string; level: number }[] = [];
  const walk = (nodes: Section[]) => nodes.forEach((n) => { flat.push({ id: n.id, title: n.title, level: n.level }); walk(n.children); });
  walk(sections);
  return flat;
}

/** CLAIM zone: eyebrow + function picker chip + editable claim (left hairline). */
function ClaimZone({ spec, onClaim, onFunction }: { spec: SectionSpec; onClaim: (t: string) => void; onFunction: (f: SectionFunction) => void }) {
  return (
    <div>
      <Zone label="Claim">
        <span className="inline-flex items-center gap-[3px]">
          <select
            value={spec.function}
            onChange={(e) => onFunction(e.target.value as SectionFunction)}
            title="Section function"
            className="bg-transparent border-none outline-none font-mono text-[9px] font-bold tracking-[0.12em] uppercase text-hld-magenta cursor-pointer appearance-none"
          >
            {SECTION_FUNCTIONS.map((f) => <option key={f.id} value={f.id} className="bg-hld-surface text-hld-text normal-case">{f.label}</option>)}
          </select>
          <span className="text-hld-magenta text-[8px] pointer-events-none">▾</span>
        </span>
      </Zone>
      <textarea
        value={spec.mainClaim}
        onChange={(e) => onClaim(e.target.value)}
        rows={2}
        placeholder="The core proposition — what makes this section necessary?"
        className="w-full mt-[7px] pl-[9px] border-l-2 border-hld-border focus:border-hld-cyan text-[10px] leading-relaxed font-sans text-hld-text bg-transparent outline-none resize-none placeholder-hld-muted/50 min-h-[3.2em] transition-colors"
      />
    </div>
  );
}

function NextCard({ text }: { text: string }) {
  return (
    <div className="bracketed hld-lit cursor-default px-[12px] py-[10px]" style={{ '--br-color': 'var(--color-hld-cyan)' } as CSSProperties}>
      <div className="font-mono text-[8px] tracking-[0.18em] uppercase mb-[4px]">▸ Next</div>
      <div className="text-[10px] leading-relaxed font-sans text-hld-cyan/90">{text}</div>
    </div>
  );
}

function ContextList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="font-mono text-[8px] tracking-[0.12em] uppercase text-hld-muted-text mb-[4px]">{label}</div>
      <div className="flex flex-col gap-[5px]">
        {items.map((t, i) => <div key={i} className="text-[10px] leading-relaxed font-sans text-hld-text pl-[9px] border-l border-hld-border">{t}</div>)}
      </div>
    </div>
  );
}

function ContextDisclosure({ spec, coherenceNotes }: { spec: SectionSpec; coherenceNotes: string[] }) {
  const count = spec.incomingContext.length + spec.outgoingCommitments.length + coherenceNotes.length;
  if (count === 0) return null;
  return (
    <Disclosure label="Context & commitments" count={count}>
      <div className="flex flex-col gap-[10px]">
        {spec.incomingContext.length > 0 && <ContextList label="Receives from prior" items={spec.incomingContext} />}
        {spec.outgoingCommitments.length > 0 && <ContextList label="Must establish for later" items={spec.outgoingCommitments} />}
        {coherenceNotes.length > 0 && (
          <div>
            <div className="font-mono text-[8px] tracking-[0.12em] uppercase text-hld-yellow mb-[4px]">Coherence</div>
            <div className="flex flex-col gap-[5px]">
              {coherenceNotes.map((n, i) => <div key={i} className="text-[10px] leading-relaxed font-sans text-hld-muted-text pl-[9px] border-l border-hld-border">{n}</div>)}
            </div>
          </div>
        )}
      </div>
    </Disclosure>
  );
}

function LegacyResult({ status, critique }: { status: string; critique?: string }) {
  const pass = status === 'success';
  return (
    <div className={`p-[10px] border ${pass ? 'border-hld-green bg-hld-green/5' : 'border-hld-magenta bg-hld-magenta/5'}`}>
      <div className="font-mono text-[9px] font-bold tracking-[0.14em] uppercase mb-[4px]" style={{ color: pass ? 'var(--color-hld-green)' : 'var(--color-hld-magenta)' }}>
        {pass ? 'Pass' : 'Needs revision'}
      </div>
      <p className="text-[10px] leading-relaxed font-sans text-hld-text">{critique}</p>
    </div>
  );
}

/** The diagnosed-spec scroll body (only mounted when a spec exists). Owns the
 *  spec-edit handlers, keeping the SpecTab orchestrator simple. */
function SpecBody({ id, spec, entry, flatSections }: { id: string; spec: SectionSpec; entry: TestSuiteEntry; flatSections: ReturnType<typeof flatten> }) {
  const testSuite = useStore((s) => s.testSuite);
  const updateSpec = useStore((s) => s.updateSpec);
  const updateMainClaim = useStore((s) => s.updateMainClaim);
  const updateDependencies = useStore((s) => s.updateDependencies);
  const setShowSpecModal = useStore((s) => s.setShowSpecModal);
  const diagnostic = entry.lastDiagnostic;

  const writeMoves = (requiredMoves: SectionSpec['requiredMoves']) => updateSpec(id, { ...spec, requiredMoves });
  const editMove = (i: number, text: string) => writeMoves(spec.requiredMoves.map((m, idx) => (idx === i ? { ...m, description: text } : m)));
  const addMove = () => writeMoves([...spec.requiredMoves, { id: `move-${spec.requiredMoves.length}`, description: '' }]);
  const removeMove = (i: number) => writeMoves(spec.requiredMoves.filter((_, idx) => idx !== i));
  const setClaim = (t: string) => { updateSpec(id, { ...spec, mainClaim: t }); updateMainClaim(id, t); };
  const setFunction = (f: SectionFunction) => updateSpec(id, { ...spec, function: f });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-[14px] py-[12px] flex flex-col gap-[14px]">
      {diagnostic && <NextCard text={diagnostic.nextPriority} />}
      <ClaimZone spec={spec} onClaim={setClaim} onFunction={setFunction} />
      <MoveList spec={spec} diagnostic={diagnostic} onEdit={editMove} onAdd={addMove} onRemove={removeMove} onRefine={() => setShowSpecModal(true)} />
      <DependencyChips sectionId={id} dependencies={entry.dependencies || []} flatSections={flatSections} testSuite={testSuite} onUpdate={(deps) => updateDependencies(id, deps)} />
      <ContextDisclosure spec={spec} coherenceNotes={diagnostic?.coherenceNotes || []} />
      {!diagnostic && entry.lastResult && <LegacyResult status={entry.status} critique={entry.lastResult.critique} />}
    </div>
  );
}

/** The Spec tab: orientation header → NEXT → the spec with verdicts on it → act. */
export function SpecTab() {
  const sections = useStore((s) => s.sections);
  const testSuite = useStore((s) => s.testSuite);
  const updateSectionGoals = useStore((s) => s.updateSectionGoals);
  const setShowSpecModal = useStore((s) => s.setShowSpecModal);
  const currentSection = useCurrentSection();
  const flatSections = useMemo(() => flatten(sections), [sections]);

  if (!currentSection) return null;

  const id = currentSection.id;
  const entry = testSuite[id];
  const spec = entry?.spec;
  const goals = entry?.goals || '';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#080d13]">
      <PanelHeader section={currentSection} status={entry?.status || 'idle'} diagnostic={entry?.lastDiagnostic} />
      {spec && entry ? (
        <SpecBody id={id} spec={spec} entry={entry} flatSections={flatSections} />
      ) : (
        <EmptyState goals={goals} onGoalsChange={(t) => updateSectionGoals(id, t, 'manual')} onGenerate={() => setShowSpecModal(true)} />
      )}
      <PanelFooter runDisabled={!spec && !goals} />
    </div>
  );
}
