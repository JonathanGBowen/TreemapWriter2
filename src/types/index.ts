import type { EditablePromptKey } from '../services/prompts/registry';

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

/**
 * Whether a move *advances* the argument or merely *recapitulates* what the reader
 * already has — Wertheimer's distinction (Syllogisms in Productive Thinking) between a
 * step that "forges ahead" and one that is true yet "says nothing." Orthogonal to
 * `status`: a move can be `present` and `recapitulative` at once (usually a cut
 * opportunity). See docs/gestalt-design-II.md L1.
 */
export type MoveAdvance = 'productive' | 'recapitulative';

export interface MoveResult {
  moveId: string;
  moveDescription: string;
  status: MoveStatus;
  /** Does this move add something new, or only restate what is already secured? */
  advance?: MoveAdvance;
  /** Where in the text it appears, or where it should appear */
  location?: string;
  /** What specifically is wrong or incomplete */
  diagnosis?: string;
  /** A concrete next action — at the point of performance */
  suggestedAction?: string;
}

export type ReadinessLevel = 'draft' | 'developing' | 'nearly-there' | 'solid';

/**
 * A structural break between a section and its neighbours, judged against the part's
 * live commitment-mesh (its incoming context vs. upstream outgoing commitments, and its
 * outgoing commitments vs. downstream needs). See docs/gestalt-design-II.md L2.
 * - `unmet-incoming`: this section relies on context the preceding section never laid.
 * - `dangling-outgoing`: this section's commitment is undelivered, or unused downstream.
 * - `center-of-gravity`: locally true, yet in its place pulls against what the whole needs.
 */
export type CommitmentFindingKind = 'unmet-incoming' | 'dangling-outgoing' | 'center-of-gravity';

export interface CommitmentFinding {
  kind: CommitmentFindingKind;
  /** Concrete description of the break. */
  detail: string;
  /** The neighbouring section involved, when one applies. */
  relatedSectionTitle?: string;
}

/**
 * The next step framed as a located gap + the vector that fills it (Wertheimer's
 * productive-thinking unit), in *demand* rhetoric — what the structure now requires,
 * not a chore to summon will for. See docs/gestalt-design-II.md L4.
 */
export interface NextAction {
  /** The specific structural trouble and where it sits. */
  gap: string;
  /** Optional pin into the text. */
  location?: string;
  /** The direction that makes the ends meet — the concrete move that resolves the gap. */
  vector: string;
}

export interface DiagnosticResult {
  moveResults: MoveResult[];
  /** Cross-section coherence issues */
  coherenceNotes: string[];
  /** Commitment-mesh / center-of-gravity breaks: this section judged as a PART. */
  commitmentFindings?: CommitmentFinding[];
  /** Overall assessment — NOT a pass/fail */
  overallReadiness: ReadinessLevel;
  /** The next step as a located gap → vector (preferred when present). */
  nextAction?: NextAction;
  /** Brief summary of the most important thing to work on next (fallback for nextAction) */
  nextPriority: string;
}

// --- PROVENANCE (F2: durable authorship marking) ---

/**
 * Which accept path introduced a span of AI text. Conceptually escalating: a
 * `parallel` regenerate (an analogical rewrite of the writer's own bullet) is
 * lighter-touch than a `revision` Glass-Box proposal. Extend, don't collapse.
 */
export type ProvenanceSource = 'revision' | 'parallel';

/**
 * A durable record that a span of prose entered the document from the AI. Lives in
 * the provenance LAYER (`.twriter/provenance.json`), never inside `project.md` — so
 * the manuscript stays clean and the single-source-of-truth + `applyProposal`
 * substring contract are untouched. Relocated on load by literal `indexOf` of
 * `anchor` (like `SavedOutlineBullet`/`GistSegment`); a rewrite of the span's opening
 * drops the mark, and the text becomes the writer's own. Surfaced in-app as a
 * desaturated tint; never exported with the manuscript.
 */
export interface ProvenanceMark {
  id: string;
  /** Verbatim prefix (~64 chars) of the inserted text — the relocation anchor. */
  anchor: string;
  /** Length of the inserted span at accept-time (the decoration extent). */
  length: number;
  /** Which accept path introduced it. */
  source: ProvenanceSource;
  /** Accept-time epoch ms. */
  at: number;
}

