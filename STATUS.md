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
> **Current as of 2026-06-21.** Update this file whenever a feature ships or is
> planned (see the definition-of-done ritual in [`AGENTS.md`](AGENTS.md)). A
> point-in-time audit of the desktop user flow (with a flow diagram and the
> issues it fixed) lives in [`docs/ux-audit.md`](docs/ux-audit.md).

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

## Next (felt priorities)

- **Profile-driven wave, remaining items (F2 · F3 · F5).** The 2026-06-20 wave
  shipped F1/F4/F6; the analysis flagged three more, ranked by clinical leverage:
  **(F2) durable authorship/provenance marking for all AI-introduced text** —
  recognition memory is 2nd–5th %ile and false-alarms, so AI prose must stay
  visibly + persistently distinguishable from the user's own (the sourceless
  revision + ghostwriter paths currently inject unmarked text; prefer recall over
  recognition where feasible); **(F3) a "Good Enough" stop gate** against the
  perfection loop (port the explicit permission-to-stop from the user's own Glass
  Box tool; tie to the readiness ladder); **(F5) point-of-action move
  instructions** (surface sprint-move + `RequiredMove` instructions *when the
  move becomes active*, not as a skippable pre-gate). F2 is the highest-leverage
  and closes a genuine integrity hazard.

- **Gestalt roadmap (items 3–7).** Tier 1 shipped 2026-06-17 — part-not-piece
  context: prefix-truncation killed in spec generation, and a *structural surround*
  (a section's live part-in-whole relations) now threads into the diagnostic and
  analysis prompts. The design and the remaining levers live in
  [`docs/gestalt-design.md`](docs/gestalt-design.md): structural-truth (tF/fT) +
  commitment-mesh diagnostic; gap→vector next-actions; a recentering /
  question-the-goal operation; an argument whole-view on the treemap; and boundary
  correctness + B-reaction guardrails (which also retires the last `contentPreview`
  char-slice). Several depend on stable section IDs (below) for clean part alignment.
  A prompt-by-prompt pass (`gestalt-design.md` §VI) records the recommended edits to
  the prompt *texts* themselves — the highest-value being to teach `diagnostic.md` and
  `analysis.md` to consume the structural surround Tier 1 already injects. As of
  2026-06-18 the spec-derivation `contentPreview` slices (800 / 600) are now the *only*
  remaining input char-slices: every other arbitrary source/section cap was deleted in
  favour of the `checkContextFit` token-budget pre-flight (see
  [`docs/migration-log.md`](docs/migration-log.md)).
- ~~**Streaming AI in a sidebar coach panel.**~~ Done 2026-06-20 (see
  [`docs/migration-log.md`](docs/migration-log.md)). `streamCoachAdvice` now
  exists on the `AIProvider` (an `async *` mirroring `continueDialogue`), and
  `CoachModal` streams token-by-token. `src/features/coach/` is now a real panel
  home, also hosting the ambient cue and the structural-surround rail (below).
- **FTS5-backed full-text search.** The SQLite cache schema supports it; no
  command or UI exists. Add a `sections_fts` virtual table to
  [`src-tauri/src/db/schema.sql`](src-tauri/src/db/schema.sql), a `search_sections`
  Tauri command, and a sidebar search input that highlights treemap hits. (This
  also unblocks the deferred git-snapshot / `search()` fragments seam in Living
  Sprints' `buildReinstatement(..., { extraFragments })`.)
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
- **`migration_import_legacy` stub.** `src-tauri/src/commands/migration.rs`
  returns `Err`. Decide: implement bulk import in Rust, or delete the stub and
  keep import on the JS side.
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
  the ADHD-UX rule is "undo, not confirm" except for project delete. Audit usages
  to verify they're destructive-only; replace any non-destructive confirm with an
  undo affordance.
- **Opportunistic 300-line decomposition.** `App.tsx` (~988 lines, target a thin
  layout shell) plus ~14 other files exceed the cognitive-load target. Not a
  build gate (ESLint warns, doesn't error); decompose when you're already in the
  file. No single decomposition unblocks anything else.

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

The doc-refresh ritual (see [`AGENTS.md`](AGENTS.md) → "Definition of done") is
currently a convention. **Optional guardrail (itself a lingering item):** add a
lightweight pre-commit hook or PR checklist that flags a feature change which
doesn't also touch `migration-log.md` + this file — turning the ritual into a
real definition-of-done rather than a habit.
