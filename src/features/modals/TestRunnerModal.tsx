import React, { useState, useMemo } from "react";
import { Section, Persona, SectionSpec, ReadingMode } from "../../types";
import { buildDiagnosticPrompt, DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { buildStructuralSurround, formatStructuralSurround } from "../../lib/diagnostic-helpers";
import { useStore } from "../../store";
import { useModelChoice } from "./use-model-choice";
import { ModalShell } from "./ModalShell";
import { SegControl, type SegOption } from "./SegControl";
import { Disclosure } from "../shared/Disclosure";
import { Pip } from "../shared/Pip";
import { CopyButton } from "../shared/CopyButton";
import { resolveDepthChoice, tierOf, depthModelLabel } from "./depth-choice";
import type { ModelTier } from "../../services/ai/model-catalog";
import type { ModelChoice } from "../../services/ai/model-types";

type Scope = 'segment' | 'parent' | 'full';

interface TestRunnerModalProps {
  onRun: (scope: Scope, choice: ModelChoice, instruction: string, mode: ReadingMode) => void;
  sectionTitle: string;
  currentSection: Section | null;
  currentSpec?: SectionSpec;
  documentStats: { wordCount: number; sectionCount: number; depth: number };
  activePersona: Persona;
  allSections: Section[];
  fullDocument: string;
}

const DEPTH_TIERS: ModelTier[] = ['fast', 'deep'];
const SCOPE_IDS: Scope[] = ['segment', 'parent', 'full'];
const SCOPE_LABELS = ['This section', 'With chapter', 'Whole draft'];
const SCOPE_SPEED = ['fast', '', 'slow'];

function findSectionDeep(nodes: Section[], id: string): Section | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findSectionDeep(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Tiny block-diagram glyph: one cell / cell-in-outline / all cells. Picks up the seg color. */
function ScopeGlyph({ kind }: { kind: Scope }) {
  const cell = (on: boolean, key: number) => (
    <span
      key={key}
      style={{ width: 9, height: 6, border: '1px solid currentColor', background: on ? 'currentColor' : 'transparent', opacity: on ? 1 : 0.45, display: 'inline-block' }}
    />
  );
  if (kind === 'segment') return <span style={{ display: 'inline-flex', gap: 2 }}>{cell(false, 1)}{cell(true, 2)}{cell(false, 3)}</span>;
  if (kind === 'parent')
    return (
      <span style={{ display: 'inline-flex' }}>
        <span style={{ width: 22, height: 10, border: '1px solid currentColor', opacity: 0.55, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 9, height: 6, background: 'currentColor' }} />
        </span>
      </span>
    );
  return <span style={{ display: 'inline-flex', gap: 2 }}>{cell(true, 1)}{cell(true, 2)}{cell(true, 3)}</span>;
}

function scopeContextWords(scope: Scope, currentSection: Section | null, docWords: number): number {
  if (!currentSection) return 0;
  if (scope === 'segment') return currentSection.fullContent.split(/\s+/).length;
  if (scope === 'parent') return currentSection.fullContent.split(/\s+/).length * 3;
  return docWords;
}

function buildCopyText(p: {
  currentSection: Section | null;
  scope: Scope;
  fullDocument: string;
  allSections: Section[];
  currentSpec: SectionSpec | undefined;
  specs: Record<string, SectionSpec | undefined>;
  personaInstruction: string;
  customInstruction: string;
}): string {
  const { currentSection } = p;
  if (!currentSection) return '';
  let content = currentSection.fullContent;
  if (p.scope === 'full') content = p.fullDocument;
  else if (p.scope === 'parent' && currentSection.parentId) {
    const parent = findSectionDeep(p.allSections, currentSection.parentId);
    if (parent) content = parent.fullContent;
  }
  const spec: SectionSpec = p.currentSpec ?? { function: 'argue', mainClaim: '', requiredMoves: [], incomingContext: [], outgoingCommitments: [] };
  // Mirror the live prompt: the whole-document pass is already the whole; every
  // narrower scope gets the section's part-in-whole surround.
  const structuralSurround =
    currentSection.id === 'root'
      ? ''
      : formatStructuralSurround(buildStructuralSurround(currentSection.id, p.allSections, p.specs));
  return buildDiagnosticPrompt({
    baseInstruction: DEFAULT_PROMPTS_CONFIG.diagnosticInstruction,
    personaInstruction: p.personaInstruction,
    customInstruction: p.customInstruction,
    sectionTitle: currentSection.title,
    sectionFunction: spec.function,
    mainClaim: spec.mainClaim,
    requiredMoves: spec.requiredMoves,
    incomingContext: spec.incomingContext,
    outgoingCommitments: spec.outgoingCommitments,
    scope: p.scope,
    content: content.slice(0, 12000),
    structuralSurround,
  });
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({
  onRun, sectionTitle, currentSection, currentSpec, documentStats, activePersona, allSections, fullDocument,
}) => {
  const isOpen = useStore((s) => s.showRunModal);
  const setShow = useStore((s) => s.setShowRunModal);
  const setShowPersonaModal = useStore((s) => s.setShowPersonaModal);
  const catalog = useStore((s) => s.modelCatalog);
  const testSuite = useStore((s) => s.testSuite);
  const diagnosticMode = useStore((s) => s.diagnosticMode);
  const setDiagnosticMode = useStore((s) => s.setDiagnosticMode);
  const onClose = () => setShow(false);
  const [scope, setScope] = useState<Scope>('segment');
  const [choice, setChoice] = useModelChoice('runDiagnostic', isOpen);
  const [customInstruction, setCustomInstruction] = useState("");

  const isRoot = currentSection?.id === 'root';
  // Root evaluates the whole document; segment/parent are meaningless there.
  const effScope: Scope = isRoot ? 'full' : scope;

  const thinkingBudget = choice.thinkingBudget ?? 0;
  const estimate = useMemo(() => {
    const input = Math.ceil(scopeContextWords(effScope, currentSection, documentStats.wordCount) * 1.3);
    return input + thinkingBudget + 500;
  }, [effScope, thinkingBudget, currentSection, documentStats]);

  if (!isOpen) return null;

  const scopeOptions: SegOption[] = SCOPE_IDS.map((id, i) => {
    const tokens = Math.ceil(scopeContextWords(id, currentSection, documentStats.wordCount) * 1.3);
    return {
      glyph: <ScopeGlyph kind={id} />,
      label: SCOPE_LABELS[i],
      fine: `~${(tokens / 1000).toFixed(0)}k${SCOPE_SPEED[i] ? ` · ${SCOPE_SPEED[i]}` : ''}`,
    };
  });
  const depthIndex = tierOf(catalog, choice) === 'deep' ? 1 : 0;
  const depthOptions: SegOption[] = DEPTH_TIERS.map((tier, i) => ({
    glyph: i === 0 ? '»' : '◆',
    label: i === 0 ? 'Fast' : 'Deep',
    fine: depthModelLabel(catalog, choice, tier),
  }));

  const specs: Record<string, SectionSpec | undefined> = Object.fromEntries(
    Object.entries(testSuite).map(([id, e]) => [id, e?.spec]),
  );
  const copyText = buildCopyText({
    currentSection, scope: effScope, fullDocument, allSections, currentSpec, specs,
    personaInstruction: activePersona.instruction, customInstruction,
  });

  return (
    <ModalShell
      accent="magenta"
      eyebrow="AI · Evaluation"
      title={`Run Diagnostic — ${sectionTitle}`}
      onClose={onClose}
      onPrimary={() => onRun(effScope, choice, customInstruction, diagnosticMode)}
      primaryLabel="▶ Run"
    >
      <div className="flex flex-col gap-[16px]">
        <div>
          <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-hld-muted-text-2 mb-[8px]">Scope</div>
          {isRoot ? (
            <div className="px-[10px] py-[8px] border border-hld-border bg-hld-surface-2 font-mono text-[10px] tracking-[0.06em] text-hld-text">
              Whole document — evaluates the entire draft
            </div>
          ) : (
            <SegControl ariaLabel="Evaluation scope" options={scopeOptions} value={SCOPE_IDS.indexOf(scope)} onChange={(i) => setScope(SCOPE_IDS[i])} />
          )}
        </div>
        <div>
          <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-hld-muted-text-2 mb-[8px]">Depth</div>
          <SegControl ariaLabel="Evaluation depth" options={depthOptions} value={depthIndex} onChange={(i) => setChoice(resolveDepthChoice(catalog, choice, DEPTH_TIERS[i]))} />
        </div>
        <div title="Draft: a missing or partial move is your next step, not a failure. Completed: missing moves are gaps in finished work.">
          <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-hld-muted-text-2 mb-[8px]">Read as</div>
          <SegControl
            ariaLabel="Diagnostic reading mode"
            options={[
              { glyph: '✎', label: 'Draft', fine: 'in process' },
              { glyph: '✓', label: 'Completed', fine: 'finished' },
            ]}
            value={diagnosticMode === 'final' ? 1 : 0}
            onChange={(i) => setDiagnosticMode(i === 1 ? 'final' : 'draft')}
          />
        </div>

        <Disclosure label="Focus the evaluator" count="optional">
          <div className="flex flex-col gap-[10px]">
            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              className="w-full h-20 p-[9px] text-[11px] leading-relaxed border border-hld-border bg-hld-surface-2 text-hld-text focus:border-hld-cyan outline-none resize-none font-mono placeholder-hld-muted/50"
              placeholder="e.g. 'be harsh about logical fallacies', 'focus on citation formatting'"
            />
            <div className="flex justify-end">
              <CopyButton text={copyText} title="Copy diagnostic prompt to clipboard" />
            </div>
          </div>
        </Disclosure>

        <div className="flex items-center gap-[8px] text-[11px] text-hld-muted-text-2">
          <Pip status="dim" size="sm" />
          <span className="shrink-0">Evaluator:</span>
          <button
            type="button"
            onClick={() => setShowPersonaModal(true)}
            title="Change evaluator persona"
            className="truncate border-b border-hld-border hover:text-hld-cyan hover:border-hld-cyan/40 transition-colors"
          >
            {activePersona.name}
          </button>
          <span className="text-hld-muted shrink-0">·</span>
          <span className="shrink-0">≈ {(estimate / 1000).toFixed(1)}k tokens</span>
        </div>
      </div>
    </ModalShell>
  );
};