/** The persisted provenance layer for one document (`.twriter/provenance.json`). */
export interface ProvenanceDoc {
  marks: ProvenanceMark[];
}

// --- ARGUMENT AUDIT (WS4b: whole-document agent findings) ---

/**
 * What a whole-document audit finding flags. Distinct from the per-section
 * `CommitmentFinding`/`MeshFinding` (token-level, single-section): these are the
 * audit agent's semantic, multi-hop, cross-section reads — the work the
 * deterministic mesh check structurally cannot do.
 */
export type AuditFindingKind =
  | 'unargued-commitment' // a claim relied on across the work but never actually argued
  | 'unsupported-assumption' // a section assumes context its prerequisites never establish
  | 'drifted-claim' // a definition/claim used inconsistently across sections or revisions
  | 'orphaned-commitment'; // a commitment a section makes that nothing downstream uses

/**
 * One finding from the read-only whole-document argument audit (WS4b), anchored to
 * the section that carries the problem. Read-only — fixes route through Glass-Box.
 * Ephemeral + regenerable; never persisted.
 */
export interface AuditFinding {
  id: string;
  /** Section the finding is anchored to (resolved from the model's `sectionTitle`). */
  sectionId: string;
  sectionTitle: string;
  kind: AuditFindingKind;
  /** Concrete description of the gap, grounded in the prose. */
  detail: string;
  /** The other section the relation points to, when one applies. */
  relatedSectionTitle?: string;
  direction?: 'upstream' | 'downstream' | 'self';
  severity: 'medium' | 'high';
  /** Optional note when the finding involves drift across git revisions. */
  drift?: string;
}

// --- GESTALT WHOLE/PART OPERATIONS (Phase 2) ---

/**
 * The "Beethoven test" (Gestalt Theory, 1938: "from a part of the whole we could
 * grasp the inner structure of the whole"). The document's main claim as
 * reconstructed from ONE section's prose alone, and how that reconstruction lines
 * up with the document's actual claim. A large divergence means the part has
 * drifted from the whole. See docs/gestalt-design-II.md L3(a).
 */
export interface WholeFromPartResult {
  /** The document thesis as best reconstructed from this section alone. */
  reconstructedClaim: string;
  /** How the reconstruction matches the actual document claim (or 'no-baseline'). */
  alignment: 'aligned' | 'partial' | 'adrift' | 'no-baseline';
  /** Where/how the part diverges from the whole (when not aligned). */
  divergence?: string;
  /** Optional short reading. */
  note?: string;
}

/** Stored Beethoven-test result: the AI output plus staleness metadata. */
export type WholeFromPart = WholeFromPartResult & { timestamp: number; inputHash: string };

/**
 * One alternative structural centering of a section (Umzentrierung) — a different
 * point the section's parts could organize around. See docs/gestalt-design-II.md L4.
 */
export interface RecenteringOption {
  /** The proposed new center of gravity. */
  center: string;
  /** Why this centering may serve the whole better. */
  rationale: string;
  /** What changes in the section's parts under this centering. */
  whatChanges: string;
}

/**
 * The recentering / "question-the-goal" move — the unstick operation for the
 * narrowed-field stall ("to stick to set goals is often sheer thoughtlessness").
 */
export interface RecenteringsResult {
  options: RecenteringOption[];
  /** The deepest beat: is this section's goal itself right for the whole? */
  questionTheGoal: string;
}

/** Stored recentering result: the AI output plus staleness metadata. */
export type Recenterings = RecenteringsResult & { timestamp: number; inputHash: string };

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
 * Reading stance for an evaluative AI pass. 'draft' (the default) treats the text
 * as a work in progress — stubs/placeholders are intended scaffolding, not flaws,
 * and feedback leans toward continuity and next moves. 'final' judges the text as
 * completed work, where gaps count against it. Shared by Version Compare,
 * Analysis, and Diagnostic; each tool tracks its own mode independently.
 */
export type ReadingMode = 'draft' | 'final';

/**
 * Draft-mode only: a still-open thread of work in a draft — a stub, placeholder,
 * TODO, bracketed note, or a commitment set up but not yet paid off — surfaced
 * NEUTRALLY as a working-memory checklist. Never a loss or a defect; the writer's
 * own scaffolding reflected back so nothing slips across a revision pass.
 */
