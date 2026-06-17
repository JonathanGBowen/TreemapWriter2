 
export interface Section {
  id: string;
  title: string;
  level: number;
  content: string;
  fullContent: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  wordCount: number;
  children: Section[];
  parentId: string | null;
}
 
// --- STRUCTURED SPEC SYSTEM ---
 
/** 
 * The rhetorical/argumentative function a section performs in the document.
 * This replaces the vague "goal" string with a typed classification that
 * constrains what "success" means for this section.
 */
export type SectionFunction = 
  | 'introduce'    // Sets up the problem space, motivates what follows
  | 'explicate'    // Unpacks a concept, theory, or framework
  | 'argue'        // Advances a claim with supporting reasons
  | 'compare'      // Puts two or more positions in productive tension
  | 'critique'     // Identifies problems with a position
  | 'synthesize'   // Integrates multiple strands into a unified view
  | 'apply'        // Uses a framework to analyze a case or phenomenon
  | 'evaluate'     // Assesses the adequacy of something against criteria
  | 'narrate'      // Traces a historical or conceptual development
  | 'transition';  // Bridges between major parts of the argument
 
/**
 * A concrete, paragraph-level thing the section must DO.
 * These are the bridging tasks — specific enough to act on,
 * abstract enough to not dictate prose.
 */
export interface RequiredMove {
  id: string;
  description: string;
  /** Optional: which other move this should follow */
  after?: string;
}
 
/**
 * The structured specification for a section. Replaces the flat
 * { goals: string, mainClaim: string } with something that
 * actually specifies what the section needs to accomplish.
 */
export interface SectionSpec {
  /** What this section does in the argument */
  function: SectionFunction;
  /** The core proposition — a logician's one-sentence reconstruction */
  mainClaim: string;
  /** Concrete things the section must DO, at paragraph-level granularity */
  requiredMoves: RequiredMove[];
  /** Concepts/claims this section receives from prior sections */
  incomingContext: string[];
  /** What this section must establish for later sections to build on */
  outgoingCommitments: string[];
}
 
// --- DIAGNOSTIC SYSTEM ---
 
export type MoveStatus = 'present' | 'partial' | 'missing' | 'unclear';
 
export interface MoveResult {
  moveId: string;
  moveDescription: string;
  status: MoveStatus;
  /** Where in the text it appears, or where it should appear */
  location?: string;
  /** What specifically is wrong or incomplete */
  diagnosis?: string;
  /** A concrete next action — at the point of performance */
  suggestedAction?: string;
}
 
export type ReadinessLevel = 'draft' | 'developing' | 'nearly-there' | 'solid';
 
export interface DiagnosticResult {
  moveResults: MoveResult[];
  /** Cross-section coherence issues */
  coherenceNotes: string[];
  /** Overall assessment — NOT a pass/fail */
  overallReadiness: ReadinessLevel;
  /** Brief summary of the most important thing to work on next */
  nextPriority: string;
}
 
// --- SECTION ANALYSIS SYSTEM ---

/**
 * Exegetical reconstruction of a section's argument. This is structural
 * analysis, not summary: it recovers what the text actually argues —
 * thesis, premises (stated and implicit), conclusion — grounded only in
 * the section's own words.
 */
export interface SectionAnalysis {
  centralThesis: string;
  keyConcepts: { term: string; definition: string }[];
  argument: {
    premises: string[];
    implicitPremises: string[];
    conclusion: string;
  };
  supportingArguments: string[];
  potentialObjections: string[];
}

export interface DialogueMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AnalysisVersion {
  id: string;
  timestamp: number;
  /** Generated, terse: "analysis 1", "refactor 2" */
  label: string;
  kind: 'analysis' | 'refactor';
  result: SectionAnalysis;
  /** Hash of section.fullContent at generation time — drives the stale badge. */
  inputHash: string;
  modelId?: string;
  /** The analytical lens (spell) that produced this version, if any — shown in the version picker. */
  spellName?: string;
  /** The dialogue that produced this version (refactors only). */
  sourceDialogue?: DialogueMessage[];
}

/**
 * An analytical "spell" (lens): a named reading stance applied to the Analysis
 * pass. The base analysis prompt stays the schema backbone; a spell layers a
 * persona (the role the model adopts) and a lens (the analytical focus) on top.
 * Built-ins live in `lib/defaultSpells.ts`; custom spells form a global library.
 */
export interface AnalysisSpell {
  id: string;
  name: string;
  /** The role the model adopts, e.g. "A strict logician trained in classical syllogisms." */
  persona: string;
  /** The analytical focus layered onto the base analysis prompt. */
  lens: string;
}

