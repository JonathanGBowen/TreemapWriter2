# Phase 5 — Polish

> Single source of truth for everything deferred past Phase 4. When Phase 5
> begins, read this file plus [migration-log.md](migration-log.md) (last
> Phase 4 entry, for context) and pick items in priority order. Replaces the
> scattered Phase 5 lists previously in `refactor-plan.md`,
> `migration-log.md`, and `id-strategy.md`.

## Big-ticket work

### Streaming AI in a sidebar coach panel
The `AIProvider` interface in [src/services/ai-provider.ts](../src/services/ai-provider.ts)
already accepts sibling streaming methods; none implemented yet. Target a
`streamCoachAdvice(section): AsyncIterable<string>` on `GeminiProvider`,
consumed by a new `src/features/coach/` panel.

### FTS5-backed full-text search
SQLite schema supports it; no UI exists. Add a `sections_fts` virtual table
in [src-tauri/src/db/schema.sql](../src-tauri/src/db/schema.sql), a
`search_sections` Tauri command in `src-tauri/src/commands/`, and a
sidebar search input that highlights treemap hits.

### In-app conflict resolution UI
[src-tauri/src/git/remote.rs:106-109](../src-tauri/src/git/remote.rs#L106)
currently returns an **empty conflict list** from `pull` even when a real
conflict exists. Today users resolve via their git client. Phase 5: run a
real merge, surface conflicted sections in a modal, let the user pick
ours/theirs/edited per hunk.

### Stable section IDs (was `docs/id-strategy.md`)
Today IDs are derived from `title.slug + index`
([src/lib/utils.ts:4-6, 78-92](../src/lib/utils.ts#L4)). Fragile under
duplicate titles, renames, and reordering. Phase 5 work:

- IDs become opaque ULIDs (or UUIDv7), assigned at section creation, never
  derived from title or position.
- Markdown stores a YAML-frontmatter `id:` per section file; the
  `parseMarkdown` parser reads the mapping rather than re-deriving from
  title.
- Migration: on first load, walk existing sections and assign ULIDs,
  persisting the title→ULID map.
- Open question: handling true deletes — garbage collect on load, or keep
  orphan IDs until next snapshot? Default keep, so dependency edges to
  deleted sections survive an undo.
- Cost estimate: ~1 day + a per-project migration.
- Trigger to prioritize: any rename/reorder bug surfacing in production.

### 300-line cap follow-up
[App.tsx](../src/App.tsx) still ~932 lines (target ~150 — layout shell
only); 13 other files over the cap per the Phase 3.5 audit. Opportunistic;
no single decomposition unlocks anything else.

## Small lingering items

### ProjectFileModal global save
[src/features/modals/ProjectFileModal.tsx:77](../src/features/modals/ProjectFileModal.tsx#L77)
shows `"Applied successfully (Not yet saved globally)"`. JSON edits to
`projectName`, `testSuite`, `promptsConfig`, `customPersonas` apply to
component state but never persist back. Either wire the save path or
remove the misleading UI.

### App.tsx test-suite cleanup re-enable
Around [src/App.tsx](../src/App.tsx) lines 195–210, a `useEffect` block
is commented out, labeled "Disabled to prevent deleting data when section
titles change." A data-loss bug was found and the feature was disabled
rather than fixed. Phase 5: design a safer cleanup (e.g. cleanup only on
explicit section delete, not on title rename) and re-enable.

### `migration_import_legacy` stub
[src-tauri/src/commands/migration.rs:20-22](../src-tauri/src/commands/migration.rs#L20)
returns `Err`. Decision deferred from Phase 3g: bulk import in Rust vs.
stay on the JS side. Resolve and either implement or delete the stub.

### `.env` Gemini key path retirement
[migration-log.md:1056](migration-log.md#L1056) — env fallback was kept
during Phase 4 to avoid breaking existing setups. After the keyring path
is verified in real use, remove the fallback (and its env-var read in
[src/services/ai-provider-registry.ts](../src/services/ai-provider-registry.ts)).

## Explicit non-goals

Stay out of Phase 5 unless requirements change:

- **Multi-branch support.** Single branch (whatever HEAD points to;
  typically `main`).
- **SSH key authentication.** Phase 5 *may* add this if HTTPS+PAT becomes
  annoying. Currently HTTPS+PAT only.
- **Clone-from-remote UX inside the app.** Second machine setup uses
  `git clone` from CLI, then standard project-open flow.
- **Y.js / Automerge for real-time collaboration.** Only if a co-author
  is ever invited. Otherwise out of scope; do not pre-build.

## Order to pick items

When Phase 5 starts: conflict-resolution UI is the only item gated by an
actual user-facing limitation today (silent merge failures). Streaming AI
is the next-most-felt. The rest is polish — pick by mood or by which bug
surfaces first.