export interface OpenThread {
  /** The intended-but-unfinished item, in one line. */
  summary: string;
  /** Where it sits (heading title or locus), if locatable. */
  location?: string;
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
  /**
   * Draft-mode only: the writer's still-open work (stubs, TODOs, unpaid
   * commitments), reflected back as a neutral checklist. Empty/absent in 'final'.
   */
  openThreads?: OpenThread[];
  /** The reading stance used for this comparison (audit trail). */
  mode?: ReadingMode;
  /** The comparison lens applied, if any (audit trail). */
  lensName?: string;
}

// --- SPEC-ANCHORED A/B WHOLE-TEST ("CI for prose") ---
// Tests whether revision B serves the WHOLE better than A — NOT a sum of
// per-section piece-tests. A test suite that only sums per-section verdicts
// commits the error Wertheimer names: a section can satisfy its own rubric while
// inverting in the whole (tF — "true as a piece, false as a part", On Truth /
// Democracy), or read rougher in detail yet truer to the whole (fT — "a caricature
// is false in every detail yet truer than a photograph"). So the report leads with
// a WHOLE verdict grounded in the commitment-mesh and center of gravity, and the
// per-section deltas hang beneath it. Ephemeral/regenerable, never persisted (cf.
// VersionComparison). Produced on demand by AIProvider.runSpecTestSection (per
// changed part) + runSpecTestWhole (the whole), assembled by lib/specTestRun.ts.
// See docs/gestalt-design.md §III/§VI and docs/gestalt-design-II.md L1–L4.

/**
 * The structural-truth verdict on a change — the heart of the feature, the
 * dimension a sum of piece-verdicts cannot see (Wertheimer, On Truth / Democracy).
 */
export type StructuralTruth =
  | 'whole-true'   // part-true AND serves the whole — a real improvement
  | 'tF'           // piece-improvement: locally better, the whole worse / a join severed
  | 'fT'           // rougher in detail yet truer to the whole (a brave simplification)
  | 'whole-false'  // worse as a part of the whole
  | 'lateral';     // changed without a clear whole-direction

/**
 * One required move scored on BOTH versions against the held rubric. Carries the
 * L1 advance axis (productive vs recapitulative): a move that becomes
 * present-but-recapitulative is NOT a gain (the petitio paragraph) — it reads as
 * `deflated`, a cut opportunity. "New relative to what?" is judged against the
 * section's mandatory structural surround. `delta` is derived deterministically
 * from the status pair + advance by the normalizer, not taken from the model.
 */
export interface MoveDelta {
  moveId: string;
  moveDescription: string;
  statusA: MoveStatus;
  statusB: MoveStatus;
  advanceA?: MoveAdvance;
  advanceB?: MoveAdvance;
  /** 'deflated' = present on both sides but B went recapitulative (true yet inert). */
  delta: 'gained' | 'regressed' | 'held' | 'added' | 'removed' | 'deflated';
  diagnosis?: string;
  receipts: ComparisonReceipt[];
}

/**
 * The A/B result for ONE part, judged AS A PART (the surround is mandatory). When
 * `scopeReason` is not 'evaluate'/'mesh-neighbour' there is no AI call: `moveDeltas`
 * is empty and `direction`/`truth` are derived structurally.
 */
export interface SectionSpecTest {
  /** Alignment key — the heading title, NOT a slug id (see the stable-ID caveat). */
  sectionTitle: string;
  presentInA: boolean;
  presentInB: boolean;
  /** Why this part was (or was not) deep-read — the diff-scoping audit. */
  scopeReason: 'changed' | 'mesh-neighbour' | 'unchanged' | 'a-only' | 'b-only' | 'no-rubric';
  /** Part-improvement vs piece-improvement (tF) for this section. */
  truth: StructuralTruth;
  direction: ComparisonDirection;
  /** The Beethoven test, folded in: can the document's claim be read out of each
   *  side's prose? A part from which the whole cannot be recovered has drifted. */
  wholeSignature: { a: WholeSignatureAlignment; b: WholeSignatureAlignment };
  summary: string;
  moveDeltas: MoveDelta[];
  /** Prose-level commitment breaks the revision introduced / healed for this part
   *  (the AI's reading of the surround — distinct from the deterministic MeshDelta). */
  commitmentDelta?: { introduced: CommitmentFinding[]; healed: CommitmentFinding[] };
}

