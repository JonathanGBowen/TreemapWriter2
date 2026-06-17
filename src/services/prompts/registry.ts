// The single source of truth for the prompt INVENTORY. Every LLM prompt the app
// uses is catalogued here exactly once: its persisted key, its default text (the
// raw `.md` content — prompts are content, not code), and the metadata that
// drives management surfaces (label, description, grouping, the flow that uses
// it, whether a user may edit it, and any declared template variables).
//
// Everything downstream is DERIVED from this file: the `PromptsConfig` type
// (src/types/index.ts), `DEFAULT_PROMPTS_CONFIG`, and the tier-resolution
// helpers (./index.ts). Adding a prompt is a one-place edit here — drop a `.md`,
// import it, append an entry. Do NOT inline prompt text in TypeScript.
//
// This module imports NOTHING from `../../types` (it PRODUCES the key type that
// `PromptsConfig` is built from). Keep that edge one-directional to avoid a cycle.

import systemInstruction from './system-instruction.md?raw';
import l1TaskInstruction from './l1-task.md?raw';
import subTaskInstruction from './sub-task.md?raw';
import rootTaskInstruction from './root-task.md?raw';
import suggestContentPrompt from './suggest-content.md?raw';
import coachPrompt from './coach.md?raw';
import refineSpecPrompt from './refine-spec.md?raw';
import generatePersonasPrompt from './generate-personas.md?raw';
import diagnosticInstruction from './diagnostic.md?raw';
import dependenciesPrompt from './dependencies.md?raw';
import analysisPrompt from './analysis.md?raw';
import refactorAnalysisPrompt from './refactor-analysis.md?raw';
import dialoguePrompt from './dialogue.md?raw';
import generateRevisionsPrompt from './generate-revisions.md?raw';
import generateSprintPlanPrompt from './generate-sprint-plan.md?raw';
import compareVersionsPrompt from './compare-versions.md?raw';
// Engine-internal ("do not soften these") — catalogued but locked: never
// persisted, never user-editable, always resolve to the default text below.
import revisionAssemblySystem from './revision-assembly-system.md?raw';
import revisionTask from './revision-task.md?raw';
import revisionAssemblyVerbatimTask from './revision-assembly-verbatim-task.md?raw';
import revisionAssemblyWovenTask from './revision-assembly-woven-task.md?raw';
import suggestDirectivesTemplate from './suggest-directives.md?raw';

const strip = (s: string) => s.replace(/\n+$/, '');

export type PromptCategory =
  | 'spec-generation'
  | 'diagnostics-coaching'
  | 'generation'
  | 'analysis-dialogue'
  | 'revision-engine'
  | 'sprints'
  | 'comparison';

/**
 * `editable` prompts are user-tunable, land in `PromptsConfig`, and are
 * persisted + overridable per project / globally. `locked` prompts are engine
 * internals: catalogued here for legibility but excluded from `PromptsConfig`,
 * never persisted, and always rendered from `defaultText`.
 */
export type PromptEditability = 'editable' | 'locked';

/** A `{{TOKEN}}` placeholder a prompt expects at render time. */
export interface PromptVariable {
  token: string;
  description: string;
  required: boolean;
}

export interface PromptEntry {
  /** Persisted key. For editable prompts this IS the `PromptsConfig` field name. */
  key: string;
  /** Default prompt text (trailing newline stripped). */
  defaultText: string;
  /** Human label for management UIs. */
  label: string;
  /** One-line explanation for management UIs. */
  description: string;
  category: PromptCategory;
  /** The AIProvider flow that consumes it — documentation + future grouping. */
  flow: string;
  editability: PromptEditability;
  /** Declared `{{TOKEN}}` placeholders (may be empty). */
  variables: readonly PromptVariable[];
}

