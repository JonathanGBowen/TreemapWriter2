# TreemapWriter2 — Status (the "now")

> **The living backlog.** What's shipped, what's next, what's deferred, and what
> we've deliberately decided not to build. This replaces the old phase trackers:
> the phased refactor (0–4) is finished, so work is no longer numbered by phase.
> For the dated history of how each thing shipped, see
> [`docs/migration-log.md`](docs/migration-log.md); the old phase plans are frozen
> in place — [`docs/refactor-plan.md`](docs/refactor-plan.md),
> [`docs/phase-5.md`](docs/phase-5.md), and
> [`docs/living-sprints-plan.md`](docs/living-sprints-plan.md).
>
> **Current as of 2026-06-28.** Update this file whenever a feature ships or is
> planned (see the definition-of-done ritual in [`AGENTS.md`](AGENTS.md)). A
> point-in-time audit of the desktop user flow (with a flow diagram and the
> issues it fixed) lives in [`docs/ux-audit.md`](docs/ux-audit.md) — now with a
> **second pass** (2026-06-22) covering the empty-document fix, the
> project-management flow, dock legibility + a ⌘K command palette, and AI-surface
> consolidation.

## Where things stand

The app is a working Tauri 2 desktop application. The full durability stack
shipped: prose lives in `project.md` on disk, with a rebuildable SQLite cache,
git history, and one-button sync to a private GitHub remote (HTTPS + PAT in the
OS keyring). Recent feature waves, all shipped: multi-provider AI (Gemini /
Anthropic / Ollama), the Analysis + Socratic Dialogue tabs, Grimoire/lens, the
Glass-Box revision workspace, Living Sprints (timed, move-based sessions), and the
Version Compare workspace (an exegetical A/B evaluation of two saved versions —
drift, gains, losses — over the git-snapshot history). In-app
3-way merge conflict resolution is done. A subtle sidebar sync indicator (cyan
when synced, magenta on error) surfaces status without distraction.

