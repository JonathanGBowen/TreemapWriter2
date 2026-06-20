import type {
  Section,
  SectionAnalysis,
  SectionSpec,
  DialogueMessage,
  DiagnosticResult,
  Persona,
  PromptsConfig,
  Dependency,
  TestSuite,
  RevisionProposal,
  RevisionMode,
  AssemblySubMode,
  SourceDocument,
  DirectiveSuggestion,
  ArgumentShape,
  SprintPlan,
  VersionComparison,
  AtmosphericInstrument,
  ReadingMode,
} from '../types';
import type { ModelChoice } from './ai/model-types';

/**
 * AI provider boundary. Components and slices call this interface; only the
 * provider implementation imports `@google/genai`.
 *
 * `continueDialogue` is the first realized streaming method (the Phase-5
 * shape anticipated here all along); further siblings (e.g.
 * `streamCoachAdvice(input): AsyncIterable<string>`) follow the same
 * pattern. Don't preclude that — keep returns typed and don't smuggle SDK
 * objects across the boundary.
 */
export interface AIProvider {
  generateSpecs(input: GenerateSpecsInput): Promise<void>;
  runDiagnostic(input: RunDiagnosticInput): Promise<DiagnosticResult>;
  estimateDependencies(
    input: EstimateDependenciesInput,
  ): Promise<Record<string, Dependency[]>>;
  getCoachAdvice(input: CoachAdviceInput): Promise<string>;
  /**
   * Streaming sibling of `getCoachAdvice` — the same triage/action-plan, but
   * yielded token-by-token so the writer sees the system thinking (the app's
   * preferred accessibility idiom; kills the "is it working?" moment). The
   * non-streaming form is kept for the cache path.
   */
  streamCoachAdvice(input: CoachAdviceInput): AsyncIterable<string>;
  getContentSuggestions(input: ContentSuggestionsInput): Promise<string>;
  generatePersonas(
    input: GeneratePersonasInput,
  ): Promise<PersonaSuggestion[]>;
  refineSpec(input: RefineSpecInput): Promise<string>;
  analyzeSection(input: AnalyzeSectionInput): Promise<SectionAnalysis>;
  refactorAnalysis(input: RefactorAnalysisInput): Promise<SectionAnalysis>;
  continueDialogue(input: ContinueDialogueInput): AsyncIterable<string>;
  generateRevisions(input: GenerateRevisionsInput): Promise<RevisionProposal[]>;
  suggestDirectives(input: SuggestDirectivesInput): Promise<DirectiveSuggestion[]>;
  generateSprintPlan(input: GenerateSprintPlanInput): Promise<SprintPlan>;
  compareVersions(input: CompareVersionsInput): Promise<VersionComparison>;
  analyzeAtmosphere(input: AnalyzeAtmosphereInput): Promise<string>;
}

/** Compact, in-memory backlog summary shown as context chips in the Brief. */
export interface SprintBacklog {
  /** Unfinished paragraphs (heuristic count). */
  unfinishedCount: number;
  /** Days since the section was last touched; null when unknown. */
  lastTouchedDays: number | null;
  /** How many fragments were reattached for reinstatement. */
  fragmentCount: number;
}