/** The Beethoven-signature ladder (the `WholeFromPartResult` ladder, minus
 *  'no-baseline' — a held rubric always supplies the baseline). */
export type WholeSignatureAlignment = 'aligned' | 'partial' | 'adrift';

/**
 * The commitment-mesh delta across the A→B revision — the structural joins healed
 * or severed, INCLUDING joins with parts that did not change (a change in one part
 * can sever its nexus with an unchanged part — the failure an ADHD writer is least
 * equipped to catch unaided). The `introduced` set is the tF signal. Computed by
 * the deterministic `checkCommitmentMesh` spine, so it never false-alarms.
 */
export interface MeshDelta {
  introduced: CommitmentFinding[];      // breaks absent in A, present in B
  healed: CommitmentFinding[];          // breaks present in A, gone in B
  persisting: CommitmentFinding[];      // breaks present in both
}

/**
 * The WHOLE verdict — grounded in the mesh delta + center of gravity + the part
 * drifts, NOT in a tally of section verdicts (the whole is not the sum of its
 * parts). The report leads with this; the `tally` on SpecTestReport is for
 * transparency only and is never the verdict.
 */
export interface WholeVerdict {
  truth: StructuralTruth;
  direction: ComparisonDirection;
  /** Did B displace the document's center of gravity? (Umzentrierung.) */
  centerOfGravity: string;
  /** One paragraph: the whole-grounded read of B relative to A. */
  verdict: string;
  /** The deterministic structural-join delta (the trustworthy spine). */
  meshDelta: MeshDelta;
  /** When the whole regressed (esp. tF), the recentering the structure now demands
   *  — the vector, not a chore (L4 demand-rhetoric). */
  recenteringVector?: string;
}

/**
 * The whole-document spec-test report: the whole verdict first, the parts beneath.
 * Ephemeral/regenerable, never persisted. The `tally` is transparency only — it is
 * NEVER the verdict (a sum of green parts is not a whole-truth).
 */
export interface SpecTestReport {
  whole: WholeVerdict;
  sections: SectionSpecTest[];
  tally: {
    gained: number;
    regressed: number;
    deflated: number;
    tF: number;
    fT: number;
    /** Parts deep-read (one AI call) vs skeleton-only (no call) — honest cost. */
    deepRead: number;
    skeletonOnly: number;
  };
  mode: ReadingMode;
  labelA: string;
  labelB: string;
  /** 'changed', 'all', or a chapter title — the scope the suite ran at. */
  scopeLabel: string;
  /** Whether the held rubric came from the live testSuite or snapshot A's. */
  rubricSource: 'live' | 'snapshot-a';
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

/**
 * Revision (sharpen existing prose) vs Assembly (stitch sources into new prose)
 * vs Citations (audit how the draft uses its cited sources — quote fidelity,
 * faithful representation, APA citations, and references).
 */
export type RevisionMode = 'revision' | 'assembly' | 'citations';

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
 * A reusable revision "Instruction" — the grounding stance for a SOURCELESS pass.
 * When no SourceDocuments are present, the revision engine grounds proposals in
 * the master document itself, steered by the active instruction's `body` (default
 * library entry: "Base your analysis on intrinsic requirements of the text.").
 * A small global library, shared across projects (modeled on AnalysisSpell); the
 * built-in defaults live in code (`lib/defaultInstructions.ts`), user additions
 * persist in app preferences. Distinct from `directive` (per-pass, what to
 * accomplish): the instruction is the standing stance; the directive is the goal.
 */
