# Arpeggio integration — a fidelity audit and an adoption roadmap

> **What this is.** Two things, deliberately in one file because the second is derived
> from the first. (1) An adversarially-verified **audit** answering: is this tool
> *muddled* in its implementation of Wertheimer — has it failed to do justice to the
> texts as faithfully and rigorously understood? (2) A phased **roadmap** for importing
> everything worth importing from the *Arpeggio* spec
> ([`arpeggio-spec.md`](arpeggio-spec.md)) — a from-scratch design for a
> Wertheimer-grounded writing instrument — resolving every conflict between that spec
> and this codebase in favor of the better option. **When this doc and the code
> disagree, trust the code.** Line numbers are deliberately omitted (they drift);
> citations are by file + identifier.
>
> **Provenance.** Judged against: Wertheimer, *On Truth* (1934), read directly;
> [`configuration-and-sequence.md`](configuration-and-sequence.md) (the theoretical
> essay behind Arpeggio — the two wholes, the partial order of process-requirements,
> the two adjacency costs, the 1923 grouping factors read as a writer's inventory);
> the Arpeggio spec itself; and this repo's own corpus —
> [`gestalt-and-text-structure.md`](gestalt-and-text-structure.md) (the repo's
> *independent* essay on the same question),
> [`structural-part-audit.md`](structural-part-audit.md), the four
> `gestalt-design-*` essays, the domain types, engines, and prompts. The audit was
> produced by a multi-agent research pass (five code/doc sweeps → fidelity
> adjudication + feature cartography → adversarial verification that spot-checked
> ~40 citations); challenged claims were corrected before anything below was written.
>
> **Standing.** The audit (§I–§II) is settled judgment. The roadmap (§III) is the
> committed backlog — tracked in [`STATUS.md`](../STATUS.md), executed phase by
> phase, each phase shippable alone. Four scope decisions were fixed by the user on
> 2026-07-02 and are recorded in §III.0; they are constraints, not open questions.

---

## I. The verdict — is the tool muddled?

**Yes — but in a specific and unusual way: muddled less in its *reading* of
Wertheimer than in its *ontology and its silences*.** The readings are accurate, the
quotations honest, and the repo's own self-audits reach conclusions the external
essay would co-sign. The failures are structural: what the entities *are* keyed to,
which order-norm is enforced, and an entire register of the theory (the reader-side
mechanics) that was never read.

### I.1 What is faithful — credits a naive audit would miss

- **The refusal to tally.** The spec-test whole verdict is *architecturally
  forbidden* from being a sum of section scores: `summarizeTally`
  (`src/lib/specTestHelpers.ts`) is commented "NEVER the verdict (a sum of green
  parts is not a whole-truth)," the whole call reads role-skeletons + the
  deterministic mesh delta rather than the per-section results, and the AI-failure
  fallback (`rollupDirection`) is mesh-based, not tally-based. This is *On Truth*'s
  "I have failed to understand... if I know everything as a sum" made structural — a
  negative design decision most "CI for prose" architectures would never make.
- **Gestalt self-limitation, operationalized.** Spec-test's diff-scoping
  (changed sections + mesh-neighbours, each with an audited `scopeReason`) is the
  only tool-design idiom in the corpus that *implements* "a Gestalt, a pattern,
  limits itself" — bounded wholes making truth-reassessment tractable, with the
  presumption recorded rather than hidden.
- **Centering by direction, not degree.** The radix engine
  (`src/features/modals/topo/topo-centering.ts`) computes the center from arc
  *direction* ("the source of the arrows"), explicitly rejecting the
  centrality-by-degree convention of every off-the-shelf graph library — and
  `StructuralReadout.tsx` *demotes* the layout-neatness metrics (route length,
  crossings) as "premature closure ('seductive simplification')": the Prägnanz
  caution turned against the tool's own UI.
