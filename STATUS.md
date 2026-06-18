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
> **Current as of 2026-06-18.** Update this file whenever a feature ships or is
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

## Next (felt priorities)

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
- **Streaming AI in a sidebar coach panel.** The `AIProvider` interface accepts
  sibling streaming methods; none implemented yet. Target a
  `streamCoachAdvice(section): AsyncIterable<string>` on the provider, consumed
  by a new `src/features/coach/` panel. This is the next-most-felt item.
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
  Dock launcher added the same day. Remaining deliberate limits, by mood: (a) the
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

## Non-goals (out of scope by design — do not pre-build)

Unless requirements genuinely change:

- **Multi-branch git.** Single branch (whatever HEAD points to; typically `main`).
- **SSH key authentication.** HTTPS + PAT only, for now. May revisit only if PAT
  becomes annoying.
- **In-app clone-from-remote UX.** Second-machine setup is `git clone` from the
  CLI, then the standard project-open flow.
- **Y.js / Automerge real-time collaboration.** Only if a co-author is ever
  invited. Otherwise out of scope.

(The permanent non-goals — accounts, billing, telemetry, i18n, feature flags —
are a matter of project *identity* and live in [`docs/VISION.md`](docs/VISION.md),
not here.)

## Keeping this honest

The doc-refresh ritual (see [`AGENTS.md`](AGENTS.md) → "Definition of done") is
currently a convention. **Optional guardrail (itself a lingering item):** add a
lightweight pre-commit hook or PR checklist that flags a feature change which
doesn't also touch `migration-log.md` + this file — turning the ritual into a
real definition-of-done rather than a habit.
