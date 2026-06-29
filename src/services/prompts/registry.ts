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
import developSpecPrompt from './develop-spec.md?raw';
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
import generateReverseOutlinePrompt from './generate-reverse-outline.md?raw';
import regenerateParagraphPrompt from './regenerate-paragraph.md?raw';
import reconstructWholePrompt from './reconstruct-whole.md?raw';
import recenterPrompt from './recenter.md?raw';
import gistAnalysisPrompt from './gist-analysis.md?raw';
import gistCompositionPrompt from './gist-composition.md?raw';
import generateSprintPlanPrompt from './generate-sprint-plan.md?raw';
import sprintCoachPrompt from './sprint-coach.md?raw';
import decomposeStepPrompt from './decompose-step.md?raw';
import compareVersionsPrompt from './compare-versions.md?raw';
import specTestPrompt from './spec-test.md?raw';
import specTestWholePrompt from './spec-test-whole.md?raw';
import weatherReportPrompt from './weather-report.md?raw';
import radarScanPrompt from './radar-scan.md?raw';
import stormSpotterPrompt from './storm-spotter.md?raw';
import forecastPrompt from './forecast.md?raw';
// Engine-internal ("do not soften these") — catalogued but locked: never
// persisted, never user-editable, always resolve to the default text below.
import revisionAssemblySystem from './revision-assembly-system.md?raw';
import revisionTask from './revision-task.md?raw';
import revisionAssemblyVerbatimTask from './revision-assembly-verbatim-task.md?raw';
import revisionAssemblyWovenTask from './revision-assembly-woven-task.md?raw';
import revisionTaskSourceless from './revision-task-sourceless.md?raw';
import revisionInstructionDefault from './revision-instruction-default.md?raw';
import regenerateVoiceDefault from './regenerate-voice-default.md?raw';
import gistRefreshSpanPrompt from './gist-refresh.md?raw';
import gistRefitPrompt from './gist-refit.md?raw';
import citationsSystem from './citations-system.md?raw';
import citationsTask from './citations-task.md?raw';
import suggestDirectivesTemplate from './suggest-directives.md?raw';
import revisionAgentPreamble from './revision-agent.md?raw';
// Draft-in-process reading overlays (locked): prepended to the evaluative tools'
// base prompts when their mode is 'draft' (the default).
import compareModeDraft from './compare-mode-draft.md?raw';
import specTestModeDraft from './spec-test-mode-draft.md?raw';
import analysisModeDraft from './analysis-mode-draft.md?raw';
import diagnosticModeDraft from './diagnostic-mode-draft.md?raw';

const strip = (s: string) => s.replace(/\n+$/, '');