export const PROMPT_REGISTRY = [
  {
    key: 'systemInstruction',
    defaultText: strip(systemInstruction),
    label: 'System Instruction',
    description: 'Core behavior and constraints shared by the spec-generation passes.',
    category: 'spec-generation',
    flow: 'generateSpecs',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'rootTaskInstruction',
    defaultText: strip(rootTaskInstruction),
    label: 'Document Spec',
    description:
      "Document-level (root) pass: reconstructs the whole work's thesis and macro-arcs, which constrain the chapter specs below it.",
    category: 'spec-generation',
    flow: 'generateSpecs',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'l1TaskInstruction',
    defaultText: strip(l1TaskInstruction),
    label: 'Chapter Spec',
    description:
      'How chapters (top-level sections) are specified — kept consistent with the document spec above.',
    category: 'spec-generation',
    flow: 'generateSpecs',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'subTaskInstruction',
    defaultText: strip(subTaskInstruction),
    label: 'Subsection Spec',
    description: 'How subsections are specified, inheriting constraints from their parent section.',
    category: 'spec-generation',
    flow: 'generateSpecs',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'refineSpecPrompt',
    defaultText: strip(refineSpecPrompt),
    label: 'Spec Refiner',
    description: "The rules used when manually refining a section's specification.",
    category: 'spec-generation',
    flow: 'refineSpec',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'generatePersonasPrompt',
    defaultText: strip(generatePersonasPrompt),
    label: 'Persona Generator',
    description: 'Generates AI reviewer personas from a sample of the document.',
    category: 'diagnostics-coaching',
    flow: 'generatePersonas',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'diagnosticInstruction',
    defaultText: strip(diagnosticInstruction),
    label: 'Diagnostic',
    description: 'Assesses a section against its specification, move by move.',
    category: 'diagnostics-coaching',
    // Structurally assembled by buildDiagnosticPrompt() in lib/constants.ts —
    // this is the editable base instruction, not a {{token}} template.
    flow: 'runDiagnostic',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'coachPrompt',
    defaultText: strip(coachPrompt),
    label: 'Coach',
    description: 'The framework the ADHD Coach uses to turn diagnostics into an actionable writing plan.',
    category: 'diagnostics-coaching',
    flow: 'generateCoachAdvice',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'suggestContentPrompt',
    defaultText: strip(suggestContentPrompt),
    label: 'Content Suggester',
    description: "The ghostwriter used when generating content suggestions from a section's spec.",
    category: 'generation',
    flow: 'suggestContent',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'dependenciesPrompt',
    defaultText: strip(dependenciesPrompt),
    label: 'Dependency Estimator',
    description: 'Identifies prerequisites and references between sections.',
    category: 'generation',
    flow: 'estimateDependencies',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'analysisPrompt',
    defaultText: strip(analysisPrompt),
    label: 'Analysis',
    description: "Reconstructs a section's argument: thesis, key concepts, premises, conclusion, objections.",
    category: 'analysis-dialogue',
    flow: 'analyzeSection',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'refactorAnalysisPrompt',
    defaultText: strip(refactorAnalysisPrompt),
    label: 'Refactor',
    description: 'Folds a Socratic dialogue back into a refined analysis version.',
    category: 'analysis-dialogue',
    flow: 'refactorAnalysis',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'dialoguePrompt',
    defaultText: strip(dialoguePrompt),
    label: 'Socratic Partner',
    description: 'The Socratic partner that interrogates parts of an analysis with the author.',
    category: 'analysis-dialogue',
    flow: 'dialogue',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'generateRevisionsPrompt',
    defaultText: strip(generateRevisionsPrompt),
    label: 'Revision Engine',
    description: 'The Glass Box engine: proposes source-traceable revision edits, each with a verbatim receipt.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'generateSprintPlanPrompt',
    defaultText: strip(generateSprintPlanPrompt),
    label: 'Sprint Planner',
    description: 'Living Sprints: bends an argument shape into a timed, section-specific plan of writing moves.',
    category: 'sprints',
    flow: 'generateSprintPlan',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'compareVersionsPrompt',
    defaultText: strip(compareVersionsPrompt),
    label: 'Version Compare',
    description:
      'Version Compare: an exegetical A/B evaluation of two saved versions — drift, improvements, and possible losses.',
    category: 'comparison',
    flow: 'compareVersions',
    editability: 'editable',
    variables: [],
  },
  // --- Locked engine internals (not in PromptsConfig, never persisted) ---
  {
    key: 'revisionAssemblySystem',
    defaultText: strip(revisionAssemblySystem),
    label: 'Assembly System',
    description: 'Glass Box assembly-mode system instruction. Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'revisionTask',
    defaultText: strip(revisionTask),
    label: 'Revision Task',
    description: 'Standard (non-assembly) revision task instruction. Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'revisionAssemblyVerbatimTask',
    defaultText: strip(revisionAssemblyVerbatimTask),
    label: 'Assembly Task (Verbatim)',
    description: 'Verbatim assembly task instruction. Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'revisionAssemblyWovenTask',
    defaultText: strip(revisionAssemblyWovenTask),
    label: 'Assembly Task (Woven)',
    description: 'Woven assembly task instruction. Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'suggestDirectivesTemplate',
    defaultText: strip(suggestDirectivesTemplate),
    label: 'Directive Suggester',
    description:
      'Persona-flavored pass proposing 2-3 strategic revision directives. Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'suggestDirectives',
    editability: 'locked',
    variables: [
      { token: 'PERSONA_NAME', description: 'Active reviewer persona name.', required: true },
      { token: 'PERSONA_DESCRIPTION', description: 'Active persona instruction text.', required: true },
      {
        token: 'SOURCE_CONTEXT_INSTRUCTION',
        description: 'Phrasing that depends on whether source documents are present.',
        required: true,
      },
    ],
  },
] as const satisfies readonly PromptEntry[];

/** The persisted keys of the user-editable prompts — i.e. the `PromptsConfig` fields. */
export type EditablePromptKey = Extract<
  (typeof PROMPT_REGISTRY)[number],
  { editability: 'editable' }
>['key'];

/** The editable subset, in registry order. Source for `DEFAULT_PROMPTS_CONFIG`. */
export const EDITABLE_PROMPTS = PROMPT_REGISTRY.filter((e) => e.editability === 'editable');

const BY_KEY = new Map<string, PromptEntry>(PROMPT_REGISTRY.map((e) => [e.key, e]));

/** Look up a prompt entry by key. Throws on an unknown key (a programming error). */
export const getPromptEntry = (key: string): PromptEntry => {
  const entry = BY_KEY.get(key);
  if (!entry) throw new Error(`Unknown prompt key: ${key}`);
  return entry;
};

/** Convenience: the default text for a prompt key (incl. locked engine internals). */
export const getPromptText = (key: string): string => getPromptEntry(key).defaultText;
