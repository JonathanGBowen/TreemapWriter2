 
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
  /** The dialogue that produced this version (refactors only). */
  sourceDialogue?: DialogueMessage[];
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
  suggestContentPrompt: string;
  coachPrompt: string;
  refineSpecPrompt: string;
  generatePersonasPrompt: string;
  diagnosticInstruction: string;
  dependenciesPrompt: string;
  analysisPrompt: string;
  refactorAnalysisPrompt: string;
  dialoguePrompt: string;
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