export type PromptCategory =
  | 'spec-generation'
  | 'diagnostics-coaching'
  | 'generation'
  | 'analysis-dialogue'
  | 'revision-engine'
  | 'sprints'
  | 'comparison'
  | 'climate';

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
    key: 'developSpecPrompt',
    defaultText: strip(developSpecPrompt),
    label: 'Spec Co-Development',
    description:
      'Generate-Specs workspace: the conversation + output contract for iterating on a level’s spec with the agent (reuses the per-level task prompts as the field rubric).',
    category: 'spec-generation',
    flow: 'developSpecLevel',
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
    key: 'generateReverseOutlinePrompt',
    defaultText: strip(generateReverseOutlinePrompt),
    label: 'Reverse Outline',
    description:
      'Parallel Editor: distills each paragraph to its single load-bearing sentence (a faithful reverse outline, not a summary).',
    category: 'revision-engine',
    flow: 'generateReverseOutline',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'regenerateParagraphPrompt',
    defaultText: strip(regenerateParagraphPrompt),
    label: 'Paragraph Regenerator',
    description:
      'Parallel Editor: analogical, minimal-edit rewrite of one paragraph to realize an edited reverse-outline bullet (voice/POV preserving; also composes an inserted paragraph in-voice).',
    category: 'revision-engine',
    flow: 'regenerateParagraph',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'reconstructWholePrompt',
    defaultText: strip(reconstructWholePrompt),
    label: 'Whole From Part',
    description:
      "Gestalt coherence probe (the \"Beethoven test\"): reconstruct the document's overarching claim from one section read alone, then judge how far the part has drifted from the whole.",
    category: 'analysis-dialogue',
    flow: 'reconstructWhole',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'recenterPrompt',
    defaultText: strip(recenterPrompt),
    label: 'Recenter',
    description:
      "The unstick move (Umzentrierung): proposes alternative structural centerings of a section and asks whether the section's goal itself is right for the whole.",
    category: 'diagnostics-coaching',
    flow: 'proposeRecenterings',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'gistAnalysisPrompt',
    defaultText: strip(gistAnalysisPrompt),
    label: 'Gist Analysis',
    description:
      'Gist Editor (Stage A): extracts per-segment claims, move, anchor terms, force, transition, and weight, plus the document thesis and a style fingerprint — the inspectable input to composition.',
    category: 'generation',
    flow: 'analyzeGist',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'gistCompositionPrompt',
    defaultText: strip(gistCompositionPrompt),
    label: 'Gist Composition',
    description:
      "Gist Editor (Stage B): writes the three grains (g0 / coarse / fine) in the document's own voice — compress by deletion, never abstraction. The exemplar here is the highest-leverage knob (swap in a house source/gist pair).",
    category: 'generation',
    flow: 'composeGist',
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
    key: 'sprintCoachPrompt',
    defaultText: strip(sprintCoachPrompt),
    label: 'Sprint Coach',
    description: 'Living Sprints: the conversational coach that helps define the session goal (inquiry rule; WOOP-aware).',
    category: 'sprints',
    flow: 'coachSprintTurn',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'decomposeStepPrompt',
    defaultText: strip(decomposeStepPrompt),
    label: 'Step Decomposer',
    description: 'Living Sprints: Goblin-style recursive breakdown of one sprint step into smaller sub-steps.',
    category: 'sprints',
    flow: 'decomposeSprintStep',
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
  {
    key: 'specTestPrompt',
    defaultText: strip(specTestPrompt),
    label: 'Spec Test — Part',
    description:
      'Spec-anchored A/B whole-test: scores ONE section across two versions against the held rubric, move by move (with the productive/recapitulative axis), judged AS A PART — catches piece-improvements that cost the whole (tF).',
    category: 'comparison',
    flow: 'runSpecTestSection',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'specTestWholePrompt',
    defaultText: strip(specTestWholePrompt),
    label: 'Spec Test — Whole',
    description:
      'Spec-anchored A/B whole-test: the WHOLE verdict — did B serve the whole better than A, or only the pieces? Reads the role-skeleton + mesh delta for center-of-gravity drift and tF/fT, never a sum of section verdicts.',
    category: 'comparison',
    flow: 'runSpecTestWhole',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'weatherReportPrompt',
    defaultText: strip(weatherReportPrompt),
    label: 'Weather Report',
    description:
      'Climate Artist: atmospheric reading of a completed text — intensity, substance, and mechanisms.',
    category: 'climate',
    flow: 'analyzeAtmosphere',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'radarScanPrompt',
    defaultText: strip(radarScanPrompt),
    label: 'Radar Scan',
    description:
      "Climate Artist: a draft-wide atmospheric map — developing cells, turkey towers, fronts, latent instability.",
    category: 'climate',
    flow: 'analyzeAtmosphere',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'stormSpotterPrompt',
    defaultText: strip(stormSpotterPrompt),
    label: 'Storm Spotter',
    description: 'Climate Artist: close-range diagnosis of one passage — what is forming, what disrupts it.',
    category: 'climate',
    flow: 'analyzeAtmosphere',
    editability: 'editable',
    variables: [],
  },
  {
    key: 'forecastPrompt',
    defaultText: strip(forecastPrompt),
    label: 'Forecast',
    description:
      'Climate Artist: atmospheric projection for an incomplete work — developing systems, debt, trajectory.',
    category: 'climate',
    flow: 'analyzeAtmosphere',
    editability: 'editable',
    variables: [],
  },
  // --- Locked engine internals (not in PromptsConfig, never persisted) ---
  // Draft-in-process reading overlays, prepended to the evaluative tools' base
  // prompts when their mode is 'draft' (the default). 'final' prepends nothing.
  {
    key: 'compareModeDraft',
    defaultText: strip(compareModeDraft),
    label: 'Compare — Draft Mode',
    description: 'Draft-in-process overlay for Version Compare: scaffolding is not a loss; lean into continuity.',
    category: 'comparison',
    flow: 'compareVersions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'specTestModeDraft',
    defaultText: strip(specTestModeDraft),
    label: 'Spec Test — Draft Mode',
    description: 'Draft-in-process overlay for the Spec Test: a still-missing move is scaffolding; reserve regressions for genuine backsliding; read a deflated move as a cut opportunity (fT).',
    category: 'comparison',
    flow: 'runSpecTestSection',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'analysisModeDraft',
    defaultText: strip(analysisModeDraft),
    label: 'Analysis — Draft Mode',
    description: 'Draft-in-process overlay for Analysis: reconstruct the argument as-is without faulting incompleteness.',
    category: 'analysis-dialogue',
    flow: 'analyzeSection',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'diagnosticModeDraft',
    defaultText: strip(diagnosticModeDraft),
    label: 'Diagnostic — Draft Mode',
    description: 'Draft-in-process overlay for Diagnostic: a missing move is a next step, not a failure.',
    category: 'diagnostics-coaching',
    flow: 'runDiagnostic',
    editability: 'locked',
    variables: [],
  },
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
    key: 'revisionTaskSourceless',
    defaultText: strip(revisionTaskSourceless),
    label: 'Revision Task (Sourceless)',
    description:
      'Revision task used when no sources are present: ground proposals in the document itself, no source receipt. Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'revisionInstructionDefault',
    defaultText: strip(revisionInstructionDefault),
    label: 'Default Instruction',
    description:
      'The shipped default grounding Instruction for a sourceless revision pass. The text is editable in the Revision Settings; this catalogues the built-in default.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'regenerateVoiceDefault',
    defaultText: strip(regenerateVoiceDefault),
    label: 'Default Voice',
    description:
      'Parallel Editor: the shipped default voice/style instruction for paragraph regeneration. Editable in the Parallel settings; this catalogues the built-in default.',
    category: 'revision-engine',
    flow: 'regenerateParagraph',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'gistRefreshSpanPrompt',
    defaultText: strip(gistRefreshSpanPrompt),
    label: 'Gist Span Refresh',
    description:
      'Gist Editor: regenerates exactly one stale span in place, taking the handoff from its immutable neighbours. Engine internal — not user-editable.',
    category: 'generation',
    flow: 'refreshGistSpan',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'gistRefitPrompt',
    defaultText: strip(gistRefitPrompt),
    label: 'Gist Re-fit',
    description:
      'Gist Editor: compresses a grain to a tighter cap without returning to source (drops flavour before any claim; emits {fits:false} to fall back a grain). Engine internal — not user-editable.',
    category: 'generation',
    flow: 'refitGist',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'citationsSystem',
    defaultText: strip(citationsSystem),
    label: 'Citations System',
    description:
      'Glass Box Citations mode: audits how the draft uses cited sources (quote fidelity, faithful representation, APA citations, references). Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'generateRevisions',
    editability: 'locked',
    variables: [],
  },
  {
    key: 'citationsTask',
    defaultText: strip(citationsTask),
    label: 'Citations Task',
    description:
      'Citations-mode task: quote correction, anti-strawman fidelity checks, APA in-text citations, and references. Engine internal — not user-editable.',
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
  {
    key: 'revisionAgentPreamble',
    defaultText: strip(revisionAgentPreamble),
    label: 'Deep Revision Agent',
    description:
      'Glass Box deep pass: the system preamble for the bounded local agent — gather cross-section / manuscript-search / history context, then emit RevisionProposal[] JSON for the unchanged accept gate. Engine internal — not user-editable.',
    category: 'revision-engine',
    flow: 'runAgent',
    editability: 'locked',
    variables: [],
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