export interface GenerateSprintPlanInput {
  sectionTitle: string;
  /** The section being worked (the plan's target). */
  targetSectionId: string;
  /** The structured spec, if the section has one (folds into draft/marshal moves). */
  spec?: SectionSpec;
  /** The writer's stated aim for this session (free text from the Brief). */
  sessionGoal: string;
  /** The chosen shape skeleton to bend; null = freeform. */
  shape: ArgumentShape | null;
  /** Total minutes; the returned durations must sum to totalMin × 60. */
  totalMin: number;
  backlog: SprintBacklog;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface GenerateSpecsInput {
  sections: Section[];
  markdown: string;
  /**
   * Whether the document-level (root) spec pass may include the full document
   * text. Orchestration sets this false when the document exceeds the spec
   * model's context window, degrading the root pass to the outline only (the
   * chapter passes are unaffected). Defaults to full-text when omitted.
   */
  rootFullText?: boolean;
  config: PromptsConfig;
  /** Legacy per-call override (Gemini id). Prefer `modelChoice`. */
  modelId?: string;
  thinkingBudget?: number;
  /** Per-call model override; falls back to the configured model for this kind. */
  modelChoice?: ModelChoice;
  onBatchComplete: (specs: Record<string, SectionSpec>) => void;
  onError?: (error: Error) => void;
}

export interface RunDiagnosticInput {
  section: Section;
  spec: SectionSpec;
  scope: 'segment' | 'parent' | 'full';
  /** Reading stance: 'draft' (default) treats unwritten moves as next steps, not gaps. */
  mode?: ReadingMode;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
  persona: Persona;
  customInstruction: string;
  fullDocument: string;
  sections: Section[];
  config: PromptsConfig;
  findSection: (nodes: Section[], id: string) => Section | null;
  /**
   * Section-id → spec map (with `'root'` holding the document-level spec). When
   * present, the diagnostic builds a structural surround so the section is judged
   * as a part functioning in the whole rather than as an isolated piece.
   */
  specs?: Record<string, SectionSpec | undefined>;
}

export interface EstimateDependenciesInput {
  sections: Section[];
  testSuite: TestSuite;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
  config: PromptsConfig;
}

export interface CoachAdviceInput {
  markdown: string;
  sections: Section[];
  testSuite: TestSuite;
  config: PromptsConfig;
  modelId?: string;
  modelChoice?: ModelChoice;
}

export interface ContentSuggestionsInput {
  sectionTitle: string;
  currentGoals: string;
  fullSectionContent: string;
  parentGoals?: string;
  config: PromptsConfig;
  modelId?: string;
  modelChoice?: ModelChoice;
}

export interface GeneratePersonasInput {
  documentContext: string;
  config: PromptsConfig;
  modelId?: string;
  modelChoice?: ModelChoice;
}

/** Raw persona shape returned by the provider; caller assigns IDs. */
export type PersonaSuggestion = Omit<Persona, 'id'>;

export interface RefineSpecInput {
  sectionTitle: string;
  currentGoals: string;
  fullSectionContent: string;
  parentGoals?: string;
  instruction: string;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface AnalyzeSectionInput {
  sectionTitle: string;
  /** section.fullContent (whole subtree), captured at call time. */
  sectionText: string;
  /**
   * Whole-document (root-level) analysis: send the full text uncapped and frame
   * the request as a document-level reconstruction. The caller is responsible for
   * the context-window pre-flight (see services/ai/context-budget).
   */
  wholeDocument?: boolean;
  /**
   * Active analytical lens ("spell"): a persona + focus layered onto the base
   * analysis prompt. Omitted for a plain exegetical reconstruction.
   */
  spell?: { persona: string; lens: string };
  /**
   * Optional part-in-whole context, pre-formatted by `formatStructuralSurround`.
   * Lets the reconstruction read the section as a part of the whole, not a piece.
   */
  structuralSurround?: string;
  /** Reading stance: 'draft' (default) reconstructs the argument as-is without faulting incompleteness. */
  mode?: ReadingMode;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface RefactorAnalysisInput {
  sectionTitle: string;
  sectionText: string;
  /** The analysis version the dialogue interrogated. */
  analysis: SectionAnalysis;
  dialogue: DialogueMessage[];
  dialogueContext: string | null;
  /** Reading stance, inherited from the Analysis tool. */
  mode?: ReadingMode;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface GenerateRevisionsInput {
  /** Human-readable section label (used to tag each proposal). */
  sectionTitle: string;
  /** The section prose the proposals edit; `original_text` must be a substring. */
  sectionText: string;
  /** What the revision should accomplish (required in revision mode). */
  directive: string;
  mode: RevisionMode;
  subMode: AssemblySubMode;
  /** The sources the model may quote from (every proposal carries a receipt). */
  sources: SourceDocument[];
  /**
   * The grounding Instruction body for a SOURCELESS pass (no sources): steers the
   * engine to ground proposals in the master document itself. Ignored when
   * `sources` is non-empty. Falls back to the built-in default when omitted.
   */
  instruction?: string;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface SuggestDirectivesInput {
  sectionTitle: string;
  /** The section prose to analyze (the "master document" for this pass). */
  sectionText: string;
  /** Optional sources to compare against; directives target the gaps. */
  sources: SourceDocument[];
  /** Active persona name + instruction, to flavor the strategic directives. */
  personaName: string;
  personaInstruction: string;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface ContinueDialogueInput {
  /** What the dialogue is about (from the interrogate affordance). */
  context: string;
  /** Active analysis version, injected into the system instruction. */
  analysis: SectionAnalysis | null;
  /** Full history; the last message is the new user turn. */
  messages: DialogueMessage[];
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface CompareVersionsInput {
  /** Human label for the earlier version (e.g. a timestamp), shown in the report. */
  labelA: string;
  /** Human label for the later version. */
  labelB: string;
  /** Full markdown of version A (the earlier draft). */
  markdownA: string;
  /** Full markdown of version B (the later draft). */
  markdownB: string;
  /**
   * Section headings present in both versions, for alignment scaffolding. The
   * model produces `sectionNotes` keyed by title; this hints which titles align.
   */
  sharedTitles?: string[];
  /**
   * Active comparison lens: a persona + focus layered onto the base compare
   * prompt (the Grimoire "spell" mechanism). Omitted for a plain comparison.
   */
  lens?: { persona: string; lens: string };
  /**
   * Reading stance: 'draft' (the default) treats both texts as works-in-progress
   * and scaffolding as intended; 'final' judges them as completed work. Selects
   * the mode overlay prepended to the base compare prompt.
   */
  mode?: ReadingMode;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface AnalyzeAtmosphereInput {
  /** Which Climate Artist instrument to run. */
  instrument: AtmosphericInstrument;
  /** Whether the text is the whole draft or a single selected section. */
  target: 'document' | 'section';
  /** The section's title, when `target` is 'section' (given to the model for framing). */
  sectionTitle?: string;
  /** The text to read: the whole markdown, or the section's `fullContent`. */
  text: string;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}
