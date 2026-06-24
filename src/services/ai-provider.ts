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
  ReverseOutlineBullet,
  ParagraphKind,
  ParagraphRewrite,
  DirectiveSuggestion,
  ArgumentShape,
  SprintPlan,
  SprintMove,
  SprintGoalFraming,
  SprintGranularity,
  VersionComparison,
  AtmosphericInstrument,
  ReadingMode,
  GistAnalysis,
  GistComposition,
  GistSegmentAnalysis,
  GistSpan,
  GistBudgets,
} from '../types';
import type { ModelChoice } from './ai/model-types';
import type { SpecStage } from './ai/ai-provider.specs';

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
  /**
   * Parallel Editor flow #1. Distills each input paragraph block to one faithful
   * sentence (a reverse outline), returned 1:1 in document order. Non-prose blocks
   * (headings/lists/code) are echoed; the caller re-aligns by `index`.
   */
  generateReverseOutline(input: GenerateReverseOutlineInput): Promise<ReverseOutlineBullet[]>;
  /**
   * Parallel Editor flow #2. The analogical rewrite: given a paragraph, its faithful
   * distillation, and an edited target distillation, return a minimal, voice/POV-
   * preserving rewrite that realizes the edit. An empty `originalParagraph` is the
   * insertion case (compose a new in-voice paragraph). The `{ original_text,
   * proposed_text }` result feeds `applyProposal` directly. Null ⇒ no usable rewrite.
   */
  regenerateParagraph(input: RegenerateParagraphInput): Promise<ParagraphRewrite | null>;
  /**
   * Gist Editor — Stage A. Extracts per-segment {claims, move, anchor terms, force,
   * transition, weight} + the document thesis + a style fingerprint. Inspectable
   * intermediate state: a bad gist with a good analysis is a composition problem.
   */
  analyzeGist(input: AnalyzeGistInput): Promise<GistAnalysis>;
  /**
   * Gist Editor — Stage B. Writes the three grains (g0 / coarse / fine) from the
   * analysis under the measured budgets. The validate-and-retry loop is the caller's
   * (it owns budgets + ids + fit), so this is one call with an optional `retryReason`.
   */
  composeGist(input: ComposeGistInput): Promise<GistComposition>;
  /** Gist Editor — refresh one stale span in place (Prompt C). Null ⇒ leave it standing. */
  refreshGistSpan(input: RefreshGistSpanInput): Promise<GistSpan | null>;
  /**
   * Gist Editor — compress a grain to a tighter cap without returning to source
   * (Prompt D). Null ⇒ the model reported it can't fit, so fall back a grain.
   */
  refitGist(input: RefitGistInput): Promise<GistSpan[] | null>;
  suggestDirectives(input: SuggestDirectivesInput): Promise<DirectiveSuggestion[]>;
  generateSprintPlan(input: GenerateSprintPlanInput): Promise<SprintPlan>;
  /**
   * Streaming coach turn for the sprint start protocol (the chat / hybrid
   * styles). The ADHD-coaching inquiry rule: it asks rather than tells, and
   * offers the smallest next step when the writer stalls. Mirrors
   * `continueDialogue` — the full (windowed) history travels each turn.
   */
  coachSprintTurn(input: CoachSprintTurnInput): AsyncIterable<string>;
  /**
   * Goblin-style recursive breakdown of ONE step into 2–4 sub-steps. The caller
   * splices the result back in (lib/sprintEdit.replaceStepWithChildren), keeping
   * the plan's total exact.
   */
  decomposeSprintStep(input: DecomposeSprintStepInput): Promise<SprintMove[]>;
  compareVersions(input: CompareVersionsInput): Promise<VersionComparison>;
  analyzeAtmosphere(input: AnalyzeAtmosphereInput): Promise<string>;
  /**
   * Generate ONE level of the spec hierarchy in a single shot — the non-agent
   * path of the Generate-Specs workspace (write a steer note → generate) and its
   * "run all remaining". Root returns `{ root: spec }`; a level returns specs
   * keyed by section id. Parent context comes from the accepted `specCache`.
   */
  generateSpecLevel(input: GenerateSpecLevelInput): Promise<Record<string, SectionSpec>>;
  /**
   * Collaborative, streaming co-development of ONE level's spec with the agent —
   * the Generate-Specs workspace's iterate-with-the-agent path (routed through the
   * Agent SDK when Agent mode is on). Mirrors `continueDialogue`: the full
   * conversation travels each turn, and the model streams prose plus a fenced
   * ```json``` proposal block the caller parses on commit.
   */
  developSpecLevel(input: DevelopSpecLevelInput): AsyncIterable<string>;
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
  /**
   * The coach-captured goal framing (WOOP or plain). When present its `wish`
   * supersedes `sessionGoal` and the obstacle / if-then steer the plan.
   */
  goal?: SprintGoalFraming;
  /** Goblin "spiciness": how finely to decompose. Defaults to coarse. */
  granularity?: SprintGranularity;
  /** Optional free-text context (e.g. a coach-chat transcript) to ground the plan. */
  extraContext?: string;
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

