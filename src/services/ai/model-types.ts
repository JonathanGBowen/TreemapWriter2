// Multi-provider model selection — core types.
//
// The app talks to several providers behind one AIProvider interface. A
// `ModelChoice` is the unit of "which model runs this call": a provider id, a
// model string, and an optional Gemini-style numeric thinking budget (ignored
// by providers that don't have one). `AICallKind` enumerates the distinct
// AI calls so the user can configure each independently.
//
// `'agent-sdk'` is the experimental Claude Agent SDK transport: it runs in a
// local Node helper (the SDK is a Node library that can't run in the webview)
// and is reached over localhost. It is opt-in via the global "Agent mode"
// toggle (see resolve-model-choice.ts) and selectable per call kind.

export type ProviderId = 'gemini' | 'anthropic' | 'ollama' | 'agent-sdk';

/**
 * The AI call kinds, named to match the AIProvider methods so the mapping from
 * "a call site" to "its configurable model" is one-to-one and obvious.
 */
export type AICallKind =
  | 'generateSpecs'
  | 'runDiagnostic'
  | 'estimateDependencies'
  | 'getCoachAdvice'
  | 'streamCoachAdvice'
  | 'getContentSuggestions'
  | 'generatePersonas'
  | 'refineSpec'
  | 'analyzeSection'
  | 'refactorAnalysis'
  | 'continueDialogue'
  | 'generateRevisions'
  | 'generateReverseOutline'
  | 'regenerateParagraph'
  | 'analyzeGist'
  | 'composeGist'
  | 'refreshGistSpan'
  | 'refitGist'
  | 'suggestDirectives'
  | 'generateSprintPlan'
  | 'coachSprintTurn'
  | 'decomposeSprintStep'
  | 'compareVersions'
  | 'analyzeAtmosphere'
  | 'developSpecLevel';

/** Every call kind, in display order. The single source of truth for "what is configurable". */
export const AI_CALL_KINDS: AICallKind[] = [
  'generateSpecs',
  'runDiagnostic',
  'estimateDependencies',
  'getCoachAdvice',
  'streamCoachAdvice',
  'getContentSuggestions',
  'generatePersonas',
  'refineSpec',
  'analyzeSection',
  'refactorAnalysis',
  'continueDialogue',
  'generateRevisions',
  'generateReverseOutline',
  'regenerateParagraph',
  'analyzeGist',
  'composeGist',
  'refreshGistSpan',
  'refitGist',
  'suggestDirectives',
  'generateSprintPlan',
  'coachSprintTurn',
  'decomposeSprintStep',
  'compareVersions',
  'analyzeAtmosphere',
  'developSpecLevel',
];

/** Short, glyph-light labels for the per-call override UI. No sentences (HLD). */
export const AI_CALL_KIND_LABELS: Record<AICallKind, string> = {
  generateSpecs: 'Generate specs',
  runDiagnostic: 'Run diagnostic',
  estimateDependencies: 'Estimate dependencies',
  getCoachAdvice: 'Coach advice',
  streamCoachAdvice: 'Coach advice (live)',
  getContentSuggestions: 'Content suggestions',
  generatePersonas: 'Generate personas',
  refineSpec: 'Refine spec',
  analyzeSection: 'Analyze section',
  refactorAnalysis: 'Refactor analysis',
  continueDialogue: 'Dialogue',
  generateRevisions: 'Generate revisions',
  generateReverseOutline: 'Reverse outline',
  regenerateParagraph: 'Regenerate paragraph',
  analyzeGist: 'Gist analysis',
  composeGist: 'Gist composition',
  refreshGistSpan: 'Gist span refresh',
  refitGist: 'Gist re-fit',
  suggestDirectives: 'Suggest directives',
  generateSprintPlan: 'Generate sprint plan',
  coachSprintTurn: 'Sprint coach (live)',
  decomposeSprintStep: 'Break down step',
  compareVersions: 'Compare versions',
  analyzeAtmosphere: 'Atmosphere',
  developSpecLevel: 'Develop spec (live)',
};

/**
 * Which model runs a given call. `thinkingBudget` is a Gemini concept (a token
 * allowance for the reasoning pass); Anthropic maps it coarsely to its own
 * extended-thinking modes and Ollama ignores it entirely.
 */
export interface ModelChoice {
  provider: ProviderId;
  model: string;
  thinkingBudget?: number;
}

/**
 * Per-kind model overrides. Sparse on purpose: an absent kind means "fall
 * through to the global default, then the built-in default". Persisted
 * per-project in the project file (`.twriter/models.json` on desktop).
 */
export type ModelConfig = Partial<Record<AICallKind, ModelChoice>>;