/**
 * Per-section analysis workbench state. Versions accumulate newest-first
 * (they are history, never invalidated). The in-progress dialogue is
 * persisted — never lose data — and cleared only by a successful refactor,
 * which preserves the transcript on the new version's `sourceDialogue`.
 */
export interface SectionAnalysisState {
  versions: AnalysisVersion[];
  activeVersionId: string | null;
  dialogue: DialogueMessage[];
  /** What the dialogue is currently about (set by the interrogate affordance). */
  dialogueContext: string | null;
}

// --- VERSION COMPARISON (A/B EVALUATION) ---
// An exegetical comparison of two saved versions (git snapshots) of the
// document: not a textual diff (the `diff` package already does that) but a
// structural read of how the ARGUMENT changed — drift, gains, losses, and
// shifts in the moves. Structure, not summary. Ephemeral/regenerable: never
// persisted, produced on demand by `AIProvider.compareVersions`.

/**
 * Net direction of version B relative to version A. Not a grade — a vector. An
 * honest revision is often 'mixed' (gains here, losses there) or 'lateral'
 * (changed without clearly improving), and the report must be able to say so.
 */
export type ComparisonDirection = 'improved' | 'regressed' | 'mixed' | 'lateral';

/**
 * A verbatim excerpt grounding a comparison claim — the same "no claim without
 * a receipt" guarantee the revision engine makes (cf. `RevisionProposal`).
 * `side` records which version the quote is lifted from.
 */
export interface ComparisonReceipt {
  quote: string;
  side: 'a' | 'b';
}

/**
 * One discrete change between the versions: an improvement, a loss, or a shift
 * in the argument's moves. Grounded in verbatim quotes; phrased in the spec
 * vocabulary (`RequiredMove` / `mainClaim` / `SectionFunction`) where it fits.
 */
export interface ComparisonChange {
  /** The change in one line. */
  summary: string;
  /** Which argument-move or aspect it touches (echoes RequiredMove language). */
  aspect?: string;
  /** Verbatim grounding from version A and/or B. */
  receipts: ComparisonReceipt[];
}

/**
 * Per-section comparison, for a section that exists (by heading title) in one
 * or both versions. A section present on only one side is itself a structural
 * fact worth surfacing — an added or excised section moves the argument.
 */
export interface SectionComparisonNote {
  /** Heading title used to align the two versions (NOT a slug id). */
  sectionTitle: string;
  presentInA: boolean;
  presentInB: boolean;
  direction: ComparisonDirection;
  note: string;
}

/**
 * The structured result of an exegetical A/B comparison: how the argument moved
 * from version A to version B. It reconstructs drift, gains, losses, and shifts
 * in the moves — each grounded in the text — rather than restating what either
 * draft says.
 */
export interface VersionComparison {
  /** Net direction of B relative to A. */
  direction: ComparisonDirection;
  /** A one-paragraph overall read of the revision. */
  verdict: string;
  /** How the thesis / throughline / commitments moved between versions. */
  conceptualDrift: string;
  /** What got stronger, each grounded in the text. */
  improvements: ComparisonChange[];
  /** What was weakened, dropped, or lost. */
  losses: ComparisonChange[];
  /** Changes to the argument's moves and structure. */
  moveChanges: ComparisonChange[];
  /** Per-section notes, where sections align by heading title. */
  sectionNotes: SectionComparisonNote[];
  /** The comparison lens applied, if any (audit trail). */
  lensName?: string;
}

// --- GLASS BOX REVISION ENGINE ---

/**
 * The kind of edit a revision proposal makes. Mirrors the Glass Box engine's
 * `revision_type` vocabulary; each maps to a chip color (revisionTypeColors.ts).
 */
export type RevisionType =
  | 'Addition'
  | 'Replacement'
  | 'Deletion'
  | 'Rewording'
  | 'Citation'
  | 'Tone Adjustment'
  | 'Flow Improvement'
  | 'Assembly';

/** Revision (sharpen existing prose) vs Assembly (stitch sources into new prose). */
export type RevisionMode = 'revision' | 'assembly';

/** Assembly sub-mode: quote sources verbatim, or weave them into original prose. */
export type AssemblySubMode = 'verbatim' | 'woven';

/**
 * A source document the revision engine may quote from. Ephemeral (session-only):
 * the writer pastes advisor notes / reviewer reports / reading notes when revising;
 * sources are NOT persisted to the project file.
 */
export interface SourceDocument {
  id: string;
  /** Short category, e.g. "Advisor", "Review", "Reading", "Voice". */
  kind: string;
  /** Human label shown on the chip. */
  label: string;
  /** A single glyph icon (HLD style). */
  glyph: string;
  /** The full source text the model may quote. */
  content: string;
}