**Gestalt segmentation — "Articulation"** shipped 2026-06-29 (see
[`docs/migration-log.md`](docs/migration-log.md)). A top-down, recursive walk that
divides a long text into its natural parts (Wertheimer's division-by-articulation —
cut at the joints, no shards, *situated* by genre) and proposes valid markdown
headings, as a faithful sibling of the Generate-Specs sweep: pure surgery in
`lib/segment-helpers.ts` (reusing `paragraph-helpers`), the discovered-levels walk
in `services/ai/ai-provider.segment.ts`, the `segmentSpan` provider seam + call
kind, four editable `segmentation` prompts, and a new Articulation workspace
(`features/segment/*` + ephemeral `state/segment-state.ts`) with conservative /
exploratory / summaries modes, per-edit review, and a "Continue to specs" hand-off.
When a draft has no headings, the dock's `✦ Generate specs` auto-runs Articulation
first (`startSpecSweep`). The experimental summaries mode stores a one-sentence
reverse-outline gloss on a new, separate `TestSuiteEntry.reverseSummary` (never the
exegetical `mainClaim`), shown in the Spec tab and persisted via the YAML sidecar.
*Lingering debts (by design, deferred):* summaries attach to newly-inserted parts
(existing headings in an already-structured doc don't get a gloss); inserts/critique
inherit the app's title-based section-id caveat; the desktop `reverse_summary` sidecar
mirror was added by inspection but not `cargo check`'d here (no GTK libs in CI).

**Structural parts — Tier 1** shipped 2026-07-01 (see
[`docs/migration-log.md`](docs/migration-log.md); audit
[`docs/structural-part-audit.md`](docs/structural-part-audit.md) §V). A first-class
`StructuralPart` (the fifth domain layer) decoupled from the heading-`Section` grid:
anchored to arbitrary text spans and mapped **many-to-many** onto sections, so a
part that *spans* sections, *subdivides* one, or *belongs to two wholes* is finally
expressible. Discovered by a new AI faculty **added alongside Articulation** (which
stays the heading tool) — `discoverStructuralParts`, one whole-document pass modeled
on `analyzeGist` (tolerant block-index→anchor parse, `[]` on junk). The vertical
slice: the type + faculty + prompt + call kind, a pure
`lib/structural-part-helpers.ts` (`resolvePart` anchor→span→`sectionIds` by
own-content overlap; `computeDivergences` → `spansMultiple`/`subdivides`/`shared`),
an in-memory `document-state` field + `use-structural-parts-actions` hook, and a 4th
**PARTS** projection in the Argument Topology modal (a bipartite parts↔sections map
reusing the shared `Province`/`Route` marks, with a self-contained "Discover parts"
button). **In-memory only by design.** *Deferred (named):* **Tier 2** persistence
(the `provenanceMarks` template — `.twriter/structural-parts.json` sidecar + Rust
opaque-`Value` mirror + `sourceHash` staleness) and **Tier 3** consumption (letting
`estimateDependencies`/coach/spec-test operate over parts; treemap reconciliation,
still gated on the killed-heatmap accessibility verdict + stable section IDs).

The **Quiet center column** shipped 2026-06-28 (see
[`docs/migration-log.md`](docs/migration-log.md)) — the decided form of a Claude Design
"Tidy Center Column" exploration. The editor's two structure-as-prose chrome blocks were
removed so the manuscript *is* the column: the pinned structural-surround rail is gone, the
floating "you were here" nudge became a slim left-margin **resume marker** (new
`features/coach/ResumeMarker.tsx`, with per-section caret restore via a new ephemeral
`sectionCaret` slice; the F1 90 s stall escalation is preserved), and one quiet
`NEXT EXPECTS →` caption sits above the prose. The surround it carried now leads the right
Spec panel as a lit **"Context & commitments"** zone (`◇ WHOLE / → RECEIVES / ↘ SUPPLIES`) —
where the product already keeps structure. Deferred polish: pixel-tracking the marker to the
remembered line (`coordsAtPos`) and cross-reload caret persistence.

**Fixed 2026-06-24 — a silent desktop persistence outage** (see
[`docs/migration-log.md`](docs/migration-log.md)). From 2026-06-17, every
`project_write` (prose, specs, analyses, snapshots) had been failing silently on
desktop: the prompts-registry refactor began sending a *sparse* `promptsConfig`,
but the Rust mirror was a strict struct with required fields, so the whole command
rejected it before writing. `prompts_config` (and its `interpolation_config`
siblings) are now opaque `serde_json::Value` like `models_config` /
`reverse_outlines`, with a serde contract test that would have caught it. Guardrail
added: a failed save now raises a persistent banner + toast (`saveError` in
`ui-state`) instead of dying in the console. **Lesson for the backlog:** any other
TS→Rust payload that's persisted sparse must hit an opaque `Value`, never a strict
mirror — the TS registry/types own those shapes.

A profile-driven prosthetic wave shipped 2026-06-20 (see
[`docs/migration-log.md`](docs/migration-log.md)): a **non-initiated ambient cue**
(surfaces the next move on re-entry + on a mid-section stall, no button press),
a **pinned structural-surround rail** in the editor (the part-in-whole, shown in
both Focus and normal mode), and a **streaming coach**. All three live in
`src/features/coach/`.

The **coach-driven sprint start protocol** shipped 2026-06-21 (see
[`docs/migration-log.md`](docs/migration-log.md)): a sprint can open with a
writing coach that defines the session goal — three styles (guided wizard /
streaming chat / hybrid) and two goal models (WOOP or plain), both persisted with
last-selected-default — then a **Goblin-style plan editor** breaks the goal into
an editable, recursively-decomposable sequence of timed steps (granularity
control + per-step "break down") that flows straight into the runner. Phases:
`setup → coach → plan → running`. Two AI flows added (`coachSprintTurn`,
`decomposeSprintStep`); plan edits run through the pure `src/lib/sprintEdit.ts`.

An **experimental Claude Agent SDK transport** shipped 2026-06-21 (see
[`docs/migration-log.md`](docs/migration-log.md)): a fourth provider `'agent-sdk'`
at the `LLMClient` seam can route **dialogue + coaching** calls through the Claude
Agent SDK against a **Max subscription**, via a standalone local Node helper
(`agent-sidecar/` — the SDK is a Node library that can't run in the webview, so the
webview half is a thin localhost proxy and the SDK never enters the browser
bundle). It is **off by default** behind an "Agent mode" toggle (AI settings →
Experimental — Claude Agent SDK); the standard one-off API path stays the default,
and per-task model overrides can opt any other call in. Auth is Max-OAuth-only
(`claude setup-token`). While it runs, its live thinking/activity trace streams into
the in-progress UIs (replacing the static "analyzing" markers), and finished runs are
optionally auditable from a viewer in the Experimental settings (saved app-global by
default with a toggle to disable; never in project files).

A **provider-agnostic local agent** shipped 2026-06-28 (see
[`docs/migration-log.md`](docs/migration-log.md)) — parallel to, and independent of, the
Claude Agent SDK transport. It is a multi-turn, tool-using loop built on the existing
`LLMClient` seam (`src/services/ai/agent/`), so it runs on **any** provider — including a
**local Ollama model**, with no API billing and no Node helper — exposed as one
`AIProvider.runAgent` method + a `'runAgent'` call kind. Per the Gestalt principle its
default context is the **whole working text** (a selected section in its structural
surround, or the whole document), never a retrieved subset; retrieval tools are scoped to
reaching *beyond* the working text — project files, AI-generated artifacts, FTS5
manuscript search, and git history. Its bounded tools include read access to the repo, a
**scoped writer** confined to `.twriter/agent-output/` (Rust `commands/agent_fs.rs` +
`fs_io::resolve_within` path guard), and two structured routines that delegate to existing
`AIProvider` methods. Off by default behind an "Experimental — Local agent" toggle (AI
settings) with its own model picker and an inline console; the live thinking/activity
trace reuses the Agent SDK ticker/modal. **Deferred by design:** semantic embeddings /
vector RAG (v1 leans on whole-text context + the FTS5/artifact/history tools), a dedicated
full-screen agent workspace, and a Gemini-only structured-output hardening of the tool
protocol.

The **Generate-Specs workspace** shipped 2026-06-22 (see
[`docs/migration-log.md`](docs/migration-log.md)): the old one-shot "interpolate"
modal is now a full-screen workspace (like Compare / Glass Box / Climate) that walks
the spec hierarchy **one level at a time, human-in-the-loop** — root → chapters →
deeper levels. When the Agent SDK is the resolved provider for the new
`developSpecLevel` kind (global Agent mode, or a per-project override), each level is
co-developed with the agent in a streaming chat (prose + a fenced JSON proposal);
otherwise the writer first writes a free-text steer note, then generates single-shot.
Either way the proposal is **editable** before Accept, which lands it in the
`testSuite` and unlocks the next level (its prompt constrained by the accepted
parents). A "Run all remaining" button keeps the old non-interactive behavior. The
batching is now strictly per-level (the old `generateSpecs` batch is reimplemented over
the same pure building blocks and kept for any non-workspace caller). Deliberate v1
limits: forward-only walk (re-open to restart; the one `pre-ai-write` snapshot makes it
safe), and the multi-turn chat is agent-only (other providers get the steer path).

The **Session ceremony — invisible git + Progress Dashboard** shipped 2026-06-22
(see [`docs/migration-log.md`](docs/migration-log.md)): Feature Sets 2 & 3 of the
session-coaching brief. A writing *session* is now bracketed silently by a pair of
git tags (`session/<id>/start|end`) and a **semantic end-commit** whose trailers
(`GMT-step` · `Session` · `WOOP-obstacle` · `Steps-completed` · `Word-delta`) are
machine-parseable, and is saved as a `.twriter/sessions/<id>.yaml` sidecar.
Sessions are created two ways — a skeletal standalone **check-in/check-out**
(`SessionModal`, Dock session button) and **completed Living Sprints** (which
bracket a session automatically) — both through one lifecycle in
`state/session-state.ts`. A read-only **Progress Dashboard** (`features/dashboard/`,
Dock `▤`) surfaces accumulated totals, a words-over-time Plotly chart, per-section
attention, and the recent-sessions log — framed as evidence, no streaks/targets/
pass-fail color. Version Compare gained session tags as selectable refs. Two brief
assumptions were corrected at plan time: **no task system exists on nodes** (per-node
progress is section-based; `Task:` trailers + task sync omitted), and **idle
auto-commit was declined** (the explicit-snapshot model is kept; tags + semantic
commits + word-count layer on top). New git primitives (`create_tag`, `list_tags`,
`resolve_ref`, `word_count_delta`) live in `src-tauri/src/git/mod.rs`; the
`SessionRecord` family is mirrored TS↔Rust.

The **Parallel Editor** (reverse-outline-driven revision) shipped 2026-06-24 (see
[`docs/migration-log.md`](docs/migration-log.md)): a fifth full-screen workspace
(`▥ Parallel`, command palette) built on the proportion
`draftA : outlineA :: outlineB : draftB`. Four block-aligned, parallel-scrolling
columns — original prose · a faithful one-sentence-per-paragraph reverse outline ·
the writer's edited copy · the regenerated draft — turn revision into "edit a
distillation and regenerate," touching only the changed paragraphs as minimal,
voice-preserving rewrites that ride the **existing Glass-Box accept pipeline**
(per-paragraph proposal → `applyProposal` → `pre-ai-write` snapshot). A
section⇄whole-document toggle lives in the top bar. Two new AI flows
(`generateReverseOutline`, `regenerateParagraph`); one new persisted field
(`reverseOutlines` ↔ `.twriter/reverse-outline.json` — only outlineA persists,
linked to source by verbatim anchor with a stale-source warning). New pure helpers
(`lib/paragraph-helpers.ts` segmenter with an exact-substring invariant;
`lib/parallel-helpers.ts` normalizers) and the ephemeral `state/parallel-state.ts`
slice. Deliberate v1 limits below.

The **Gist Editor** (a whole-at-once re-entry surface) shipped 2026-06-24 (see
[`docs/migration-log.md`](docs/migration-log.md)): a sixth full-screen workspace
(`◊ Gist`, command palette) built on the thesis **compress, don't abstract** — the
gist is *the document at low resolution, not metadata about it*, in the author's own
voice, anchor terms verbatim. Two panes: the app's CodeMirror editor on the right,
and on the left a Gist panel that always fits the window (a three-grain ladder —
g0/coarse/fine — measured against an offscreen twin; it never scrolls). Bidirectional
anchoring rides the existing `selectedId` channel (span click → editor scroll + line
pulse; cursor → span lights). Four AI flows (`analyzeGist`/`composeGist` editable,
`refreshGistSpan`/`refitGist` locked) under verbatim brief prompts at temperature
0.25, with app-side validation gates (banned reporting-frame scan + one corrective
retry). Segmentation reuses the `Section` tree (the brief's TipTap block-IDs adapted
to it); staleness is normalized-text hashing with per-span `⟲` refresh. One new
persisted field (`gist` ↔ `.twriter/gist.json`), ephemeral `state/gist-state.ts`,
and pure `lib/gist-helpers.ts` + `lib/gist-normalize.ts` (19 tests). Deliberate v1
limits below.

The **Spec Test** (spec-anchored A/B whole-test) shipped 2026-06-26 (see
[`docs/migration-log.md`](docs/migration-log.md)): hold a section's `SectionSpec`
as a fixed rubric and score version B against A — move by move AND as a whole — to
answer the test-driven question *did this revision improve the prose against my
specs, or degrade it?* It is Gestalt-faithful: the report **leads with a WHOLE
verdict** (`tF`/`fT`/whole-true, center-of-gravity drift, a recentering vector)
grounded in the commitment-mesh delta, with per-section move deltas (carrying the
productive/recapitulative axis) beneath — a suite that summed piece-verdicts would
miss the `tF` failure (a part improving while the whole pays for it). Scope is diff
+ mesh-neighbour (a change pulls in the unchanged sections it might have severed a
join with); the held rubric defaults to the live testSuite (the TDD reading), with
a snapshot-A toggle. Two surfaces over one store-free engine (`lib/specTestRun.ts`):
a dedicated workspace (`▣ Spec test`, Dock / ⌘K) and a spec-anchored toggle folded
into Version Compare. Manual + ephemeral for now; the engine seam is ready for an
automatic snapshot/session-end trigger. Deliberate v1 limits below.

The Glass-Box revision workspace gained (2026-06-19, see
[`docs/migration-log.md`](docs/migration-log.md)): **sourceless revision** as the
default when no sources exist (proposals grounded in the document itself, steered
by a reusable **Instruction** library — global, shipping with an "intrinsic
requirements" default — with the verbatim-receipt contract relaxed for sourceless
passes only); drag-resizable workspace columns (via the shared
`features/shared/useColumnResize` primitive, which also now backs the main sidebar
+ tests panel); scroll-to-insertion when a proposal is previewed; and a
**Revision settings modal** (instruction · model · live token preview · prompts).
A third revision mode, **Citations** (2026-06-20), audits how the draft uses its
cited sources — quote fidelity (catching fabricated/misquoted quotations), faithful
representation (flagging strawmanning but never legitimate disagreement), APA
in-text citations, and References (proposing a `## References` section when absent).
It runs whole-document (a "Whole document" row was added to the revision rail), and
sources can now be **uploaded as markdown** as well as pasted. Deliberate limits:
References-creation is a rejectable proposal (never an auto-write); APA page numbers
are best-effort; Author/Year inference rides on the source labels/content. A
lightweight **Zotero bridge** (2026-06-21, see
[`docs/migration-log.md`](docs/migration-log.md)) feeds that last point real data:
"Import bibliography" in the source picker parses a Zotero **CSL-JSON** export
(`src/lib/bibImport.ts` — pure, no dependency) into one ephemeral source per
reference (`Author (Year)` chip, APA + abstract as content), so Citations builds an
accurate `## References` section and APA audit instead of guessing. Full source text
still rides the existing `.md` upload; bibliographies are session-only, and BibTeX /
the live Zotero local-API picker / Web-API sync are deliberately out of scope (below).

A **catalog/ladder reconcile** shipped 2026-06-28 (follow-up to the six-fix pass; see
[`docs/migration-log.md`](docs/migration-log.md)) so the built-in Gemini list actually
reaches users: the model catalog + fallback ladder are persisted prefs, and hydration
loaded stale values over the code defaults. Now `getModelCatalog` reconciles on read
(built-in gemini/anthropic/agent-sdk rows always come from `DEFAULT_CATALOG`; detected
Ollama + editor-added custom models preserved; retired former-built-ins dropped), the
ladder is cleaned of dead rungs on hydrate (with a "Reset to default ladder" button),
and built-in catalog rows are non-removable. Fixes every dropdown + the functional
dispatch at once since they all read the two reconciled store values. Deliberately left
alone (no silent mutation): a `globalModelDefault`/per-project pin to a retired id is
shown as "(unavailable)" for the user to re-pick.

An **AI / Gemini robustness & UX pass** shipped 2026-06-28 (six fixes; see
[`docs/migration-log.md`](docs/migration-log.md)): the catalog's ordered Gemini list
is now the **single source of truth** for the fallback ladder (derived in
`src/services/ai/model-defaults.ts`, so the two can't drift); a per-MINUTE rate limit
is no longer mistaken for a per-DAY quota (structured-error parsing in
`clients/gemini-error.ts` → `__quotaScope`/`__retryDelayMs`, a `'rate-limit'`
`ExhaustionReason`, retry-hint-aware backoff, and a **proactive token-bucket throttle**
from the catalog's new `requestsPerMinute`); a **global activity pill**
(`AiActivityIndicator`, an `activeOps` registry separate from `isProcessing`) makes any
in-flight call visible from any view and **jumps back** to its workspace, with throttle
waits shown as "queued"; stray AI error sites route through `notifyAiError`; the shared
`ModelPicker` gained a `providers?` filter (folding the Agent-SDK straggler); and a
`DisabledHint` wrapper explains spec-gated controls (the "Run Diagnostic blocked until a
spec exists" case and peers). Deliberate follow-ons: the throttle is best-effort spacing
(honored retry-hint capped at 8s, then falls to the next model's bucket); the pill labels
the latest op only (a `+N` count when several run); and conversational dialogue/coach
streams keep their own inline indicators rather than the pill.

## Next (felt priorities)

- **Agentic-AI integration roadmap — WS1–WS4a shipped 2026-06-29.** A 2026-06-29 audit
  ([`docs/ai-integration-audit.md`](docs/ai-integration-audit.md)) found the gap is
  *integration*, not plumbing: ~30 typed call-kinds and two agentic substrates exist,
  but both were off-by-default and woven into no feature workflow. It set a
  single-call-vs-agent decision rubric, a Human-AI-interaction UX audit, and four
  workstreams, **all shipped** (see [`docs/migration-log.md`](docs/migration-log.md)):
  **WS1** AI-config consolidation, **WS3** point-of-action moves (F5), **WS2** durable
  provenance layer (F2), **WS4a** a bounded+gated deep-revision agent (the local agent
  woven into the Glass-Box accept gate). Recommended agentic features are *bounded +
  always gated* (propose → human accepts → snapshot; never an autonomous `project.md`
  write). **Deferred additive follow-ons:** **WS4b** — a whole-document
  commitment/dependency-audit agent + a git-history argument-drift trace (read-only,
  into Argument Topology) — and the **F3 "Good-Enough" gate** as a rubric-declared
  bounded move-completion loop in a Living Sprint. Both reuse the same `runAgent` +
  accept-gate spine.

- ~~**Design-system remediation (HLD audit).**~~ **Complete (2026-06-26)** — all
  three audit tiers shipped (see [`docs/migration-log.md`](docs/migration-log.md)). A
  visual design audit found a real HLD design language that had stopped enforcing its
  own rules (six ambient layers at rest, ~11 accents, six status encoders, ~248
  hard-coded hexes, no visible focus ring); the verdict was *polish, not rebuild* and
  every fix was subtraction. Delivered: a **calm canvas at rest** (atmosphere opt-in,
  glow = alive), a **visible focus ring** on every interactive (a small `.hld-btn`
  layer + narrow global fallback), a **rationalised 18-colour token kit fully enforced**
  (hex guardrail at **0** warnings — the editor, both legacy modals, and ~45 component
  files migrated; functional literals exempted with rationale), **one status
  vocabulary** (`summarizeReadiness` + `Pip`), keyboard-operable rows + a treemap
  `sr-only` alternative, **one `Spinner` / one easing**, and **⌥-hold dock labels**. A
  `no-restricted-syntax` lint rule guards colour drift from returning. **Two deliberate
  deviations from the audit** (both documented): accessibility meets the **desktop 24px**
  AA floor (not the touch 44px) with glyph tools kept glyphic; and the off-grid
  **spacing snap** via a custom `--spacing-*` scale was **declined** (it shadows
  Tailwind v4's numeric spacing). Held back as the one genuine follow-on: `muted-text`
  token values were **kept** (the audit's inversion would have silently re-contrasted
  328 sites) — fixing only the failing pairs; a deliberate, audited muted-text
  migration could revisit that later. **Dock follow-up (2026-06-26):** dropped the
  redundant native tooltip from the glyph tools (the footer caption already names them)
  and re-surfaced the five palette-only launchers — Coach `◍`, Generate specs `✦`, Revise
  `⟐`, Parallel `▥`, Gist `◊` — as dock glyphs (14 tools in two grouped rows); ⌘K stays
  the searchable door + home of the rarer actions.

- **Session ceremony — Feature Set 1 (the full coaching ceremony).** The
  2026-06-22 wave shipped the git infrastructure (Set 2) and the Progress
  Dashboard (Set 3) with a deliberately *skeletal* check-in/check-out
  (`SessionModal`). The richer Feature 1 is deferred: the sequential WOOP prompts
  (Wish→Outcome→Obstacle→Plan presented one at a time), the GMT five-step framing,
  a granularity slider + "use tasks from node" pull in check-in, the GROW
  commitment-branch ("if commitment < 7, simplify"), and the idle-timeout-driven
  check-out. The data model (`SessionRecord` / `SessionGoal` / `SessionStep` /
  `CarryForward`) and lifecycle thunks already exist, so this is UI on top of a
  settled spine. Two smaller follow-ons flagged by the brief: surfacing *last
  session's carry-forward* at the next check-in (the records already store it),
  and a **spec-evaluation delta** between the session start/end snapshots. The
  evaluation *engine* now exists (the spec-anchored A/B whole-test,
  `runSpecTestForOperands`, shipped 2026-06-26, store/UI-free); what remains is the
  automatic trigger that calls it on check-out with the start tag as the baseline
  ref — the manual surfaces already ship.

- **Profile-driven wave — F3 remains (F2 · F5 shipped 2026-06-29).** The 2026-06-20
  wave shipped F1/F4/F6 (the **F4** surround rail and the **F1** floating cue were later
  *relocated* by the 2026-06-28 Quiet center-column redesign — rail → Spec-panel
  "Context & commitments" zone, nudge → margin resume marker, with F1's stall escalation
  preserved); the analysis flagged three more, ranked by clinical leverage:
  ~~**(F2) durable authorship/provenance marking for all AI-introduced text**~~ —
  **shipped** as the durable provenance layer (WS2 of the AI-integration audit; see
  [`docs/migration-log.md`](docs/migration-log.md)): a `.twriter/provenance.json`
  sidecar marks every accepted AI span with a desaturated tint, closing the
  unmarked-sourceless-text gap; **(F3) a "Good Enough" stop gate** against the
  perfection loop (port the explicit permission-to-stop from the user's own Glass
  Box tool; tie to the readiness ladder) — **still open**, and the audit folds it into
  the bounded move-completion agent loop (rubric-declared Good-Enough, never
  model-self-judged); ~~**(F5) point-of-action move instructions**~~ — **shipped** as
  the margin `ActiveMoveMarker` (WS3), which surfaces the active move's vector *when the
  move becomes active*, not as a skippable pre-gate. F3 is now the highest-leverage
  remaining item.

- **Gestalt roadmap — substantially shipped 2026-06-26 (second reading + Phases 1–3).**
  Tier 1 shipped 2026-06-17 (part-not-piece context: prefix-truncation killed in spec
  generation; a *structural surround* threaded into the diagnostic/analysis prompts). The
  ADHD-focused **second reading** ([`docs/gestalt-design-II.md`](docs/gestalt-design-II.md))
  then drove three implementation waves (see [`docs/migration-log.md`](docs/migration-log.md)):
  **Phase 1** — diagnostic deepening: `diagnostic.md` / `analysis.md` now *consume* the
  injected surround, plus an L1 present-but-empty move axis (`MoveResult.advance`), an L2
  `commitmentFindings` set, and an L4 gap→vector `nextAction`. **Phase 2** — two new AI
  flows surfaced in the tests panel: the Beethoven test (`reconstructWhole`) and the
  recentering / question-the-goal move (`proposeRecenterings`). **Phase 3** — the
  deterministic `checkCommitmentMesh` + the keyboard/SR-accessible **Structural-Tension
  Register** (register-only, after a 5-lens + adversarial design study killed the per-tile
  treemap heatmap on accessibility grounds). **Deferred** (documented in
  `gestalt-design-II.md`): the visual *Tension Lens* on the treemap and directional vector
  connectors (gated on stable section IDs / a Plotly between-tile primitive), and
  boundary-correctness + B-reaction guardrails (`gestalt-design.md` item 7). The register is
  the accessible spine those visual layers build onto. **Centering made visible — essay III
  (2026-06-26, see [`docs/migration-log.md`](docs/migration-log.md) +
  [`docs/gestalt-design-III.md`](docs/gestalt-design-III.md)):** the deferred
  directional-vector idea landed in the **Argument Topology modal**, not the treemap (which
  stays gated on the heatmap-accessibility verdict + stable IDs). A pure `computeCentering`
  (`src/features/modals/topo/topo-centering.ts`) reads the *source of the arrows* off the
  dependency graph — structural rank, centrality, radix/telos, cycles, backward arcs — and
  drives a **recenter-on-node** field re-read across all three projections, a rank-encoded
  **RADIX** projection, a structural readout that demotes the cosmetic route-length/crossings
  metric, and structural evidence fed into the recenter / Beethoven prompts. **§VI
  prompt-by-prompt pass (2026-06-26):** the remaining first-essay §VI prompt edits landed —
  the spec-generation cluster (`system-instruction`/`root-task`/`l1-task`/`sub-task`),
  `refine-spec`, `coach`, `generate-personas`, `suggest-content`, `refactor-analysis`,
  `dialogue`, plus light-touch `dependencies`/`compare-versions`/`generate-sprint-plan` —
  each an additive, prompt-text-only part-in-whole framing (no schema/caller change);
  `generate-revisions.md` (the Glass Box) is the one deliberate hold-out. **Still
  deferred:** the treemap *Tension Lens* + structural sizing (heatmap-accessibility + stable
  IDs); richer edge semantics (the structural "and / but / nevertheless" beyond
  prerequisite/reference — touches the domain types); and wiring the topology trouble-regions
  (broken/weak/fog/backward/cycle) into the Structural-Tension Register as S₁→S₂ vectors. The
  spec-derivation `contentPreview` slices (800 / 600) remain the only input char-slices (every
  other arbitrary cap was deleted for the `checkContextFit` token-budget pre-flight,
  2026-06-18). **Fourth reading — essay IV (Tier A + B shipped 2026-06-27; see
  [`docs/gestalt-design-IV.md`](docs/gestalt-design-IV.md) +
  [`docs/migration-log.md`](docs/migration-log.md)):** a direct reading of
  Wertheimer's *earliest* work (*Numbers and Number-Gestalts*, 1912) mines its theory
  of **concrete thinking** and the **non-uniform, situated magnitude-series** for five
  even-weight contributions to the tool's handling of *number, magnitude and division*
  — (C1) a magnitude-tF/fT *divergence signal* (word-count magnitude vs. structural
  load; the treemap **area** re-encoding stays gated as before); (C2) **approximate
  magnitude** rendering (zones of indifference + privileged relevance-levels) on
  orientation surfaces, exact counts kept only where the task needs them; (C3) a second,
  **quasi-local/proportional** centering ("three-quarters through") beside the
  topological radix, riding the existing `Station.docIndex`; (C4) **division without
  shards** — a seam-first fix to `decompose-step.md`'s count-first granularity; (C5) the
  gist reframed as a **typus** plus a named **concrete-thinking design law** (no
  reality-detached operation may be asked of the writer) with a §20 audit. **Shipped
  (Tier A + B):** the `src/lib/magnitude.ts` helper (`magnitudeBand` / `roundedCount`)
  now drives treemap tile labels (exact counts kept on hover + the SR mirror) and the
  sidebar word meta (C2); `topo-centering.ts` carries a `position`/`quasiLocal` metric
  surfaced in the topo Inspector (`POS %`) and the recenter / reconstruct-whole evidence,
  with backward arcs now reporting their proportional span (C3); `decompose-step.md` cuts
  at the step's seams instead of to a fixed count (C4); a size-gated `ballast` signal joins
  the Structural-Tension Register when chapter-scale bulk coincides with a recapitulative
  move (C1, divergence — treemap **area** still word count); and VISION principle 8
  ("Concrete operation — no senseless task") plus the gist's *typus* reframe (C5). **Still
  deferred (Tier C, unchanged gates):** treemap **area = structural load** (killed-heatmap
  accessibility verdict + stable section IDs) and the multiple-articulation gist
  (`StoredGist` schema extension).
- ~~**Streaming AI in a sidebar coach panel.**~~ Done 2026-06-20 (see
  [`docs/migration-log.md`](docs/migration-log.md)). `streamCoachAdvice` now
  exists on the `AIProvider` (an `async *` mirroring `continueDialogue`), and
  `CoachModal` streams token-by-token. `src/features/coach/` is now a real panel
  home, also hosting the ambient cue and the structural-surround rail (below).
- ~~**FTS5-backed full-text search.**~~ Done 2026-06-23 (see
  [`docs/migration-log.md`](docs/migration-log.md)). `index_sections` /
  `search_sections` commands ([`src-tauri/src/commands/search.rs`](src-tauri/src/commands/search.rs))
  over a content-storing `sections_fts`, plus a desktop sidebar search box that
  highlights treemap hits. Indexing runs off the document save path and is
  panic-safe; the cache self-rebuilds on schema-version drift
  ([`src-tauri/src/db/index.rs`](src-tauri/src/db/index.rs)). The downstream
  git-snapshot / `search()` fragments seam in Living Sprints'
  `buildReinstatement(..., { extraFragments })` remains deferred (it's additive
  and read-only), as do in-editor phrase highlighting and `SectionMapModal`
  highlighting.
- **Stable section IDs.** IDs are currently derived from `title.slug + index`
  ([`src/lib/utils.ts`](src/lib/utils.ts)) — fragile under duplicate titles,
  renames, and reordering. Move to opaque ULIDs assigned at section creation,
  stored as YAML frontmatter `id:` per section, with a one-time migration that
  walks existing sections. Open question: garbage-collect orphan IDs on delete,
  or keep them so dependency edges survive an undo (default: keep). Trigger to
  prioritize: any rename/reorder bug surfacing in real use.

## Lingering (smaller debts, pick by mood or by which bug surfaces)

- ~~**Re-enable App.tsx test-suite cleanup.**~~ Done 2026-06-18 (UX audit; see
  [`docs/migration-log.md`](docs/migration-log.md) and
  [`docs/ux-audit.md`](docs/ux-audit.md)). The disabled `useEffect` is replaced by
  the `document-state` action `pruneOrphanEntries`, which removes only orphaned
  testSuite entries with **no authored content** — renames/reorders keep their
  specs/goals/history. A complete fix (id-stable cleanup that can also reclaim
  data-bearing orphans) still depends on **stable section IDs** above.
- **Crash-resilient unsaved draft on desktop** (follow-up to the 2026-06-16
  autosave data-loss fix; see [`migration-log.md`](docs/migration-log.md)). The
  desktop autosave now persists the live buffer to `project.md` every 60 s, so a
  reload no longer silently reverts work. Still deferred: round-trip `local_draft`
  to a gitignored `.twriter/draft.md` (Rust `document.rs` / `layout.rs` +
  `.gitignore`) so the < 60 s window and a hard crash before the first autosave
  are also covered — fully restoring the draft/committed split the browser already
  has. The TS slice already sends and reads `localDraft`; only the Rust read/write
  + the gitignore line are missing.
- ~~**`migration_import_legacy` stub.**~~ Resolved 2026-06-22 (UX second pass; see
  [`docs/migration-log.md`](docs/migration-log.md) and
  [`docs/ux-audit.md`](docs/ux-audit.md)). The dead Rust stub and its `mod.rs` /
  `lib.rs` registration were deleted; legacy import stays JS-side
  (`src/features/migration/importer.ts`), which was always the real path.
- **Retire the `.env` AI-key fallback.** Kept during sync work to avoid breaking
  existing setups. Once the keyring path is verified in real use, remove the
  env-var fallback and its read in `src/services/ai-provider-registry.ts`.
- **Productionize the Agent SDK helper (experimental).** The `agent-sidecar/` Node
  helper is currently started by hand (`npm run agent`) and reads its own
  `CLAUDE_CODE_OAUTH_TOKEN`. Follow-ups, by mood: have Rust own the helper's
  lifecycle (spawn on app start) and inject the token from the OS keyring (add
  `'claude-oauth'` to `src/services/credentials.ts`); and re-verify the SDK
  option/message names (`query` / `options.{model,systemPrompt,allowedTools,
  settingSources,permissionMode,includePartialMessages}` / `result` / `stream_event`,
  tool-restriction) on each upgrade — pinned to `@anthropic-ai/claude-agent-sdk`
  0.3.185. (Token-level streaming now ships via `includePartialMessages: true`, which
  also feeds the live activity trace — see migration-log 2026-06-21.) JSON kinds use a prompt
  instruction + the app's tolerant `safeJsonParse` (Anthropic/Ollama parity), not the
  SDK's strict `output_format`; optional hardening is `output_format` **with graceful
  fallback** to that path, for strict typing once it can be verified per-schema. The
  webview→localhost contract is the portable path (browser-only dev can't reach a
  desktop-spawned helper), so keep it even when Rust owns the process. ToS note:
  subscription OAuth in a custom app is a gray area — single-user, own-machine use only.
- **Confirm-modal usage audit.** `ConfirmModal` (and native `confirm()`) exist;
  the ADHD-UX rule is "undo, not confirm" except for project delete — which **now
  confirms** as designed (wired 2026-06-22, UX second pass). Still to do: audit the
  remaining usages to verify they're destructive-only, and replace any
  non-destructive confirm with an undo affordance.
- **Opportunistic 300-line decomposition.** `App.tsx` (~744 lines, target a thin
  layout shell) plus other files exceed the cognitive-load target. The
  2026-06-26 audit-4.2 pass took App.tsx from 1034 → 744 by extracting the
  autosave loop (`features/shared/useAutosave.ts`) and the modal/workspace block
  (`features/modals/ModalLayer.tsx`), and trimming the over-subscribed
  `useShallow` selector. Keep going opportunistically (the remaining App-local
  handlers — `handleRunTests`, the export/import handlers — are the next seams).
  Not a build gate (ESLint warns, doesn't error); decompose when you're already
  in the file. No single decomposition unblocks anything else.

- **Version Compare follow-ups.** Shipped 2026-06-17 (see
  [`docs/migration-log.md`](docs/migration-log.md)); deep day-grained history +
  Dock launcher added the same day. A toggle-able **parallel (aligned)
  side-by-side viewer** for the diff pane shipped 2026-06-19 — off by default,
  unchanged lines aligned with blank gutters for adds/removes (see
  [`docs/migration-log.md`](docs/migration-log.md)). Remaining deliberate limits,
  by mood: (a) the
  deep index reaches back `COMPARE_INDEX_LIMIT = 2000` snapshots
  ([`src/services/tauri-repository.ts`](src/services/tauri-repository.ts)) — ample
  for one dissertation; a parameterless `snapshot_list_all` Rust command + a
  "load older" affordance is the trivial lift if a project ever exceeds it; (b)
  comparison **reports are ephemeral** — a `.twriter/comparisons/<a>..<b>.yaml`
  sidecar (Repository + both impls + `layout.rs`) would persist/export them; (c)
  comparison is **whole-document text-level** with section notes aligned by *title*
  — strict section-by-section alignment by id waits on the stable-section-ID work
  above (so renames/reorders don't mis-pair sections). (The original 20-commit
  selection limit is resolved: a blob-free metadata index loads lazily on open and
  full content is fetched per chosen version via `readSnapshot`.)

- **Parallel Editor follow-ups.** Shipped 2026-06-24. Deliberate v1 limits, by
  mood: equal-width columns (the shared `useColumnResize`/`ResizeHandle` primitive
  is ready to apply if per-column resize is wanted); orphaned saved bullets (whose
  source paragraph was deleted) are dropped on load rather than shown greyed +
  re-anchorable (the `'orphan'` display was cut from v1); the regenerate **voice**
  instruction is the locked default (`regenerateVoiceDefault`) — the editable knob
  is the regenerate *prompt*, so promoting voice to a per-project editable would
  mean adding it to `PromptsConfig`; "Generate outline" fills only blank prose rows
  (corrections preserved) with no per-row "redo this distillation"; and an inline
  col-4 word-diff (the Glass-Box transparency idiom) is unbuilt. None block use.

- **Gist Editor follow-ups.** Shipped 2026-06-24. Deliberate v1 limits, by mood:
  heading-poor documents degrade to a coarse/G0 gist (no LLM-proposed segmentation
  fallback — the brief's heading-poor path); you-are-here is cursor/selection-based,
  not a viewport IntersectionObserver (the brief permits the cursor variant — the IO
  is the refinement); panel width + grain choice are session-ephemeral (the gist
  content persists); the editor section hover-tint (a DOM affordance in the
  prototype's WYSIWYG) is dropped for the CodeMirror source view, and the navigation
  pulse is a landing-line flash rather than a paragraph fade; whole-doc analysis
  doesn't pre-flight `checkContextFit` (relies on the large-context default model —
  wire `guardContextFit` if a very large dissertation overflows); and the **house
  exemplar** ships empty — replacing the generic exemplar in `gist-composition.md`
  with an author-approved source/gist pair is the single highest-leverage refinement
  (the brief is emphatic on this). The brief's future directions (long-hover claim
  tooltips off the persisted analysis, local magnification, draft-to-draft gist diffs,
  selection-scoped gists) are all out of scope for v1.

- **Spec Test follow-ups.** Shipped 2026-06-26. Deliberate v1 limits, by mood:
  the **automatic trigger** is unbuilt — `runSpecTestForOperands`
  ([`src/lib/specTestRun.ts`](src/lib/specTestRun.ts)) is store/UI-free and ready,
  so wiring it to fire on snapshot / `session/<id>/end` (start tag as baseline) is
  the additive follow-on against the spec-evaluation-delta note above; reports are
  **ephemeral** (a `.twriter/spec-tests/<a>..<b>.yaml` sidecar would persist/export
  them, mirroring the Compare-persist follow-up); the whole-signature is folded into
  the part call rather than a dedicated `reconstructWhole` per section; **order-swap**
  "rigorous (swap & average)" debiasing is a single-flag add; section alignment is by
  title (id-based waits on the stable-section-ID work above); and scope is Changed/All
  (a chapter-subtree scope is the trivial extension). The treemap **strain/force-map**
  whole-view ([`docs/gestalt-design-II.md`](docs/gestalt-design-II.md) L3b) remains the
  heaviest, highest-ceiling deferral. None block use.

- **Sourceless-revision follow-ups.** Shipped 2026-06-19. Deliberate limits, by
  mood: the Instruction library is global only (no per-project active instruction
  or per-project library — a project-tier override would mirror the prompts tiers
  if ever wanted); no instruction import/export (the spells modal has the pattern
  to copy); `assembly` mode remains source-required by design. The shared
  `useColumnResize`/`ResizeHandle` primitive is ready to apply to any other
  column workspace (Climate/Sprint) if they grow resizable columns.

## Non-goals (out of scope by design — do not pre-build)

Unless requirements genuinely change:

- **Multi-branch git.** Single branch (whatever HEAD points to; typically `main`).
- **SSH key authentication.** HTTPS + PAT only, for now. May revisit only if PAT
  becomes annoying.
- **In-app clone-from-remote UX.** Second-machine setup is `git clone` from the
  CLI, then the standard project-open flow.
- **Y.js / Automerge real-time collaboration.** Only if a co-author is ever
  invited. Otherwise out of scope.
- **Deep Zotero integration.** The Glass-Box bridge is file-import only
  (CSL-JSON / `.md`, ephemeral). A live **local-API picker** (`localhost:23119`,
  read-only, Zotero-7+ — would need the "Allow other applications…" toggle, a
  CORS/Tauri-command path, and a picker modal), **Web-API sync** (key in keyring),
  **BibTeX/RIS** parsing, and **persisting** imported bibliographies across sessions
  are all deferred — revisit only if file import proves too manual in real use.

(The permanent non-goals — accounts, billing, telemetry, i18n, feature flags —
are a matter of project *identity* and live in [`docs/VISION.md`](docs/VISION.md),
not here.)

## Keeping this honest

A **CI gate** now enforces the *code* half of the definition of done: a GitHub
Actions workflow (`.github/workflows/ci.yml`, 2026-06-22) runs typecheck +
Vitest-with-coverage + build and `cargo test` on every push/PR, so a red suite
can't merge. **Coverage is measured** (`npm run coverage`, v8) with floor
thresholds that ratchet up. The first targeted suites (state slices, sync-policy,
the AI-registry resolver, and the Rust fs_io/git/layout/serde backend) landed the
same day — see [`docs/migration-log.md`](docs/migration-log.md). Raise the
thresholds as coverage grows. The **AI-flow orchestrators are now characterized**
(2026-06-26, see [`docs/migration-log.md`](docs/migration-log.md)): every per-flow
`ai-provider.*.ts` module plus the two `ai-provider.impl` methods `App.tsx` calls
directly (`runDiagnostic`, `estimateDependencies`) have characterization tests, and
`src/services/ai` coverage rose to ~75% lines (the floors ratcheted up to match).
The remaining test gaps are the **streaming `impl` methods** (`continueDialogue`,
`coachSprintTurn`, `developSpecLevel`, `streamCoachAdvice`) and the other inline
non-streaming methods (`getCoachAdvice`, `getContentSuggestions`, `generatePersonas`,
`refineSpec`, `analyzeSection`, `refactorAnalysis`) — a natural next increment — and
the UI feature layer (out of scope by design for unit tests).

The *doc-refresh* half of the ritual (see [`AGENTS.md`](AGENTS.md) → "Definition
of done") is still a convention. **Lingering guardrail:** add a lightweight
pre-commit hook or PR checklist that flags a feature change which doesn't also
touch `migration-log.md` + this file — turning that ritual into a real
definition-of-done rather than a habit. (CI now covers tests; this covers docs.)
