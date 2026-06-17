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
> **Current as of 2026-06-16.** Update this file whenever a feature ships or is
> planned (see the definition-of-done ritual in [`AGENTS.md`](AGENTS.md)).

## Where things stand

The app is a working Tauri 2 desktop application. The full durability stack
shipped: prose lives in `project.md` on disk, with a rebuildable SQLite cache,
git history, and one-button sync to a private GitHub remote (HTTPS + PAT in the
OS keyring). Recent feature waves, all shipped: multi-provider AI (Gemini /
Anthropic / Ollama), the Analysis + Socratic Dialogue tabs, Grimoire/lens, the
Glass-Box revision workspace, and Living Sprints (timed, move-based sessions). In-app
3-way merge conflict resolution is done. A subtle sidebar sync indicator (cyan
when synced, magenta on error) surfaces status without distraction.

## Next (felt priorities)

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

- **`ProjectFileModal` global save.** JSON edits to `projectName`, `testSuite`,
  `promptsConfig`, `customPersonas` apply to component state but never persist
  back (the modal shows "Applied successfully (Not yet saved globally)"). Either
  wire the save path or remove the misleading UI.
- **Re-enable App.tsx test-suite cleanup.** A `useEffect` is commented out
  ("Disabled to prevent deleting data when section titles change") — a data-loss
  bug was found and the feature disabled rather than fixed. Design a safer cleanup
  (cleanup only on explicit section delete, not on title rename) and re-enable.
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