export interface RevisionInstruction {
  id: string;
  /** Human label shown in the picker. */
  label: string;
  /** The instruction text steering a sourceless revision pass. */
  body: string;
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

// --- PARALLEL EDITOR (REVERSE-OUTLINE REVISION) ---
// A revision workspace built on the proportion `draftA : outlineA :: outlineB :
// draftB`: each paragraph is distilled to one faithful sentence (outlineA), the
// writer edits a copy of that distillation (outlineB), and only the changed
// paragraphs are regenerated as minimal, voice-preserving rewrites (draftB) that
// ride the Glass-Box accept pipeline. A new artifact layer — a *distillation of
// the prose* — distinct from the spec/diagnostic/analysis band; extend, never
// collapse. Only outlineA persists (see `ReverseOutlineDoc`); outlineB/draftB are
// ephemeral session state, exactly as Glass-Box sources/proposals are.

/** What a segmented block is, so a heading/list/code block is treated differently
 *  from a prose paragraph (a heading is its own distillation, never rewritten). */
export type ParagraphKind = 'prose' | 'heading' | 'list' | 'code';

/** One reverse-outline bullet as returned by the model, before persistence. The
 *  `index` ties it back to the input paragraph block (1:1, in document order). */
export interface ReverseOutlineBullet {
  index: number;
  sentence: string;
  kind: ParagraphKind;
}

/**
 * A minimal paragraph rewrite. Field names are deliberately those `applyProposal`
 * consumes (`Pick<RevisionProposal, 'original_text' | 'proposed_text'>`) so a
 * regenerated paragraph feeds the existing splice with zero adaptation. For an
 * inserted paragraph `original_text` is empty; for a deletion `proposed_text` is.
 */
export interface ParagraphRewrite {
  original_text: string;
  proposed_text: string;
}

/**
 * A persisted reverse-outline bullet (outlineA). The link to its source paragraph
 * is a verbatim `anchor` (the first ~64 chars), NOT an offset — offsets rot on any
 * edit. On load we relocate by anchor (literal-match-or-orphan, mirroring the
 * Glass-Box "no-op if the span is gone" contract).
 */
export interface SavedOutlineBullet {
  /** Stable id, assigned once at generation; survives re-segmentation. */
  id: string;
  /** The faithful distillation, possibly hand-corrected. */
  sentence: string;
  kind: ParagraphKind;
  /** Verbatim anchor of the source paragraph (first ~64 chars). */
  anchor: string;
}

/**
 * The persisted reverse outline for one scope — a section id, or `'root'` for the
 * whole document. Saved with the project (`.twriter/reverse-outline.json`); the
 * `sourceHash` lets the UI warn when the prose changed since the outline was made.
 */
export interface ReverseOutlineDoc {
  scopeKey: string;
  bullets: SavedOutlineBullet[];
  sourceHash: string;
  generatedAt: number;
}

// --- GIST EDITOR (a whole-at-once re-entry surface) ---
//
// The Gist is the document at LOW RESOLUTION, not metadata about it: written in the
// document's own voice, carrying the author's verbatim terms, compressing by
// deletion/selection — never by abstraction. Three grains (g0 / coarse / fine) hold
// the same argument at three levels of articulation; the UI renders the finest that
// fits the panel. See docs/migration-log.md and the design plan for the rationale.

/** Which grain of the gist is shown — a Prägnanz ladder, coarsest (g0) to finest. */
export type GistGrain = 'fine' | 'coarse' | 'g0';

/** The load-bearing move a segment makes (Prompt A). 'survey' covers literature ballast. */
export type GistMove =
  | 'define' | 'distinguish' | 'assert' | 'argue' | 'object' | 'reply'
  | 'concede' | 'exemplify' | 'reframe' | 'survey' | 'setup' | 'conclude';

/** The epistemic force of a claim — recorded separately so the gist never launders it. */
export type GistForce = 'asserted' | 'hedged' | 'entertained' | 'denied';

/**
 * Per-segment analysis (Prompt A / Stage A). Machine-read by composition (Stage B)
 * and persisted as inspectable intermediate state (it powers span tooltips and lets
 * per-span regeneration reuse a still-fresh analysis). `id` is the source Section id.
 */
export interface GistSegmentAnalysis {
  id: string;
  /** The 1–3 propositions the segment advances, in the document's own voice. */
  core_claims: string[];
  move: GistMove;
  /** 2–5 verbatim terms of art / coinages — the highest-value recognition cues. */
  anchor_terms: string[];
  force: GistForce;
  /** A 2–6 word in-voice connective to open this segment's gist (empty for the first). */
  transition: string;
  /** Argumentative importance to the whole document, 1–5. */
  weight: number;
}

/** The document's voice fingerprint (Prompt A), so composition can match its cadence. */
export interface GistStyle {
  person: string;
  register: string;
  cadence: string;
  signature_moves: string;
}

/** Full Stage-A output: per-segment analyses + the document thesis + a style fingerprint. */
export interface GistAnalysis {
  segments: GistSegmentAnalysis[];
  thesis: string;
  style: GistStyle;
}

/**
 * One gist span: the low-resolution text for a segment, tied to its source by `id`.
 * Concatenated in order with single spaces, a grain's spans read as continuous prose.
 */
export interface GistSpan {
  /** Source Section id, or 'thesis' for the single-span g0 grain. */
  id: string;
  text: string;
}

/**
 * A segment's persisted anchor. The Section `id` is the primary link; `anchor` (a
 * verbatim ~64-char prefix) relocates it when the id rots (rename/reorder), exactly
 * like the reverse-outline contract — literal-match-or-orphan, never fuzzy.
 * `headingPath` feeds aria-labels; `sourceHash` (over normalized text) drives staleness.
 */
export interface GistSegment {
  id: string;
  headingPath: string[];
  anchor: string;
  sourceHash: string;
}

/** Measured word budgets for one generation (design §6.1). Each grain's value is its
 *  hard cap; `target` is where the fine grain aims (a little under `total`). */
export interface GistBudgets {
  total: number;
  target: number;
  g0: number;
  coarse: number;
  fine: number;
}

/**
 * The persisted gist for a document — a scale model at three grains (design §7.3).
 * One per project (the app is single-document). Saved as `.twriter/gist.json`. The
 * per-segment `sourceHash` in `segmentation` lets the UI mark spans stale without
 * rewriting them (a stable map that diverges honestly beats a map that shifts
 * underfoot). `analysis` is retained as inspectable intermediate state.
 */
export interface StoredGist {
  generatedAt: number;
  model: string;
  segmentation: GistSegment[];
  analysis: GistAnalysis;
  budgets: GistBudgets;
  /** The thesis in the document's own voice — the terminal fallback grain, always fits. */
  g0: string;
  /** One span per top-level section. */
  coarse: GistSpan[];
  /** One span per segment (subsection-level). */
  fine: GistSpan[];
  staleSegmentIds: string[];
  orphanedSegmentIds: string[];
}

/** The composition stage's output (Prompt B) before it's folded into a StoredGist. */
export interface GistComposition {
  g0: string;
  coarse: GistSpan[];
  fine: GistSpan[];
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
  /** Ephemeral: the Beethoven test (reconstruct the whole from this part). Not persisted. */
  wholeFromPart?: WholeFromPart;
  /** Ephemeral: recentering / question-the-goal proposals. Not persisted. */
  recenterings?: Recenterings;
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

/**
 * One full-text search hit from `Repository.searchSections` (FTS5 over the
 * per-project cache, desktop only). `rank` is the bm25 score — lower is more
 * relevant; results arrive already ordered by it.
 */
export interface SearchHit {
  sectionId: string;
  title: string;
  snippet: string;
  rank: number;
}

/**
 * One section handed DOWN to `Repository.indexSections` for the search index.
 * Mirrors the Rust `SectionInput`. The frontend already parses markdown into
 * sections (`src/lib/utils.ts`), so we reuse that rather than re-parsing in Rust.
 */
export interface SectionInput {
  id: string;
  parentId: string | null;
  title: string;
  level: number;
  ordinal: number;
  content: string;
  wordCount: number;
}

/**
 * One file the local agent's `repo_read`/`list_files` tools can see, returned by
 * `Repository.agentListFiles`. `path` is relative to the project root (forward
 * slashes); `size` is bytes. Desktop-only (mirrors `SearchHit`).
 */
export interface AgentFileEntry {
  path: string;
  size: number;
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
 
/**
 * The user-editable prompts, keyed by their persisted field names. Derived from
 * the prompt registry (the single source of truth for the inventory) so adding a
 * prompt is a one-place edit there. Each editable registry entry contributes one
 * `string` field whose key is the entry's `key`. Locked engine-internal prompts
 * are deliberately excluded — they are never persisted or user-overridable.
 *
 * See `src/services/prompts/registry.ts` for the inventory and metadata.
 */
export type PromptsConfig = Record<EditablePromptKey, string>;

/**
 * The Climate Artist instruments — atmospheric analysis of a draft. Each maps to
 * an editable prompt in the registry; the reading itself is essayistic markdown
 * (no structured shape), so this union is the only domain type the suite adds.
 */
export type AtmosphericInstrument =
  | 'weatherReport'
  | 'radarScan'
  | 'stormSpotter'
  | 'forecast';

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

/**
 * Goblin-style "spiciness": how finely the coach decomposes a goal into steps.
 * Coarser ⇒ fewer, larger steps (the default — a PhD writer deepens on demand);
 * finer ⇒ more, smaller steps.
 */
export type SprintGranularity = 'coarse' | 'medium' | 'fine';

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

/**
 * The session goal captured by the coach start protocol, before decomposition.
 * `plain` is goal-only; `woop` adds the inner obstacle + a pre-committed if-then
 * plan (Oettingen/Gollwitzer — naming the inner obstacle and the response is the
 * best-validated goal-setting move). Ephemeral run-state, carried on the plan so
 * the runner's reinstate panel can show it at the point of performance.
 */
export interface SprintGoalFraming {
  model: 'woop' | 'plain';
  /** The one thing that has to be true by the end of the sprint. */
  wish: string;
  /** WOOP: the main *inner* obstacle that will get in the way. */
  obstacle?: string;
  /** WOOP: "if [obstacle], then I will [response]" — the pre-committed plan. */
  ifThen?: string;
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
  /** The coach-captured goal that produced this plan (when the coach was used). */
  goal?: SprintGoalFraming;
}

export interface ArgumentShape {
  id: string;
  name: string;
  description: string;
  /** Move templates with *relative* weights; scaled to the chosen total at runtime. */
  moves: Array<Omit<SprintMove, 'id' | 'durationSec'> & { weight: number }>;
}

// --- SESSION CEREMONY TYPES ---
// A *session* is a writing sitting, recorded as evidence (never a score). It is
// bracketed on disk by a pair of git tags (`session/<id>/start|end`) and saved
// as `.twriter/sessions/<id>.yaml`. Two paths create one: the lightweight
// standalone Start/End boundary, and a completed Living Sprint. The WOOP goal
// reuses the same Wish/Outcome/Obstacle/Plan vocabulary as `SprintGoalFraming`.
// Mirror of the Rust structs in src-tauri/src/types.rs — keep the two in step.

export interface SessionGoal {
  /** "What do you want to accomplish this session?" — required; the minimal session. */
  wish: string;
  /** "If this goes well, what will you have at the end?" — mental-contrasting anchor. */
  outcome: string | null;
  /** The main *inner* obstacle (WOOP). */
  obstacle: string | null;
  /** The "if [obstacle], then I will …" implementation intention. */
  plan: string | null;
}

export interface SessionStep {
  id: string;
  description: string;
  estimatedMinutes: number | null;
  completed: boolean;
  /** Optional "if X, then Y" for this step. */
  implementationIntention: string | null;
}

/**
 * The concrete next-action captured for an incomplete step at check-out. Per
 * Masicampo-Baumeister, writing the plan down is the intervention — it
 * discharges the cognitive intrusion of the unfinished task.
 */
export interface CarryForward {
  stepId: string;
  nextAction: string;
}

export interface SessionRecord {
  /** Hyphenated ISO start timestamp; doubles as the session-tag linking key. */
  id: string;
  startTag: string;
  /** null until check-out completes. */
  endTag: string | null;
  goal: SessionGoal;
  steps: SessionStep[];
  carryForward: CarryForward[];
  reflection: string | null;
  /** Total words added/removed across the session. */
  wordDelta: number;
  /** Per treemap-section word delta, keyed by section id. */
  wordDeltaByNode: Record<string, number>;
  nodesModified: string[];
  /** 1-10 from check-in, if captured. */
  commitmentLevel: number | null;
  durationMinutes: number;
  /** How the session was created. */
  source: 'manual' | 'sprint';
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

export interface DiskSignature {
  /** project.md last-modified time, epoch milliseconds. */
  mtimeMs: number;
  /** project.md size in bytes. */
  size: number;
}

/** Conditional read result: current signature (null if the file is absent) and
 *  the content, present only when it changed from the caller's last signature. */
export interface MarkdownDelta {
  signature: DiskSignature | null;
  content: string | null;
}