/**
 * One auditable revision proposal. Every proposal carries a verbatim quote from a
 * named source — the "glass box" guarantee: no claim without a receipt. Acceptance
 * is a literal `original_text → proposed_text` replace (no fuzzy matching).
 */
export interface RevisionProposal {
  id: string;
  revision_type: RevisionType;
  /** Human-readable section label the proposal targets. */
  section: string;
  /** Exact substring of the section the edit replaces. */
  original_text: string;
  /** The proposed replacement prose. */
  proposed_text: string;
  /** Why the edit is warranted, grounded in the source. */
  rationale: string;
  /** Which SourceDocument the receipt comes from. */
  source_id: string;
  /** The verbatim quote from that source justifying the edit. */
  verbatim_source_quote: string;
  /** Model confidence, 0–5. */
  confidence_score: number;
}

/** Review lifecycle of a proposal within a session. */
export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

/** A suggested revision directive: a short title + the actionable instruction. */
export interface DirectiveSuggestion {
  title: string;
  directive: string;
}

// --- LEGACY COMPAT + COMBINED SUITE ---

export interface TestResult {
  passed: boolean;
  critique: string;
  suggestions: string[];
}
 
export interface SpecHistoryItem {
  timestamp: number;
  goals: string;
  instruction?: string;
  type: 'manual' | 'ai-generate' | 'ai-refine';
}
 
export interface Dependency {
  id: string;
  type: 'prerequisite' | 'reference';
}
 
export interface TestSuiteEntry {
  /** Legacy flat goal string — kept for backward compat and manual override */
  goals: string;
  /** The new structured spec */
  spec?: SectionSpec;
  /** Legacy test result */
  lastResult?: TestResult;
  /** New diagnostic result */
  lastDiagnostic?: DiagnosticResult;
  status: 'idle' | 'running' | 'success' | 'fail' | 'stale';
  history?: SpecHistoryItem[];
  dependencies?: Dependency[];
  /** Legacy standalone claim field — now lives in spec.mainClaim too */
  mainClaim?: string;
  cachedSuggestions?: {
    inputHash: string;
    suggestions: string;
  };
  /** Per-section structured analysis + Socratic dialogue (Analysis/Dialogue tabs). */
  analysis?: SectionAnalysisState;
}
 
export interface TestSuite {
  [sectionId: string]: TestSuiteEntry;
}
 
export interface Persona {
  id: string;
  name: string;
  role: string;
  instruction: string;
}
 
export interface Snapshot {
  id: string;
  timestamp: number;
  trigger: 'manual' | 'autosave' | 'pre-ai-write';
  affectedScope: 'all' | { sectionIds: string[] };
  contentHash: string;
  markdown: string;
  testSuite: TestSuite;
  interpolationConfig?: PromptsConfig;
}

/**
 * Lightweight commit metadata — the blob-free projection of a `Snapshot` (no
 * markdown/testSuite), as returned by the Rust `snapshot_list` command. Lets us
 * index deep history cheaply (e.g. the Version Compare day picker) without
 * reading file blobs; full content is fetched lazily per selected commit via
 * `Repository.readSnapshot`. `trigger` is a raw string (parsed from the commit
 * message) — treat unknown values as routine autosaves.
 */
export interface SnapshotMeta {
  id: string;
  timestamp: number;
  trigger: string;
  affectedScope: 'all' | { sectionIds: string[] };
  contentHash: string;
  message: string;
}
 
export interface ProjectMeta {
  id: string;
  name: string;
  lastModified: number;
  wordCount: number;
  /**
   * Absolute folder path on disk. Set by the Tauri repository (Phase 3+);
   * always undefined under the browser repository. The JS layer caches
   * `id → path` from `getMeta()` and uses it to drive `project_open`.
   */
  path?: string;
}
 
export interface PromptsConfig {
  systemInstruction: string;
  l1TaskInstruction: string;
  subTaskInstruction: string;
  /** Document-level (root) spec pass — the top of the hierarchy, above chapters. */
  rootTaskInstruction: string;
  suggestContentPrompt: string;
  coachPrompt: string;
  refineSpecPrompt: string;
  generatePersonasPrompt: string;
  diagnosticInstruction: string;
  dependenciesPrompt: string;
  analysisPrompt: string;
  refactorAnalysisPrompt: string;
  dialoguePrompt: string;
  /** Glass Box revision engine: source-traceable proposal generation. */
  generateRevisionsPrompt: string;
  /** Living Sprints: bends an argument shape into a timed, section-specific plan. */
  generateSprintPlanPrompt: string;
  /** Version Compare: exegetical A/B evaluation of two saved versions. */
  compareVersionsPrompt: string;
}