export interface CoachSprintTurnInput {
  /** The section being worked, for framing. */
  sectionTitle: string;
  /** The section's spec, if any (function, main claim, required moves). */
  spec?: SectionSpec;
  /** Which goal model the protocol is running (steers the coach's questions). */
  goalModel: 'woop' | 'plain';
  /** Full conversation history; the last message is the new user turn. */
  messages: DialogueMessage[];
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface DecomposeSprintStepInput {
  /** The section being worked, for framing. */
  sectionTitle: string;
  /** The step to break down. */
  step: SprintMove;
  /** Goblin "spiciness" for the breakdown. Defaults to medium. */
  granularity?: SprintGranularity;
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

/** Shared stage framing for the two per-level spec calls. `specCache` holds the
 *  ACCEPTED specs above this stage (keyed by section id, `'root'` for the doc level). */
interface SpecLevelBase {
  stage: SpecStage;
  sections: Section[];
  markdown: string;
  specCache: Record<string, SectionSpec>;
  /** Root stage only: include the full document text (false degrades to the outline). */
  rootFullText?: boolean;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface GenerateSpecLevelInput extends SpecLevelBase {
  /** The author's free-text guidance for this level (the non-agent "steer note"). */
  steer?: string;
}

export interface DevelopSpecLevelInput extends SpecLevelBase {
  /** Full conversation history; the last message is the new user turn. */
  messages: DialogueMessage[];
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

export interface GenerateReverseOutlineInput {
  /** Human-readable scope label (section title, or the document title for whole-doc). */
  sectionTitle: string;
  /** The paragraph blocks to distill, in document order (prose + heading/list/code). */
  blocks: { index: number; text: string; kind: ParagraphKind }[];
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface RegenerateParagraphInput {
  /** draftA[i] verbatim. EMPTY string ⇒ the insertion case (compose new in-voice). */
  originalParagraph: string;
  /** outlineA[i] — the faithful bullet (empty in the insertion case). */
  faithfulBullet: string;
  /** outlineB[i] — the edited target bullet that drives the rewrite. */
  editedBullet: string;
  /** Light continuity context — the immediately neighboring paragraphs' text. */
  precedingContext?: string;
  followingContext?: string;
  /** Voice/style instruction (from settings; the built-in default ships in the registry). */
  voiceInstruction: string;
  sectionTitle: string;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface AnalyzeGistInput {
  documentTitle: string;
  /** Segments in document order, each tagged with its source Section id + heading. */
  segments: { id: string; heading: string; text: string }[];
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface ComposeGistInput {
  analysis: GistAnalysis;
  /** Coarse-grain (top-level) section ids, in document order. */
  coarseIds: string[];
  /** Fine-grain segment ids, in document order. */
  fineIds: string[];
  budgets: GistBudgets;
  /** Per-fine-segment word targets, by id. */
  perSpanBudgets: Record<string, number>;
  /** An author-approved source/gist exemplar pair, or empty (the highest-leverage knob). */
  houseExemplar?: string;
  /** Appended on the one corrective retry: the prior failure's gate reasons. */
  retryReason?: string;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface RefreshGistSpanInput {
  segmentId: string;
  /** The segment's current full source text. */
  segmentSource: string;
  /** The segment's fresh analysis. */
  analysis: GistSegmentAnalysis;
  /** Word budget for this span. */
  budget: number;
  /** The immutable neighbouring spans (text), for a clean handoff. */
  prevSpan?: string;
  nextSpan?: string;
  modelId?: string;
  thinkingBudget?: number;
  modelChoice?: ModelChoice;
}

export interface RefitGistInput {
  /** The grain to compress (id + text spans), in order. */
  grain: GistSpan[];
  /** Anchor terms per span id that must survive verbatim. */
  anchorTermsBySpan: Record<string, string[]>;
  /** New, tighter hard cap in words. */
  newCap: number;
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
