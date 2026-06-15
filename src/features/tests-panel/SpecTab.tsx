import { useMemo } from "react";
import { Section, SectionSpec, SectionFunction, TestSuiteEntry } from "../../types";
import { SECTION_FUNCTIONS } from "../../lib/constants";
import { useStore } from "../../state";
import { useCurrentSection } from "./use-current-section";
import { Pip } from "../shared/Pip";
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

/** Claim & function — folded by default (reference, not the actionable core).
 *  The function picker is monochrome; the claim keeps its editable left hairline. */
function ClaimDisclosure({ spec, onClaim, onFunction }: { spec: SectionSpec; onClaim: (t: string) => void; onFunction: (f: SectionFunction) => void }) {
  const fn = SECTION_FUNCTIONS.find((f) => f.id === spec.function);
  return (
    <Disclosure label="Claim & function" count={fn?.label ?? spec.function}>
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center gap-[8px]">
          <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text-2 shrink-0">Function</span>
          <span className="inline-flex items-center gap-[3px]">
            <select
              value={spec.function}
              onChange={(e) => onFunction(e.target.value as SectionFunction)}
              title="Section function"
              className="bg-transparent border-none outline-none font-mono text-[9px] font-semibold tracking-[0.12em] uppercase text-hld-text cursor-pointer appearance-none"
            >
              {SECTION_FUNCTIONS.map((f) => <option key={f.id} value={f.id} className="bg-hld-surface text-hld-text normal-case">{f.label}</option>)}
            </select>
            <span className="text-hld-muted-text text-[8px] pointer-events-none">▾</span>
          </span>
        </div>
        <textarea
          value={spec.mainClaim}
          onChange={(e) => onClaim(e.target.value)}
          rows={2}
          placeholder="The core proposition — what makes this section necessary?"
          className="w-full pl-[11px] border-l-2 border-hld-border focus:border-hld-cyan text-[13px] leading-relaxed font-sans text-hld-text bg-transparent outline-none resize-none placeholder-hld-muted/50 min-h-[3.2em] transition-colors"
        />
      </div>
    </Disclosure>
  );
}

/** The "do this next" hero — a calm cyan callout (tint + border only; no brackets
 *  or glow — those are reserved for the one lit action). Body text is monochrome. */
function NextCard({ text }: { text: string }) {
  return (
    <div className="px-[15px] py-[14px] bg-[rgba(0,232,245,0.05)] border border-hld-cyan/30">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-hld-cyan mb-[7px] flex items-center gap-[7px]">
        <Pip status="cyan" /> Do this next
      </div>
      <div className="text-[13px] leading-relaxed font-sans text-hld-text">{text}</div>
    </div>
  );
}

function ContextList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text-2 mb-[4px]">{label}</div>
      <div className="flex flex-col gap-[5px]">
        {items.map((t, i) => <div key={i} className="text-[12px] leading-relaxed font-sans text-hld-text pl-[9px] border-l border-hld-border">{t}</div>)}
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
            <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text-2 mb-[4px]">Coherence</div>
            <div className="flex flex-col gap-[5px]">
              {coherenceNotes.map((n, i) => <div key={i} className="text-[12px] leading-relaxed font-sans text-hld-muted-text-2 pl-[9px] border-l border-hld-border">{n}</div>)}
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
      <div className="font-mono text-[9px] font-bold tracking-[0.12em] uppercase mb-[4px]" style={{ color: pass ? 'var(--color-hld-green)' : 'var(--color-hld-magenta)' }}>
        {pass ? 'Pass' : 'Needs revision'}
      </div>
      <p className="text-[13px] leading-relaxed font-sans text-hld-text">{critique}</p>
    </div>
  );
}

/** The diagnosed-spec scroll body (only mounted when a spec exists). Default view
 *  is NEXT → Moves (the actionable core); claim, dependencies and context fold. */
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
    <div className="flex-1 min-h-0 overflow-y-auto px-[16px] py-[16px] flex flex-col gap-[18px]">
      {diagnostic && <NextCard text={diagnostic.nextPriority} />}
      <MoveList spec={spec} diagnostic={diagnostic} onEdit={editMove} onAdd={addMove} onRemove={removeMove} onRefine={() => setShowSpecModal(true)} />
      <ClaimDisclosure spec={spec} onClaim={setClaim} onFunction={setFunction} />
      <DependencyChips sectionId={id} dependencies={entry.dependencies || []} flatSections={flatSections} testSuite={testSuite} onUpdate={(deps) => updateDependencies(id, deps)} />
      <ContextDisclosure spec={spec} coherenceNotes={diagnostic?.coherenceNotes || []} />
      {!diagnostic && entry.lastResult && <LegacyResult status={entry.status} critique={entry.lastResult.critique} />}
    </div>
  );
}

/** Spec-tab moves subline for the header: "{done} of {total} moves done". */
function movesMeta(spec: SectionSpec | undefined, entry: TestSuiteEntry | undefined): string | undefined {
  if (!spec) return undefined;
  const total = spec.requiredMoves.length;
  const diag = entry?.lastDiagnostic;
  if (diag) return `${diag.moveResults.filter((m) => m.status === 'present').length} of ${total} moves done`;
  return `${total} ${total === 1 ? 'move' : 'moves'}`;
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
      <PanelHeader section={currentSection} diagnostic={entry?.lastDiagnostic} meta={movesMeta(spec, entry)} />
      {spec && entry ? (
        <SpecBody id={id} spec={spec} entry={entry} flatSections={flatSections} />
      ) : (
        <EmptyState goals={goals} onGoalsChange={(t) => updateSectionGoals(id, t, 'manual')} onGenerate={() => setShowSpecModal(true)} />
      )}
      <PanelFooter runDisabled={!spec && !goals} />
    </div>
  );
}
