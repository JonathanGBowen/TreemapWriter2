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
  | 'directiveDialogueTurn'
  | 'exegeteSource'
  | 'generateSprintPlan'
  | 'coachSprintTurn'
  | 'decomposeSprintStep'
  | 'compareVersions'
  | 'runSpecTestSection'
  | 'runSpecTestWhole'
  | 'analyzeAtmosphere'
  | 'developSpecLevel'
  | 'segmentSpan'
  | 'discoverStructuralParts'
  | 'reconstructWhole'
  | 'proposeRecenterings'
  | 'runAgent';

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
  'directiveDialogueTurn',
  'exegeteSource',
  'generateSprintPlan',
  'coachSprintTurn',
  'decomposeSprintStep',
  'compareVersions',
  'runSpecTestSection',
  'runSpecTestWhole',
  'analyzeAtmosphere',
  'developSpecLevel',
  'segmentSpan',
  'discoverStructuralParts',
  'reconstructWhole',
  'proposeRecenterings',
  'runAgent',
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
  directiveDialogueTurn: 'Directive dialogue (live)',
  exegeteSource: 'Source exegesis',
  generateSprintPlan: 'Generate sprint plan',
  coachSprintTurn: 'Sprint coach (live)',
  decomposeSprintStep: 'Break down step',
  compareVersions: 'Compare versions',
  runSpecTestSection: 'Spec test (part)',
  runSpecTestWhole: 'Spec test (whole)',
  analyzeAtmosphere: 'Atmosphere',
  developSpecLevel: 'Develop spec (live)',
  segmentSpan: 'Articulate (segment)',
  discoverStructuralParts: 'Discover parts',
  reconstructWhole: 'Whole from part',
  proposeRecenterings: 'Recenter',
  runAgent: 'Local agent',
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

/** Whether a rate-limit error names a per-MINUTE or per-DAY quota. */
export type QuotaScope = 'per-minute' | 'per-day';

/**
 * Provider-neutral quota hints a thrown error MAY carry. A provider's client (the
 * only code that understands that provider's structured error shape) parses a
 * rate-limit response and attaches these; the provider-agnostic policy in
 * `model-fallback.ts` reads them WITHOUT importing any client — so the leaf stays
 * pure. Both fields are best-effort: absent ⇒ fall back to text/status heuristics.
 */
export interface QuotaAnnotatedError {
  /** Definitive minute-vs-day classification parsed from the structured error. */
  __quotaScope?: QuotaScope;
  /** Server-suggested retry delay (ms), e.g. from Gemini's RetryInfo. */
  __retryDelayMs?: number;
}