- Also creditable: the verbatim **anchor-or-orphan discipline** (never fuzzy, never
  fabricate); the **killed heatmap** (a doctrinally-demanded feature sacrificed to a
  CVD-accessibility verdict — *On Truth*'s coda enacted); **fT-protection for brave
  deletion** in draft mode (refusing to punish subtraction, where most revision
  tooling structurally rewards addition); and the **deterministic-first trust
  boundary** ("AI findings may only CORROBORATE/escalate — never originate a high
  band," `src/lib/strain-metrics.ts`).

### I.2 The muddles (confirmed under adversarial challenge)

1. **The heading-welded ontology** *(high)*. Every persisted argument-structural
   fact — specs, moves, commitments, dependencies, diagnostics, topology stations —
   keys to heading-delimited `Section`s, so the argument's parts are *defined by the
   composition's caesuras* and then read part-in-whole with great care. This is
   [`structural-part-audit.md`](structural-part-audit.md)'s own confessed verdict
   ("the tool takes Wertheimer's second move — read a part in its whole — while
   violating his first — let the whole determine what the parts are"), and it stands.
   The shipped repair, `StructuralPart` (Tiers 1–3), genuinely delivers
   heading-independent, span-anchored, many-to-many parts — but it is **a node-set
   without an edge-set**: parts bear no relations *to each other*, the part→section
   membership arc is hardcoded `'reference'` with no function
   (`topo-parts.ts`), and every engine (centering, mesh, dependency estimation,
   spec-test alignment) still runs over sections. W₁ acquired members; it has not
   yet acquired a configuration — and configuration *is* edges.
2. **The wrong order-norm** *(high)*. The tool's one shipped order-norm is "reading
   order ought to track prerequisite order": `backwardArcs` and `miscentering`
   (`topo-centering.ts`) measure divergence from *logical* dependence and
   `StructuralReadout.tsx` renders any nonzero value in warning colors,
   unconditionally. But the precedence that binds composition is not entailment.
   Validity is order-blind ("a logic for the dear Lord"); what fixes presentation
   order is the *dynamics of a reader's grasping* — the gap must be felt before it
   is filled, the set established before its material, the debt owed before it is
   paid — and these dynamics sometimes *deliberately invert* logical dependence
   (instance-before-rule; the conclusion asserted first as a promissory gap). The
   repo's essay concedes this for webs, configurations, and stars ("the metric
   misfires by construction") but the concession never reached the metric or the UI.
   Compounding it: order is *diagnosable but inert* — `SegmentEdit` has no `move`
   kind, there is no admissibility notion, no commutable-run detection, no reorder
   gesture anywhere. Order is truth-apt as verdict, dead as operation; and the
   verdict measures the wrong order.
3. **The mesh sees W₁ only through W₂'s window** *(medium)*. `checkCommitmentMesh`
   (`src/lib/diagnostic-helpers.ts`) pairs `incomingContext` against commitments
   from *tree-adjacent* sections only (parent + immediate siblings). A commitment
   paid three sections downstream is invisible to the deterministic spine. The
   high-precision/err-toward-silence posture is defensible engineering, but the
   scope silently presumes functional relatedness tracks textual proximity — the
   exact assumption the proximity grouping-factor forbids a writer to make.
4. **No license for the honest heap** *(low)*. `root-task.md` asserts
   unconditionally that a document is "a single line of development that closes a
   gap." *On Truth*'s own exemption — piecemeal logic "is adequate in those
   instances in which the inner functional content approaches zero" — appears
   nowhere, so genuinely and-summative substance (an inventory appendix, coordinate
   case studies) is *pressured by the prompts toward plausibility-forgery*:
   manufacturing commitments and throughlines the substance does not have. Dressing
   a heap as an organism is the document-scale lie in the second direction.

### I.3 Charges softened under verification

- **The treemap's word-count area** is a *partial-but-honest* gap, not a
  high-severity muddle: the docs explicitly label the treemap a W₂ surface, the
  `ballast` strain signal already instruments the exact word-count-vs-structural-load
  divergence, and the re-encoding is deferred behind documented gates (the
  killed-heatmap accessibility verdict; stable ids). One sentence overclaims — "the
  treemap is the tool's *diagnostic diagram*"
  ([`gestalt-and-text-structure.md`](gestalt-and-text-structure.md) §V) — and is
  corrected by Phase 0 below. A treemap that looks balanced can still be centred
  entirely wrong; the doc already admits this.
- **Umzentrierung.** Content-level emphasis-drift detection *does* exist — four
  prompts instruct it, including the words-held-fixed case (`compare-versions.md`:
  "the organizing emphasis moving, even when the words stay similar"). The true gap
  is narrower than "emphasis absent": no *presentational or deterministic* emphasis
  model (position-of-claim-within-section, foregrounding, the buried center).

### I.4 The absent frontier *(high — the blind spot the repo never essayed)*

The repo's essay read three Wertheimer texts; it never read the 1923 grouping paper,
and everything that paper supplies is absent from the repo's *thinking*, not merely
its backlog (exhaustive search: zero occurrences of any of these concepts in code or
docs):

- **grouping factors as the writer's inventory** — proximity, similarity (parallel
  construction, which groups *across distance* — the chief repair for what
  linearization breaks), good continuation, closure, Prägnanz-ranges (the
  93°-snaps-to-90° problem);
- **Einstellung — the linear order itself as a grouping force**: what the reader has
  already read pre-organizes what they read next. The repo treats order only as
  potential *misalignment*; it has no account of order as a compositional *force*;
- **the two adjacency costs** — *broken adjacency* (a functional edge spanning
  textual distance, survivable if retention is fed) and the graver *false adjacency*
  (textual neighbors with no functional edge — the reader *cannot refrain* from
  grouping them);
- **owed closure / IOUs** — nothing tracks a question raised in the reader's mind,
  a promise asserted-but-unearned, or the distance to its redemption;
- **recurrence with changed function** — quoted twice in the corpus ("B as
  leading-tone is a different thing from B as tonic") and never operationalized;
- **the homotypy audit** — after a restructuring, blocks that survive *verbatim*
  have usually changed function, and wording calibrated to the old function now
  quietly lies. The shipped staleness machinery is precisely *inverted* relative to
  this test: `recomputeStructuralStale` flags parts whose own text changed and is
  silent about parts whose text held while their surround moved;
- **enacted beats declared** — the app's W₁ layer is *declared* structure (specs,
  commitment strings), verified against other declarations; whether the prose's own
  grouping forces *enact* the declared organization is delegated wholesale to
  prompts. No sequential, W₁-blind reader simulation exists;
- **linear extensions as the space of composition** — necessary precedences vs.
  arbitrary residue (obey the first; optimize *or honestly declare* the second),
  commutability as the empirical probe, alignability as the size of the
  admissible-extension set.

---

## II. The conflict map

The Arpeggio spec and this codebase are **complements, not rivals**: TW2's
spec/diagnostic core judges prose *retrospectively* (given this prose in this place,
is it functioning as a part?); Arpeggio's realization-contract core scopes prose
*prospectively* (given this configuration, what must this not-yet-written block do
for a reader in this state?). Arpeggio's own stack section describes this codebase
almost verbatim (Tauri 2, React + TS + Vite, zustand, pure tested engines,
CodeMirror), and its persistence philosophy (local-first, plain-text, git-friendly)
is what this repo already does — better.

**Unconflicting — adopt through existing templates:** capture inbox · the Ledger
(IOU / declared-heap / declared-deviation / deferred-diagnostic) · the precedence
engine as a pure lib · diagnostics D1–D10 engine-side · reader simulation ·
recentering-as-operation · declare/defer as recorded acts · gesture drafting · the
available-material check · list-view parity · the keyboard map (incremental) · the
non-linearizable strategy prompt (SCC detection already exists in
`topo-centering.ts`, currently inert).

**Shallow conflicts — adapt into what exists:** the seven typed edges (a new edge
set beside the advisory section-level `Dependency`) · realizations + functionTags
(promote the bare part→section membership) · writer-set maturity (coexists with
derived readiness — declaration as input, readiness as verdict) · freewrite (into
the Sprint runner, output landing as part-quarry *material*, never committed prose)
· scaffold-vs-committed (extend `ProvenanceMark` with a scaffold/adopted lifecycle +
export-strip) · the next-moves queue + energy setting (mechanize the existing
gap→vector `NextCard`; energy picker into the session check-in) · the draft-mode
contract strips (strong bones already shipped: the Spec panel's Receives/Supplies
zone, the "Next expects →" caption, Focus Mode).

**Deep conflicts — resolved:**

- **W₂-primacy vs W₁-primacy.** Rivals only at the shell level. Arpeggio itself
  demands "distinct, **co-edited** layers," not W₂-as-projection. Resolution: the
  treemap stays the primary W₂ affordance; a new Canvas workspace becomes the
  authored W₁ home. Parts keep the span-anchoring discipline (battle-tested here;
  the spec never confronts prose edits under its mappings) but may now exist
  *pre-prose* (germ status, empty `sectionIds`).
- **Title-slug ids vs stable blocks.** Conceded internally already (STATUS.md,
  "Stable section IDs"). The ULID migration is the load-bearing prerequisite for
  roughly half the spec (realizations, reorder, homotypy, maturity). Single
  `project.md` is architectural law; Arpeggio's one-file-per-block is **rejected**.
- **The word-count ban.** Resolved by user decision: theory currency becomes the
  *primary* progress language; words are demoted to quiet secondary evidence and
  spatial extent. No new word-count surface, ever.
- **Audit-mode quarantine vs ambient status.** **Quarantine rejected** — ambient
  state-at-a-glance is the ADHD principle made pixels and is this product's
  identity. Adopted residue: declare/defer with records everywhere, and no *new*
  violations surfaced mid-keystroke in Focus Mode (the available-material soft flag
  is the sanctioned exception, as in Arpeggio itself).
- **The no-ghostwriting ban.** **Rejected** — it names flows this user built and
  uses. This repo's answer is provenance + reversibility + the scaffold/adopted
  lifecycle, not abstinence. "The writer holds the pen" is enforced as accept-gates,
  snapshots, and tints.
- **Spec core vs contract core.** Complements: the realization-contract becomes the
  *generative* front end; the spec/diagnostic engine remains the *audit* back end.
  Receives/Supplies derive from realizations + order where they can; the authored
  strings win as overrides.

**What this repo does better — never displace:** the git durability stack (commits,
tags, machine-parseable trailers, 3-way merge, `readSnapshot` — strictly superior to
Arpeggio's timestamped snapshot copies); the anchor + staleness discipline; the
deterministic-first trust boundary; multi-provider AI behind one seam + the tiered
prompt registry; the Gestalt prompt corpus itself (the Beethoven test, tF/fT
verdicts, the typus-gist — deeper than Arpeggio's §2 asks); the session/sprint
ceremony; FTS, provenance marks, Glass-Box receipts.

**Rejected imports, with reasons:** `blocks/*.md` + a `snapshots/` directory (git
layer superior; single-file law) · audit quarantine (identity) · the no-ghostwriting
ban (identity) · an Anthropic-only LLM module (multi-provider law) · the word ban on
glance *geometry* (magnitude-for-orientation is blessed by VISION; only *progress*
surfaces migrate) · the paper/engraving light-theme brief (HLD is canonical; adopt
only the color-is-semantic-or-absent discipline, which this repo already practices,
plus one new reserved center-glow token) · no-sync (the self-owned git remote
satisfies Arpeggio's motive — no accounts, no servers) · replacing computed
centering with authored `isCenter` (the radix engine is this corpus's most faithful
Wertheimer compilation; an authored center becomes a *declaration compared against
it*, never a replacement).

---

## III. The roadmap

### III.0 Fixed decisions (user, 2026-07-02)

1. **Aesthetic:** HLD stays canonical; adopt Arpeggio's semantic-color discipline on
   existing `hld-*` tokens; engraving metaphors may shape new surfaces' *forms*.
2. **Word counts:** theory currency primary; words demoted to secondary evidence;
   treemap-area re-encoding stays deferred behind its existing gates.
3. **W₁ canvas:** a **new dedicated canvas workspace** (hand-placed persisted
   positions; suggest-layout as preview only) — not grown from the Topology modal,
   which stays the derived-analysis lens.
4. **Scope:** the full phased roadmap below, one shippable phase at a time.

Defaults adopted (revisit any time): derived `ReadinessLevel` keeps the treemap
fill — writer-set maturity renders on the spine/spec surfaces instead; the contract
is the generative front end, the spec the audit back end, authored strings winning
as overrides; the 90-second stall cue stays but gains an opt-out.

### Cross-phase law

Everything below obeys [`AGENTS.md`](../AGENTS.md) without exception: single
`project.md` source of truth; components never touch disk or SDKs; prompts as `.md`
+ one registry entry; state partitioned by lifecycle; HLD tokens; every new sidecar
lands TS-schema-first with the Rust mirror as opaque `serde_json::Value` (the
sparse-payload lesson) plus round-trip + sparse tests; every phase ends with
`npm test` / `npm run typecheck` / `npm run build` green and the migration-log +
STATUS ritual. Any phase that writes into `project.md` (1, 6, and the recentering
operation) is preceded by a `commitSnapshot` + a tag, with revert verified before
shipping.

### Phase 0 — Doctrine repairs *(zero data risk; highest fidelity-per-effort)* — ✓ shipped 2026-07-02

Repairs I.2.4, the fT exposure in I.1's spec-test, and the doc overclaim of I.3 —
all in prompt/doc/render text, plus two additive optional type fields (`wholeReceipts`
on `SectionSpecTest`, `receipts` on `WholeVerdict`); no schema migration. See
[`migration-log.md`](migration-log.md), 2026-07-02.

1. **Whole-verdict receipts** — `spec-test.md` / `spec-test-whole.md`: require
   verbatim receipts on `truth` and `wholeSignature` (mirroring the existing
   per-move receipts discipline), and add *On Truth*'s own caution as instruction:
   whole-claims are the easiest to fake, so an fT verdict must cite what in the
   whole the local falsity serves. Tolerant-normalizer touch in
   `src/lib/specTestHelpers.ts` (accept-but-not-require; never fabricate).
2. **The heap license** — `root-task.md` + `dependencies.md` / `diagnostic.md` /
   `l1-task.md`: where inner functional content approaches zero, piecemeal
   composition is the *correct* form; never manufacture commitments for declared
   aggregate substance.
3. **Order-verdict softening (interim)** — `StructuralReadout.tsx`: BACKWARD /
   MISCENTER rendered neutral with a "may be deliberate (genetic/pedagogical
   order)" gloss, until Phase 5 can classify coverage properly.
4. **Doc honesty** — correct the diagram-overclaim sentence in
   [`gestalt-and-text-structure.md`](gestalt-and-text-structure.md) §V to match its
   own §VII admission.

### Phase 1 — Stable section IDs *(the load-bearing foundation)* — ✓ shipped 2026-07-02

**Shipped as a sidecar anchor-ledger, NOT the inline markers first planned.** Research
(two exploration sweeps over every id consumer and the markdown/editor lifecycle) found
that inline `project.md` markers would invade the writing surface — leaking into AI
prompts, word counts, treemap area, and the clipboard, and needing new editor
atomic-range machinery. Chosen instead: a persisted **`.twriter/section-ids.json`**
ledger binding each stable id to its heading by verbatim body anchor (the content-anchor
idiom StructuralPart / gist / provenance already use), so `project.md` stays pristine. The
pure engine is `src/lib/section-ids.ts` (`reconcileSectionIds`: anchor → title+level →
seed-freeze/mint); it runs in the App.tsx parse effect. **Migration = freeze** each
section's current id, so zero remap of existing spec files, dependency refs, or
gist/reverse-outline keys. Reserved `'root'` untouched. See
[`migration-log.md`](migration-log.md), 2026-07-02.

### Phase 2 — The W₁ graph layer: typed edges, authored parts, realizations *(repairs muddle I.2.1)* — ✓ shipped 2026-07-03

**Shipped the full graph layer** (data model + persistence + deterministic realization
seeding + AI edge-discovery assist + minimal topo-Inspector authoring + the
declared-vs-computed-centre finding), so the muddle is repaired *this phase*, before the
Phase-4 canvas. New pure engine `src/lib/structural-graph-helpers.ts`; two bare-array
sidecars `.twriter/structural-edges.json` + `.twriter/realizations.json`; the topo PARTS
projection renders the edge-set (function-tagged membership arcs + line-treated part→part
edges + legend) and the `DECL≠COMP` neutral cell; the `discoverStructuralEdges` faculty
lands proposals advisory-until-accepted; the four canvas/draft fields (`body`, `keyTerms`,
`canonicalNeighbor`, `position`) ship dormant so Phases 4/7/8 don't re-touch the type. See
[`migration-log.md`](migration-log.md), 2026-07-03. Original plan below.

- `src/types/index.ts` (extend, never collapse): `StructuralPart` gains `body` (the
  quarry: notes, dictation dumps — never committed prose), `keyTerms[]`,
  `status: germ | apprehended | articulated`, `declaredCenter?`,
  `canonicalNeighbor?`, `origin: authored | discovered`, `position?` (for the
  canvas); authored parts may carry empty anchors + `sectionIds: []` (content debt).
  New **`StructuralEdge`** — the seven kinds adopted verbatim: `grounds`,
  `requires`, `qualifies`, `opposes`, `exemplifies`, `defines`, `answers`. New
  **`Realization`** `{ partId, sectionId, functionTag, note? }` with
  `functionTag: open-gap | introduce | develop | recur | answer | pay | summarize`
  — the deterministic overlap computation seeds untagged realizations; the writer
  tags them.
- Persist via the structural-parts bulk-sidecar template (`repository.ts` →
  `layout.rs` → `types.rs` opaque Value → `document.rs` + round-trip test →
  `document-state` → `project-state` → actions hook).
- **Declared vs computed center:** `declaredCenter` never replaces the radix
  engine; divergence between declaration and computation becomes a neutral finding.
- The part→section arc carries its realization's functionTag (fixing the hardcoded
  `'reference'` in `topo-parts.ts`); part-to-part edges join the PARTS projection.
- Optional assist: a `discover-structural-edges` prompt + `AIProvider` method —
  proposed edges advisory until accepted.

### Phase 3 — The Ledger, declare/defer, capture inbox *(highest value per effort; repairs muddle I.2.3)* — ✓ shipped 2026-07-03

**Shipped in full.** The commitment mesh is widened beyond textual adjacency (the muddle-I.2.3
repair: a commitment paid anywhere later, established anywhere earlier, covered by a paid IOU,
or under a declared heap no longer flags — `MeshContext`/`buildMeshContext`, monotone and
back-compatible so the optional `ctx` never creates a new finding); the **Ledger** (IOUs /
declared-heap / declared-deviation / deferred-diagnostic) persists per-entry on the sessions
template and turns the strain register's dismissals into recorded concessions; **declared-heap
is a LedgerEntry** the section-keyed mesh + diagnostic surround consume directly; a right-side
**Ledger drawer** (pay/waive) + **capture inbox** (⌘/Ctrl+I → a section or a germ part) + a
check-out ledger-currency line land the rest. OS-level global hotkey deferred (a new Rust
plugin). See [`migration-log.md`](migration-log.md), 2026-07-03. Original plan below.

- **`LedgerEntry`** `{ kind: iou | declared-heap | declared-deviation |
  deferred-diagnostic, openedAtSectionId, owes, paidAtSectionId?, status: open |
  paid | waived, createdBy, reason? }`, persisted per-entry-file on the sessions
  template (merge-friendly across machines).
- **Wire the mesh:** `dangling-outgoing` / `unmet-incoming` findings become
  one-click candidate IOUs; `checkCommitmentMesh` widens beyond adjacency — a
  commitment covered by a `paid` entry, or token-matched in any *later* section
  (same ≥4-char stopworded matcher, still err-toward-silence), is silent.
- **Declare/defer everywhere:** strain-register dismissals (today session-scoped
  and unrecorded) gain a recorded declare path; `declared-heap` on a parent
  suppresses interlock pressure on its children (mesh + the Phase-0 prompt clauses
  consume it). The tool concedes gracefully and *remembers the concession*.
- **Ledger drawer** (`src/features/ledger/`): literal ledger rows; strike-through
  on payment — juice at the moment of consequence only. Dock glyph + ⌘K.
- **Capture inbox** (`src/features/inbox/` + `.twriter/inbox/` per-item files):
  global hotkey, <30 s, zero navigation; items append to sections or promote to
  germ parts.
- Session check-out leads with ledger currency ("N debts paid · M declared").

### Phase 4 — The W₁ Canvas workspace *(user decision 3)* — ✓ shipped 2026-07-03

**Shipped in full.** A new full-screen, pan/zoom **W₁ Canvas** (`src/features/canvas/`, `⬡`
dock glyph + ⌘K) — the authored spatial home of W₁, where the parts live as hand-placed cards
and the typed edges as lines, all authored directly. Rendering is an **HTML card overlay over
an SVG edge layer** in one world-coordinate container (a fresh world-px `useCanvasPanZoom`, not
the SVG-viewBox topo camera); the one new `--color-hld-feat-glow` pigment marks a declared
centre; positions + the quarry `body` persist through the **existing** parts sidecar (no new
sidecar, no Rust change — the Phase-2 dormant fields finally have a consumer). Keyboard authoring
(N/E+kind-letter/C/1-2-3/Delete, guarded by `isEditableTarget`); a per-node inspector with the
quarry `body`; an always-available legend; **suggest-layout** as a ghost preview → undoable
accept (spatial memory is sacred — seeding only fills never-placed nodes); **inbox drag-to-canvas**;
full **list-view / SR parity**; and the topo `PartInspector`'s **"open in canvas"** deep-link
(which focuses the camera on the part). The Topology modal remains the derived-analysis lens.
See [`migration-log.md`](migration-log.md), 2026-07-03. Original plan below.

The Topology modal remains the derived-analysis lens — its PARTS
projection stays the parts↔sections reconciliation view, gains an "open in canvas"
deep link; the canvas *shows* computed-radix divergence as a quiet indicator and
never re-implements rank.

- Custom SVG over parts + edges (reuse `usePanZoom` and the `topo-marks` idioms; no
  new dependency). Node cards: handle/claim + a status ring (germ ⅓ · apprehended ⅔
  · articulated full). `declaredCenter` carries the one new reserved center-glow
  token — the only new pigment in the app.
- Edge kinds distinguished by line treatment, with an always-available legend.
  `N` creates a node at the cursor (< 5 s, no dialog); `E` + kind letter starts an
  edge; `C` toggles center — all mindful of live CodeMirror focus contexts.
- **Positions persisted** (`StructuralPart.position`) — the writer's placement *is*
  external memory. *Suggest layout* renders a ghost preview; acceptance is
  **undoable** (this repo's law: undoable, not confirmable).
- Opening a node reveals its quarry `body` editor — where dictation dumps and
  freewrites land.
- List-view parity toggle (sr-accessible outline, per the treemap's sr-mirror
  pattern). Inbox items drag onto the canvas to become germ parts.

### Phase 5 — The precedence engine and the order space *(repairs muddle I.2.2, diagnosis half)* — ✓ shipped 2026-07-04

**Shipped in full.** A new pure `src/lib/precedence.ts` derives grasping-dynamics
`PrecedenceConstraint`s from the Phase-2 W₁ edges (`defines`→definition-before-use;
`answers`→gap-before-filling with `before = toPartId`, the load-bearing inversion; `grounds`
strategy-relative via a per-part `expositionStrategy`; requires/qualifies/exemplifies/opposes
generate none), computes a grasp order (parts by min realization `docIndex`, introduce-preferring),
and runs `checkAdmissibility` / `commutableRuns` / `nonLinearizableRegions` over the constraint
graph. `classifyBackwardArcs` completes the Phase-0 softening: a backward arc is COVERED (a
reference; an endorsing or inverting-reason constraint; or an **open** IOU at the dependent → a
neutral purple bridge glyph) vs UNCOVERED (a genuine read-ahead → the magenta chevron), and
`orderMiscentering` reports uncovered/arcCount. `computeCentering` is untouched (the SCC helpers are
lifted to `src/lib/graph-scc.ts`); with no W₁ structure drawn, `orderGraded` is false and every arc
stays neutral (err-toward-silence — no regression for users without edges). The SPINE gains an
`OrderMarks` layer (admissibility ticks, commutable "declare-heap" brackets, non-linearizable chips
opening a spiral | declared-IOU | pointer strategy menu); regions + authored constraints + overrides
persist in a `.twriter/precedence.json` sidecar; and `dependencies.md` learns the logical-survival
vs grasping-dynamics distinction. Reorder-as-operation is deferred to Phase 6. See
[`migration-log.md`](migration-log.md), 2026-07-04. Original plan below.

- New pure `src/lib/precedence.ts` (no React, no store): **`PrecedenceConstraint`**
  with `reason: gap-before-filling | set-before-material |
  overthrow-before-recentering | debt-before-payment | ground-before-lean |
  definition-before-use | custom`, `source: derived | authored`, suspendable,
  convertible to IOU. Derivation rules from Phase-2 edges: `defines` →
  definition-before-use; `answers` → gap-before-filling (the objection is the gap);
  `grounds` → strategy-dependent; `requires` cycles → a **non-linearizable region**
  (reusing the existing SCC machinery, today inert); `opposes` → a
  deliberate-tension exemption. Per-region
  `expositionStrategy: systematic | genetic | spiral | reference` persisted in the
  Phase-2 sidecar — the strategy concept that makes precedence *relative to the
  chosen exposition*, which is exactly what the shipped metric lacked.
- `checkAdmissibility(order, constraints, realizations)` (< 50 ms) and
  `commutableRuns()` — necessary precedences vs. arbitrary residue, distinguished.
- **Complete the order-verdict repair:** a backward arc is now classified *covered*
  (an inverting-reason constraint or a live IOU — bridge glyph, neutral) or
  *uncovered* (warning); miscentering reports against grasping-order admissibility,
  not raw prerequisite direction.
- The SPINE projection renders admissibility ticks (reason on hover), gray
  commutable brackets ("order arbitrary here" — declaring the heap files a ledger
  entry), and violet non-linearizable chips opening the strategy prompt: **spiral**
  (scaffold paired introduce/develop realizations), **declared IOU** (move a cycle
  edge into the ledger), **pointer beyond the medium** (record the deliberate
  escape).
- `dependencies.md` learns to distinguish logical-survival prerequisites from
  grasping-dynamics precedence.

### Phase 6 — Reorder as operation + the homotypy inversion *(muddle I.2.2, operation half)* — ✓ shipped 2026-07-04

**Shipped in full.** A **move** relocates a heading and its whole subtree within `project.md` — the
first feature to structurally rewrite the single source of truth. The applier is a standalone pure
`applyMove(source, spec: MoveSpec)` in `src/lib/segment-helpers.ts` (*not* a sixth `SegmentEdit`
kind — the five existing kinds are single in-place splices; a move is a cut+reinsert with hygiene at
≤3 seams, cleaner alone). It works in **line space** (`[startLine, endLine+1)`), so
`split('\n')/join('\n')` is an exact inverse and bytes outside the touched seams are stable (CRLF
rides inside line strings); it re-parses `source` internally, resolves M and T through the
heading→`sectionAnchor`→nearest-ordinal three-tier discipline, guards self/into-own-subtree/no-op/orphan
(each → `=== source`), and rejoins disjoint line slices through one `joinBlocks` seam primitive (no
`\n\n\n`, no eaten content). A **Pass 0** in `reconcileSectionIds` force-binds the moved subtree's ids
(defeating the germ-sibling nearest-ordinal swap that would orphan specs). A `moveSection` store slice
(`src/state/reorder-state.ts`, shared by sidebar / palette / SPINE) takes a pre-move git snapshot,
writes acceptLevel-exact, re-seeds realizations, and returns an in-memory **Undo**. The gestures:
**Alt+↑/↓** in `SectionRow` + two ⌘K palette entries (the app's **first `aria-live` region** announces
the move) and a **SPINE station drag** with live admissibility (`livePos` override → provisional
`docIndexOf` → `checkAdmissibility` → live red ticks; dropping into a violation is *allowed* and files a
finding). **Standing homotypy** repairs I.4's inversion: a zero-Rust `surroundHash` (the inverse of
`sourceHash`, stamped at discovery + re-anchor) and `recomputeHomotypy` flag parts whose text HELD while
their surround MOVED — surfaced as an amber PARTS tint + a `PartInspector` **RE-READ** fix. No Rust
touch. See [`migration-log.md`](migration-log.md), 2026-07-04. Original plan below.

- Add `move` to `SegmentEdit` + its applier in `segment-helpers.ts` (a move is a
  cut/reinsert of the heading block's range in `project.md` — the source of truth
  moves; everything else re-derives). Pre-move git snapshot.
- Drag-reorder on the SPINE (optionally the sidebar): live admissibility during
  drag; dropping into a violating position is *allowed* — nothing blocks — and files
  a finding with fix / declare / defer.
- Post-move hooks: recompute realizations; re-run the mesh; and mark **homotypy
  candidates** — parts whose `sourceHash` *held* while their surround or order
  changed: the inverse of the shipped staleness check, and the repair of I.4's
  inversion. "After restructuring, one cannot correctly even write the same
  letters."

### Phase 7 — Draft-mode contract: the Einstellung surfaces

Strong bones exist (the Receives/Supplies zone, "Next expects →", Focus Mode); this
phase makes the writer see *the reader's situation* while drafting.

- **Reader-holds strip** (left margin, Focus Mode): computed from realizations +
  document order — the handles of parts already given to the reader,
  recency-ordered, plus open IOUs. Authored `incomingContext` strings win as
  overrides.
- **This section's contract + NOT-YET-AVAILABLE** (right margin): its realizations
  and functionTags, the constraints it discharges, the IOUs it pays, and the parts
  the reader does not yet hold.
- **Available-material check:** a CodeMirror decoration (the provenance-plumbing
  pattern) softly underlines keyTerms of not-yet-available parts — realize earlier /
  declare an IOU / dismiss. Never a modal, never blocking.
- **Gesture drafting:** writer-set `maturity: empty | gesture | drafted | hardened`
  as a spec-sidecar field; `G` inserts a telegraphic placeholder; `Cmd-Enter`
  advances. Gestures are progress and are counted as such. Readiness keeps the
  treemap; maturity fills the spine slats and spec panel.
- **Freewrite lockout** in the Sprint editor: optional no-delete burst whose output
  lands as part-quarry *material* unless deliberately kept.
- **Scaffold lifecycle:** `ProvenanceMark` gains `state: scaffold | adopted`;
  adoption is a logged act; export learns strip-scaffold (default: marked,
  strippable).

### Phase 8 — Adjacency diagnostics, recentering as operation, reader simulation

Each independently shippable; every finding routes through the Strain Register +
ledger under the deterministic-first law.

1. **D1 false adjacency** (the graver cost: adjacent sections whose realized parts
   share no functional edge, uncovered by an `opposes` exemption or a declared
   heap) and **D2 uncovered broken adjacency** (a `grounds`/`requires` edge whose
   realizations sit far apart with no covering device — a `recur` realization, a
   backlink, a live IOU), in a new pure `src/lib/adjacency-diagnostics.ts`.
2. **D3 premature resolution** (deterministic, from Phase-5 constraints) · **D5
   heap dressing / undeclared heap** · **D9 hub monotony** (`recur` realizations
   whose functionTags never advance — recurrence without changed function is
   monotony) · **D10 orphans** (largely exists).
3. **Recentering as operation** — the app already *proposes* recenterings; this
   makes them executable: snapshot + `restructure/<id>/before` tag → constraint
   diff (born/died) → admissibility scan → homotypy scan → mesh re-audit → ledger
   updates, presented as **"the jolt, itemized"** — a finite checklist; revert
   restores the snapshot. The catastrophe becomes a bounded list.
4. **Reader simulation** — a new `AIProvider` method (blindness fencing copied from
   `reconstruct-whole.md`): sequential, W₁-blind, per-section structured JSON
   (perceived center, current grouping, live expectations, surprises, terms assumed
   undefined), deterministically diffed against realizations + ledger. Enacted
   organization tested against declared. Findings capped at medium band;
   multi-provider.
5. Then, by mood: **D4 bridge quality** (+ bridge candidates landing as scaffold) ·
   **D8 unmarked deviation** via `canonicalNeighbor` · a deterministic
   buried-center/emphasis-position heuristic (I.3's true residue) · the
   **next-moves queue + energy setting** (foggy / generative / precise) in the
   session check-in.

### Phase 9 — Currency migration + the still-gated items

- Dashboard headline and dock caption migrate to theory currency; words demoted to
  secondary evidence; `Word-delta` trailers stay archival.
- Unchanged gates, revisit deliberately: treemap area = structural load (the
  CVD-accessibility verdict stands; ids are stable after Phase 1); the stall-cue
  opt-out; a Focus-Mode "calm" toggle.

---

## IV. Keeping this honest

Each phase lands with its own migration-log entry and STATUS update; this document
records the *judgment and the plan*, not the shipped state — when it drifts from
the code, trust the code and amend here. The audit's standard was the primary text
read rigorously, and the roadmap's standard is the same: every phase names the
verdict it repairs or the theory it operationalizes, so that no lever ships without
its warrant.

---

*Sources frozen alongside: [`arpeggio-spec.md`](arpeggio-spec.md) (the donor spec),
[`configuration-and-sequence.md`](configuration-and-sequence.md) (its theory).
Companion repo corpus: [`gestalt-and-text-structure.md`](gestalt-and-text-structure.md)
(the two wholes, independently derived),
[`structural-part-audit.md`](structural-part-audit.md) (the confessed ontology
muddle), [`gestalt-design.md`](gestalt-design.md) through
[`gestalt-design-IV.md`](gestalt-design-IV.md) (the levers built so far). Why the
project is shaped this way: [`VISION.md`](VISION.md). The architecture as built:
[`../AGENTS.md`](../AGENTS.md).*