// --- LIVING SPRINTS TYPES ---
// A sprint runs an ordered sequence of timed *moves* for one target section
// (not a march over all sections). A move is mostly a RequiredMove + a clock +
// concrete instructions. Plans are ephemeral run-state (never persisted);
// shapes are read-only seed data in `lib/argumentShapes.ts`.

/**
 * Drives a move's accent + ambient hue (see the design token table):
 * reinstate=green · frame=cyan · marshal=yellow · draft=cyan · stress=orange ·
 * synthesize/bridge=purple.
 */
export type SprintMoveRole =
  | 'reinstate'
  | 'frame'
  | 'marshal'
  | 'draft'
  | 'stress'
  | 'synthesize'
  | 'bridge';

export interface SprintMove {
  id: string;
  /** Short imperative label, e.g. "Draft the reply". */
  title: string;
  /** Concrete instruction lines (the checklist). */
  instructions: string[];
  /** Seconds for this move; strict auto-advance fires at 0. */
  durationSec: number;
  /** Role drives the accent color + ambient hue. */
  role: SprintMoveRole;
  /** Optional link back to the SectionSpec move this realizes. */
  fromRequiredMoveId?: string;
}

export interface SprintPlan {
  /** Which ArgumentShape seeded it (null = freeform / AI / goal plan). */
  shapeId: string | null;
  /** The single section this sprint works. */
  targetSectionId: string;
  /** Total seconds — the sum of every move's durationSec. */
  totalSec: number;
  /** moves[0] is conventionally the Reinstate move. */
  moves: SprintMove[];
}

export interface ArgumentShape {
  id: string;
  name: string;
  description: string;
  /** Move templates with *relative* weights; scaled to the chosen total at runtime. */
  moves: Array<Omit<SprintMove, 'id' | 'durationSec'> & { weight: number }>;
}

// --- PHASE 4 SYNC TYPES ---
// Wire-format mirrors of src-tauri/src/types.rs. Rust enums are externally
// tagged with `tag = "kind"`; TS discriminated unions match.

export type PullOutcome =
  | { kind: 'upToDate' }
  | { kind: 'fastForwarded'; commits: number }
  /** Divergent but conflict-free: merged + committed automatically. */
  | { kind: 'merged'; commits: number }
  /** Divergent with real conflicts; nothing written. Drives the resolution modal. */
  | { kind: 'mergeRequired'; theirCommit: string; baseHead: string; conflicts: ConflictFile[] }
  /** Local and remote share no common ancestor; refused. */
  | { kind: 'unrelatedHistories' }
  | { kind: 'workingTreeDirty' }
  | { kind: 'noRemote' };

/** One conflicted path. Text fields are absent for binary/non-UTF-8 sides. */
export interface ConflictFile {
  path: string;
  kind: 'text' | 'binary' | 'modifyDelete';
  base?: string;
  ours?: string;
  theirs?: string;
  /** Conflict-markered 3-way merge (text conflicts only). */
  merged?: string;
  automergeable: boolean;
  ourDeleted: boolean;
  theirDeleted: boolean;
}

/** The user's choice per conflicted path, sent to `sync_resolve_merge`. */
export type Resolution =
  | { kind: 'content'; path: string; text: string }
  | { kind: 'ours'; path: string }
  | { kind: 'theirs'; path: string }
  | { kind: 'delete'; path: string };

export type ResolveOutcome =
  | { kind: 'resolved'; commits: number }
  /** HEAD moved / tree dirtied since detect; re-pull and reopen. */
  | { kind: 'stale' }
  | { kind: 'noRemote' }
  /** Could not apply; nothing committed, local work intact. */
  | { kind: 'failed'; reason: string };

/** Latched conflict state held in ui-state while the resolution modal is live. */
export interface PendingMerge {
  theirCommit: string;
  baseHead: string;
  conflicts: ConflictFile[];
}

export type PushOutcome =
  | { kind: 'upToDate' }
  | { kind: 'pushed'; commits: number }
  | { kind: 'nonFastForward' }
  | { kind: 'noRemote' };

export interface SyncState {
  hasRemote: boolean;
  remoteUrl: string | null;
  ahead: number;
  behind: number;
  /** True if tracked files have uncommitted edits. */
  workingTreeDirty: boolean;
  /** Current local branch name, e.g. "main". Null if HEAD detached or no commits. */
  branch: string | null;
}