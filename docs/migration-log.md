# Migration Log

Append-only record of architectural phase transitions. The most recent entry
at the bottom is the current state.

> **Doc map (2026-06-15 reorg).** This log is *history*. For the current backlog
> see [`../STATUS.md`](../STATUS.md); for how the app is built today see
> [`../AGENTS.md`](../AGENTS.md); for the principles see [`VISION.md`](VISION.md).
> On 2026-06-15 the docs were reorganized — `ARCHITECTURE.md` was split (now a
> tombstone) and `refactor-plan.md` / `phase-5.md` / `living-sprints-plan.md`
> were frozen in place. Entries below reference those docs at their original
> paths; that is the historical record and is intentionally not rewritten.

## Format

Each entry: date, phase entered, summary of what changed, what to verify
before proceeding, rollback procedure.

---

## 2026-05-07 — Phase 0 entered

**What changed.** Foundations only. No functional behavior changed.

- Added `AGENTS.md` at repo root.
- Added `docs/ARCHITECTURE.md` (this file's sibling).
- Added `docs/migration-log.md` (this file).
- Added `docs/id-strategy.md` placeholder (Phase 1 will fill it in).
- Added ESLint flat config (`eslint.config.js`) with `max-lines: 300` and
  `complexity` rules. Existing files exceed the cap; lint surfaces them as
  warnings for now.
- Added `.editorconfig`.
- Added Vitest (`vitest.config.ts`) and the first test:
  `src/lib/__tests__/utils.parseMarkdown.test.ts`.
- Added a "Backup all projects" button to `Sidebar.tsx`. Button calls a
  self-contained utility in `src/lib/exportBackup.ts` that reads every
  IndexedDB key under `socratic_*` and triggers a single JSON download.
- Added `package.json` scripts: `test`, `typecheck`, `lint`.
- **Fixed 6 latent type errors in `src/App.tsx`** that the new `npm run typecheck`
  surfaced. None of these were caught at build time because Vite uses esbuild
  (no type checking). All sat in seldom-used code paths (project import,
  project export, version restore) and would have crashed at runtime if
  exercised:
  - `STORAGE_PREFIX` and `META_KEY` were referenced in App.tsx but only
    defined locally inside `src/store/index.ts`. Exported them from the store
    and imported them where used.
  - Two calls to `saveCurrentState(...)` were passing 3–4 positional arguments
    to a zero-argument store action. Removed the arguments; the store reads
    state directly.
  - One call to `setProjectList(prev => ...)` was using React's `useState`
    callback pattern against a Zustand action that takes a value, not a
    callback. Rewritten to read current list via `useStore.getState()`.
  - `getStorageData()` was called but never defined. Replaced with an
    inline assembly of the export payload from `useStore.getState()`,
    matching the shape the store's own `saveCurrentState` writes.

**Verify before Phase 1.**

1. `npm install` succeeds.
2. `npm test` passes (`parseMarkdown` round-trip).
3. `npm run typecheck` passes.
4. `npm run dev` launches the app; existing dissertation projects load.
5. **Click the new "Backup" button. Save the resulting JSON somewhere safe.**
   This is the migration insurance for Phase 3.

**Rollback.** `git switch main && git branch -D <branch>`. No data was
touched; rollback is purely code.

**Current state.** Storage: IndexedDB (unchanged). Tooling: ESLint + Vitest
in place. Documentation: in place. Backup path: in place.

---

## 2026-05-07 — Phase 1a entered

**What changed.** Prompt content moved out of TypeScript code into standalone
`.md` files. No persistence, no behavior changes for the user.

- Created `src/services/prompts/` containing one `.md` file per prompt:
  `system-instruction.md`, `l1-task.md`, `sub-task.md`, `suggest-content.md`,
  `coach.md`, `refine-spec.md`, `generate-personas.md`, `diagnostic.md`,
  `dependencies.md`.
- Created `src/services/prompts/index.ts` — imports each `.md` via Vite's
  `?raw` query and assembles `DEFAULT_PROMPTS_CONFIG` from them.
- Rewrote `src/lib/constants.ts`: re-exports `DEFAULT_PROMPTS_CONFIG` from the
  new location; keeps `SECTION_FUNCTIONS`, `buildDiagnosticPrompt`, and
  `DEFAULT_MARKDOWN`. Down from 547 to ~360 lines.
- Added `src/vite-env.d.ts` with `/// <reference types="vite/client" />` to
  make TypeScript aware of `?raw` imports.
- Incidental: `DEFAULT_MARKDOWN` (the demo project fallback, unused — defined
  but not imported anywhere) had `\Bigg` etc. in its template literal, which
  JavaScript silently strips. The rewrite preserves the developer's evident
  intent by writing `\\Bigg` so the runtime string contains `\Bigg`. This
  affects no live code paths today.

**Verify before Phase 1b.**
- `npm test` passes (9/9).
- `npm run typecheck` passes.
- `npm run build` succeeds.
- Optionally: `npm run dev` and confirm AI flows still call the same prompts
  (text content is identical).

**Rollback.** `git revert <commit>` restores the inline prompts.

---

## 2026-05-07 — Phase 1b entered

**What changed.** Persistence boundary established. The store no longer
imports `idb-keyval` directly; it talks to a `Repository` interface.

- `src/services/repository.ts` defines the `Repository` interface and the
  `StoredProjectData` shape (loosely typed because real-world data has
  accumulated under multiple schema versions).
- `src/services/browser-repository.ts` implements `Repository` against
  `idb-keyval` plus localStorage fallback. Owns its own copies of
  `STORAGE_PREFIX`, `META_KEY`, `socratic_project_v1` legacy key.
- `src/store/index.ts` thunks (`loadInitialState`, `loadProject`,
  `deleteProject`, `saveCurrentState`) now call `repo.*`. The store no
  longer imports `idb-keyval`. The legacy-localStorage migration block
  moved into `repo.migrateVeryOldLegacy()`.
- `STORAGE_PREFIX` and `META_KEY` remain exported from the store, marked
  `@deprecated`, until Phase 1c removes their last consumer (`App.tsx`'s
  `handleLoadFile` and `handleExportProject`).

**Verify before Phase 1c.**
- `npm test` (9/9), `npm run typecheck` (clean), `npm run build` (ok).
- Optional manual: launch dev server, confirm projects still load, save,
  delete, and that a fresh install with no IndexedDB gracefully migrates
  any legacy localStorage `socratic_project_v1` if present.

**Rollback.** `git revert <commit>`.

**Note.** `App.tsx` still imports `idb-keyval` directly in the project
import/export handlers. That violation is scheduled for cleanup in
Phase 1c, when the store is sliced and `App.tsx` decomposes.

---

## 2026-05-07 — Phase 1c entered

**What changed.** The Zustand store, formerly a 482-line monolith mixing
UI ephemera with domain data and persistence thunks, is now partitioned
into five lifecycle slices.

- `src/state/ui-state.ts` — sidebar/panel widths, focus mode, dark mode,
  isProcessing, isInterpolating, 14 modal flags. ~110 lines.
- `src/state/editor-state.ts` — localContent, selectedId, activeLineIndex.
  ~40 lines.
- `src/state/document-state.ts` — markdown, sections, testSuite,
  hiddenSectionIds, revisions, lastAutoSave. ~55 lines.
- `src/state/project-state.ts` — projectList, activeProjectId,
  projectName, plus all persistence thunks (loadInitialState,
  createDemoProject, createNewProject, loadProject, deleteProject,
  saveCurrentState, createSnapshot). ~260 lines — the only slice that
  knows the on-disk schema. Calls `browserRepository`.
- `src/state/ai-state.ts` — activePersonaId, customPersonas,
  promptsConfig, cachedCoachAdvice. ~45 lines.
- `src/state/index.ts` — combines slices into `AppState`, exports
  `useStore` with the same shape as before so component imports are
  unchanged.
- `src/store/index.ts` — was 482 lines, now an 11-line back-compat
  re-export from `src/state`. Marked `@deprecated`.

The `useStore` facade preserves its full surface area: every action and
field that existed before still exists. No component code changed.

**Why this partition.** Lifecycle, not feature. UI ephemera (modal
flags, panel widths) lives separately from domain data (markdown,
testSuite). Persistence thunks coordinate cross-slice writes via
`get()`/`set()` typed against the full `AppState`.

**Verify before Phase 1c follow-up.**
- `npm test` (9/9), `npm run typecheck` (clean), `npm run build` (ok).
- `npm run lint`: down to 173 problems (from 225 in Phase 0). All
  remaining violations are in pre-existing files; the god-store's
  violations are gone with its file.
- Optional manual: launch dev, exercise modals, save/load/delete
  projects, edit and watch autosave fire.

**Rollback.** `git revert <commit>` restores the monolithic store.

**Still to do** (Phase 1c follow-up, deferred):
- `App.tsx` still imports `idb-keyval` and uses `STORAGE_PREFIX` /
  `META_KEY` directly in `handleLoadFile`. Should be migrated to call
  `browserRepository`. Same for any other direct persistence calls.
- Components destructure 60+ fields from `useStore`. They should
  migrate to slice-scoped selectors. This is incremental — each
  component PR can switch to slice imports without a flag day.
- App.tsx is still 1,000+ lines. Decomposition into feature folders
  is a separate, larger commit.

---

## 2026-05-07 — Phase 1d entered

**What changed.** App.tsx no longer imports `idb-keyval` and no longer
treats the IndexedDB layer as something it can reach into directly.

- `src/services/preferences.ts`: tiny new module wrapping the
  app-level "tutorial seen" flag. Separate from the Repository
  because preferences are global, not project-scoped.
- App.tsx: drops `import { get, set, del } from 'idb-keyval'`,
  uses `browserRepository` for project import/export and the
  `preferences` module for the tutorial flag.
- `src/state/document-state.ts`: new `setCachedSuggestions` action
  and `restoreSnapshot` (cross-slice, in `project-state`) action,
  so modals can avoid composing actions ad hoc.
- `src/state/index.ts` and `src/store/index.ts`: drop the orphaned
  `STORAGE_PREFIX`/`META_KEY` re-exports — last consumer is gone.

**Verify.** `npm test` (9/9), `npm run typecheck` (clean),
`npm run build` (ok).

**Rollback.** `git revert <commit>`.

---

## 2026-05-07 — Phase 1e entered

**What changed.** All 13 modals now self-mount via the store. They no
longer accept `isOpen` or `onClose` from a parent. They subscribe to
their own openness flag and call the store setter on close. Domain-level
testSuite mutators (previously `useCallback`s defined in App.tsx)
became proper actions on the document slice.

- `src/state/document-state.ts`: added `updateSpec`,
  `updateSectionGoals`, `updateDependencies`, `updateMainClaim`. The
  AI-write snapshot trigger is now cross-slice (calls
  `get().createSnapshot('pre-ai-write', ...)`).
- 13 modal files: dropped `isOpen` / `onClose` from props; subscribe
  to `useStore(s => s.showXModal)`. `BaseSprintModal` is special-cased
  because it's mounted twice with different `mode` props — subscribes
  to both flags and selects by mode.
- `src/App.tsx`: dropped `isOpen` / `onClose` props from every modal
  mount site (13 sites). `<ConfirmModal>` mount unchanged because it's
  driven by local state, not the store.

App.tsx is 1062 → 1048 lines (modest; the heavy shrink lands in 1f
when panel components subscribe directly).

**Verify before Phase 1f.**
- `npm test` (9/9), `npm run typecheck` (clean), `npm run build` (ok).
- Lint: 187 problems (up from 173 — mostly unused-var warnings from
  the destructuring tweaks, all in pre-existing files; will burn down
  in 1f when those files lose their prop deluges).
- Optional manual: open every modal once; confirm it opens, displays
  data, and closes correctly.

**Rollback.** `git revert <commit>`.

**Pattern for new modals going forward.**
Subscribe to the openness flag and setter from `useStore`. Only
orchestration handlers (e.g. `onRun={handleRunTests}`) should be
props. Data and openness flags come from the store. See
`AGENTS.md` "Where to put X" for the rule.

---

## 2026-05-08 — Phase 1f entered

**What changed.** The three big panel components — Sidebar, EditorPanel,
TestsPanel — no longer take state-derived props from App.tsx. They
subscribe to the Zustand store directly. App.tsx mount sites collapse
from dozens of props each to under ten.

| Component | Props before | Props after |
|---|---|---|
| Sidebar | 31 | 9 |
| EditorPanel | 21 | 4 |
| TestsPanel | 16 | 0 |

App.tsx: 1048 → 919 lines.

- `src/state/ui-state.ts`: `activeTab` / `setActiveTab` added (was a
  local `useState` in App.tsx).
- `src/state/document-state.ts`: `toggleSectionVisibility` added.
- `src/lib/defaultPersonas.ts`: extracted `DEFAULT_PERSONAS` from
  inline definition in App.tsx so panels can derive `activePersona`
  themselves.
- `src/components/Sidebar.tsx`: kept `onSelect`, file-handler props,
  `onResetProject`, `onLoadDefaultProject`, `onStartTutorial`. Modal
  openers became inline `() => setShowXModal(true)` calls.
- `src/components/panels/EditorPanel.tsx`: kept `handleSave`,
  `editorRef`, `onImportMarkdown`, `onLoadProject`. Everything else
  via `useStore`. Computes `currentSection` from `selectedId` +
  `sections` via local helper.
- `src/components/panels/TestsPanel.tsx`: zero props. Computes
  `currentSection` and `activePersona` itself. Translates
  `updateGoals(text)` calls into
  `updateSectionGoals(currentSection.id, text, 'manual')`.
- `src/App.tsx`: removed inline `DEFAULT_PERSONAS`, removed
  `[activeTab, setActiveTab]` `useState`, removed orphaned
  `useCallback`s for `updateSpec`, `updateGoals`, `updateMainClaim`,
  `toggleSectionVisibility` (all now in store; no remaining callers).
  `updateSectionGoals` and `updateDependencies` `useCallback`s remain
  for now — they're still referenced inside modal mounts. Slimming
  those is a Phase-1g+ follow-up.

**Verify before Phase 1g.**
- `npm test` (9/9), `npm run typecheck` (clean), `npm run build` (ok).
- `npm run lint`: 209 problems (was 215). Minor — Phase 1g file moves
  will further reduce as imports rewire.
- Manual smoke: launch dev, edit a section, save, switch tabs in
  EditorPanel, resize Sidebar / TestsPanel, open modals from Sidebar
  buttons.

**Rollback.** `git revert <commit>`.

**Still to do for Phase 1 closure.**
- Phase 1g: move components into `src/features/<name>/` folders to
  match the target layout in `docs/ARCHITECTURE.md`.
- Phase 1h: refresh agent-facing docs (already done incrementally,
  but a final pass before declaring Phase 1 complete).

---

## 2026-05-08 — Phase 1g entered

**What changed.** All UI components moved out of `src/components/`
into feature folders under `src/features/`. The directory
`src/components/` is gone.

| From | To |
|---|---|
| `src/components/Sidebar.tsx` | `src/features/sidebar/Sidebar.tsx` |
| `src/components/Treemap.tsx` | `src/features/treemap/Treemap.tsx` |
| `src/components/Tutorial.tsx` | `src/features/tutorial/Tutorial.tsx` |
| `src/components/panels/EditorPanel.tsx` | `src/features/editor/EditorPanel.tsx` |
| `src/components/panels/TestsPanel.tsx` | `src/features/tests-panel/TestsPanel.tsx` |
| `src/components/modals/*.tsx` (14 files) | `src/features/modals/*.tsx` |

Imports updated:
- `src/App.tsx`: 18 component import paths.
- `src/features/sidebar/Sidebar.tsx`: `../types` → `../../types`,
  `../store` → `../../store`, `../lib/exportBackup` →
  `../../lib/exportBackup`, `./Treemap` → `../treemap/Treemap`.
- `src/features/treemap/Treemap.tsx`: same depth-shift fixes.
- All other moved files were at depth 3 before and remain at depth
  3 after, so their `../../` imports are unchanged.

**Verify before declaring Phase 1 complete.**
- `npm test` (9/9), `npm run typecheck` (clean), `npm run build` (ok).
- Manual smoke: app launches; existing projects load; modals open;
  panels render correctly.

**Rollback.** `git revert <commit>`. The moves are tracked as
renames in git so the history is preserved.

**AGENTS.md updated.** Source-tree map now reflects the actual
layout. The "where to put X" modal entry no longer says "will move
in Phase 1g" — it points at the real location.

---

## 2026-05-08 — Phase 1 complete (1h: doc closeout)

**What changed.** Final agent-doc refresh. No code changes.

- `docs/ARCHITECTURE.md`: target layout updated to match the actual
  source tree. Phases table now has a Status column; Phase 0 and
  Phase 1 are marked ✅ done; Phase 2 is ⏳ next.

**Phase 1 net effect (across commits 8d2e9c8…c590303):**

| Aspect | Before Phase 1 | After Phase 1 |
|---|---|---|
| Store file | one 482-line god-store | five lifecycle slices (~40–260 lines each) |
| Persistence | components import `idb-keyval` directly | `Repository` interface; only `browser-repository.ts` and `preferences.ts` touch IDB |
| Prompts | 547-line `constants.ts` | 9 standalone `.md` files; 360-line `constants.ts` |
| Modal mounting | App.tsx mounts 14 modals with 5–10 props each | self-mounted; App.tsx passes 0–1 props per modal |
| Sidebar / EditorPanel / TestsPanel | 31 / 21 / 16 props | 9 / 4 / 0 props |
| App.tsx | 1062 lines | 919 lines |
| Source tree | mixed `src/components/` + `src/components/panels/` + `src/components/modals/` | unified under `src/features/<name>/` |
| Cross-cutting helpers in App.tsx | `updateSpec`, `updateGoals`, `updateMainClaim`, `toggleSectionVisibility`, `DEFAULT_PERSONAS`, `[activeTab, setActiveTab]` | all moved to slices or `src/lib/defaultPersonas.ts` |
| Tests | none | 9 passing (parseMarkdown round-trip + edge cases) |
| Lint | 225 problems on entry | 209 problems |
| Latent bugs caught | — | 6 in App.tsx surfaced by typecheck (Phase 0) |

**Verify Phase 1 end-state.**
- `npm test` (9/9), `npm run typecheck` (clean), `npm run build` (ok).
- The dev server should launch without errors.
- Click through every modal once; confirm they open, render, and
  close. Edit a section, save, reload — content persists.
- Open the Backup button (Sidebar archive icon) and save the JSON
  somewhere safe. The Phase 3 importer will round-trip from this
  format.

**Ready for Phase 2** — Tauri shell. Plan in
[`refactor-plan.md`](refactor-plan.md) Part IV (committed to the repo
during Phase 3.5; previously referenced only as a sandbox path).

**Standing rule (from AGENTS.md "End-of-phase ritual"):** every
future phase commit must include refreshed AGENTS.md /
ARCHITECTURE.md / migration-log.md if reality drifted. The point of
these files is that no fresh agent — including you, after a week
away — should pay the re-derivation tax. They're load-bearing.

---

## 2026-05-08 — Phase 2 entered

**What changed.** Tauri 2 desktop shell wraps the existing React UI.
Storage is still IndexedDB; no domain code changed. The app can now
launch as a native desktop window (given system deps installed).

- `src-tauri/` — Rust crate, scaffolded by `tauri init --ci`
  - `Cargo.toml`: package `treemap-writer`, lib `treemap_writer_lib`
  - `tauri.conf.json`: identifier `com.treemapwriter.app`, 1400×900
    default window, 900×600 minimum, `theme: "Dark"` to match HLD
  - `src/main.rs`: desktop entry → `treemap_writer_lib::run()`
  - `src/lib.rs`: builder + the first IPC command, `app_info`, which
    returns name/version/tauri version. Sanity probe; future
    persistence commands register on the same `invoke_handler`.
- `src/services/tauri-environment.ts`: `isTauri()` detects the
  runtime; `appInfo()` is the typed JS wrapper around the IPC
  command. Components never call `invoke()` directly.
- `package.json` scripts: `tauri`, `tauri:dev`, `tauri:build`.
- `package.json` deps: `@tauri-apps/api@^2`,
  `@tauri-apps/plugin-dialog@^2`, `@tauri-apps/plugin-fs@^2`,
  dev: `@tauri-apps/cli@^2`.

**Why Tauri over Electron** (reaffirmed): smaller bundle (~10MB vs
~150MB), capability-based security, native API key storage path
opens up via `keyring` crate in Phase 3, Rust ecosystem has
`rusqlite` + `git2` ready to drop in.

**Verify before Phase 3.**

JS side (works in this sandbox):
- `npm test` (9/9), `npm run typecheck` (clean), `npm run build` (ok).

Desktop side (requires the user's machine, NOT this sandbox):
- Linux: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
  libayatana-appindicator3-dev librsvg2-dev`
- macOS: Xcode Command Line Tools.
- Windows: Microsoft C++ Build Tools + WebView2 runtime.
- Then: `npm run tauri:dev`. A native window should open showing the
  same UI the browser does. In the dev console, run
  `(await import('./services/tauri-environment')).appInfo()` — should
  return `{ name: "treemap-writer", version: "0.1.0", tauri_version: "..." }`.
- `npm run tauri:build` produces an installer in
  `src-tauri/target/release/bundle/`.

**Sandbox note.** This commit's Rust code was NOT compiled here —
the sandbox lacks `webkit2gtk-4.1` / `gtk-3.0` / `gdk-3.0`. The code
is the standard Tauri 2 init template plus a one-fn modification
(`app_info`). When the user runs `cargo check` on a machine with the
system deps, it should pass. If it doesn't, the failure is in
`src-tauri/src/lib.rs` and is small enough to triage by inspection.

**Rollback.** `git revert <commit>`. The src-tauri/ directory is new;
nothing in src/ depends on it at runtime yet (the JS still uses
`browserRepository`). Reverting cleanly returns to the browser-only
build.

**Still to do for Phase 2 closure (optional).**
- A startup probe that calls `appInfo()` from `App.tsx` when
  `isTauri()` and console-logs the version. Useful for end-to-end
  verification but not needed for Phase 3.
- Replace placeholder icons (`src-tauri/icons/`) with HLD-themed
  ones. Cosmetic; can wait.

---

## 2026-05-08 — Phase 3 entered

The architectural heart of the refactor: the dissertation moves out of
the IndexedDB blob and into a real folder on disk, with git as its
history and SQLite as a query cache. Phase 3 lands across 8 commits
(3a–3h), 1 test commit (3j), and this closeout (3k). Phase 3i is
absorbed because the eager-fetch in TauriRepository.getProject (last
20 commits → in-memory revisions) makes VersionHistoryModal work
unchanged.

### Phase 3a — Rust foundations

`src-tauri/` gains the module skeleton: `commands/{project, document,
snapshot, migration}.rs`, `project/{mod, layout}.rs`, `db/{mod.rs,
schema.sql}`, `git/mod.rs`, `fs_io/{mod, yaml}.rs`, plus `error.rs` and
`types.rs`. Cargo deps: `rusqlite` (bundled + FTS5), `git2`
(vendored-libgit2), `serde_yaml`, `dirs`, `anyhow`, `thiserror`,
`chrono`, `tauri-plugin-dialog`. `lib.rs` registers all commands and
manages an `AppState` holding the global recent-projects DB plus the
optional currently-open `ProjectHandle`. Empty stubs at this phase;
later phases fill them in.

### Phase 3b — Project lifecycle

`project_create(path, name)` validates the target is empty/absent,
writes `project.md` + `.twriter/settings.json` + `.gitignore`, runs
`git init` + initial commit, opens the per-project SQLite cache, and
inserts a row into the global recent-projects DB. `project_open(path)`
validates the folder shape (`project.md` + `.twriter/`), opens
git+cache, upserts/refreshes the recent row. `project_close` drops the
handle. `project_list_recent` returns metadata sorted by
`last_opened DESC`, hiding rows whose folder no longer exists.
`project_delete_recent` removes the row but does NOT delete the folder.

`git/mod.rs` gains `init`, `ensure_initial_commit`, `commit_all`
(no-op on empty diff so autosaves don't pile up empty commits). Author
is hardcoded `TreemapWriter <noreply@treemapwriter.local>`.

### Phase 3c — Document read/write

`project_read` walks the project folder and assembles a
`StoredProjectData`: `project.md`, the `.twriter/*.json` sidecars, and
every `.twriter/specs/*.spec.yaml`. `project_write` does the inverse,
atomically (temp file + fsync + rename per file). Per-section YAML uses
a new `PersistedTestEntry` type that strips ephemeral fields (`status`,
`lastDiagnostic`, `lastResult`, `cachedSuggestions`) — those belong in
the SQLite cache, not in git history. Orphan policy: spec YAMLs whose
section IDs vanish from the current testSuite are LEFT on disk.

### Phase 3d — Snapshots = git commits

`snapshot_commit(message, trigger, affectedScope)` stages the working
tree and creates a commit with a structured message:
```
<trigger>: <message>

Scope: all   (or)   Scope: section-1,section-2
```
`snapshot_list(limit)` walks `git log` and returns lightweight
`SnapshotMeta`. `snapshot_read(commitId)` walks a commit's tree without
checking out, returning a full `Snapshot` (markdown + testSuite
reconstructed from blobs). The commit-message parser is robust to
user-edited messages (e.g. via `git commit --amend`); trigger defaults
to `'manual'`, scope to `'all'`.

### Phase 3e — TauriRepository

`src/services/tauri-repository.ts` wraps the Tauri IPC commands behind
the existing `Repository` interface. Components don't notice the
storage swap. `getProject(id)` looks up a path from a cached
id→path map, calls `project_open` → `project_read`, then eager-fetches
the last 20 git commits via `snapshot_list` + `snapshot_read` and
populates `revisions` so the VersionHistoryModal works without code
changes. `setMeta` is a no-op (the Rust DB updates implicitly).
`migrateVeryOldLegacy` is null (Tauri's webview doesn't share storage
origin with browser localStorage).

### Phase 3f — Repository registry / DI

`src/services/repository-registry.ts` picks the active repository at
module load: `tauriRepository` under Tauri, `browserRepository` in the
browser. Frozen for the session. The store's `project-state.ts`
imports `repository as repo` from the registry; `App.tsx` likewise.

`Repository` interface gains `commitSnapshot(message, trigger, scope)`.
BrowserRepository's impl is a no-op (returns null); TauriRepository
calls `snapshot_commit`. `createSnapshot` thunk now calls
`repo.commitSnapshot` after `saveCurrentState`, replacing the synthetic
in-memory id with the real commit OID.

### Phase 3g — Importer

`src/features/migration/importer.ts` is a pure planning function +
executor. `plan(backup, targetDir)` walks every `socratic_p_*` entry,
slugifies project names into subfolders (collisions → numeric suffix),
and emits a flat `ImportCommand[]`: `project_create` → for each
revision chronologically (`project_write` + `snapshot_commit`) →
final (`project_write` + `snapshot_commit "Imported from legacy
backup"`). `executePlan(plan, onProgress)` runs the commands via Tauri
IPC. Legacy `interpolationConfig` normalizes to `promptsConfig`.

### Phase 3h — Migration UI

`src/features/migration/use-legacy-migration.ts` detects on Tauri
launch whether to prompt: only if state is `'pending'` AND the Rust
recent-projects DB is empty. Stores `'done' | 'skipped'` in
`localStorage` after the user's choice. Three flows in
`MigrationModal.tsx`: import-from-backup-file (Tauri dialog file
picker → `readTextFile` → `plan` → folder picker → `executePlan`),
import-from-this-device-cache (`snapshotLocalIdbAsBackup` → same
import flow; relevant only for users who ran an early Tauri build
before Phase 3 swapped the repository), or skip. Auto-opened from
`App.tsx`'s `legacyDetection.shouldPrompt`.

Rust additions for the file read: `tauri-plugin-fs` crate +
`fs:allow-read-text-file` capability. The dialog plugin was already
present from Phase 3a.

### Phase 3i — VersionHistoryModal (no changes needed)

The existing modal reads from in-memory `revisions[]`.
TauriRepository.getProject populates `revisions` from the last 20
commits during project open. The modal works unchanged. A future
enhancement (Phase 5) can lazy-fetch older commits via
`snapshot_list/snapshot_read` on demand.

### Phase 3j — Tests

`src/features/migration/__tests__/importer.test.ts`: 9 tests covering
command count per project, slug + collision suffix, chronological
revision ordering, `interpolationConfig` → `promptsConfig`
normalization, non-project entry skipping, unknown-trigger fallback to
`'manual'`. Plus 3 `slugify` tests. Suite: 9/9 → 18/18.

### Phase 3k — Doc closeout (this entry)

- AGENTS.md: "Where to put X" gains rows for new Tauri IPC commands,
  on-disk files, and git operations. Source-tree map adds the
  `src-tauri/src/{commands,project,db,git,fs_io}` subdirs and the
  on-disk project layout.
- ARCHITECTURE.md: Phases table marks Phase 3 ✅, Phase 4 ⏳.
- This file: full Phase 3 entry.

### Phase 3 net effect

| Aspect | Before | After |
|---|---|---|
| Source of truth | IndexedDB blob (per project) | `project.md` on disk + `.twriter/specs/*.yaml` |
| Snapshots | Full deep copies in `revisions[]` array, capped at 50 | Real git commits, unbounded |
| Storage growth | `O(history × document)` | content-addressed via git; `O(diff)` per commit |
| Cross-machine | impossible (browser-local) | git push/pull (Phase 4 wires the UI) |
| Recovery paths | one (the IndexedDB blob) | three (markdown files, SQLite cache, git history) |
| Tauri Rust LOC | ~50 (Phase 2) | ~1000 |
| Tests | 9 (parseMarkdown) | 18 (parseMarkdown + importer) |

### Verify Phase 3 end-state (user, on their machine)

JS side (verifiable in any sandbox):
- `npm test` (18/18)
- `npm run typecheck` (clean)
- `npm run build` (ok)

Rust side (requires libwebkit2gtk-4.1-dev + libgtk-3-dev + libsoup-3.0-dev
+ libjavascriptcoregtk-4.1-dev + libayatana-appindicator3-dev +
librsvg2-dev on Linux; equivalent on macOS / Windows):
- `cd src-tauri && cargo check` — must succeed
- `npm run tauri:dev` — desktop window opens

End-to-end migration smoke test:
1. In the browser version, click the Backup icon (Sidebar archive button).
   Save the JSON somewhere safe.
2. Launch `npm run tauri:dev`. The MigrationModal should auto-open.
3. Pick "Import from backup file", choose the JSON.
4. Pick a destination folder (e.g. `~/Dissertation`).
5. Watch the progress bar; the modal reports per-project folders on
   completion.
6. Open one of the imported folders in a plain text editor. Confirm
   `project.md` carries your prose. Confirm `.twriter/specs/*.spec.yaml`
   files are human-readable.
7. Edit a section in the app. Watch `git log` in the project folder —
   a new commit should land within 60s (autosave) or immediately on
   manual save.
8. Open VersionHistoryModal in the app. Confirm recent commits are
   listed. Restore an older one. Content rolls back.

### Rollback procedures

- 3a–3d: `git revert` removes the Rust code. JS uses none of it yet.
- 3e: `git revert` restores `browserRepository` imports.
- 3f: revert removes the registry. **Revert 3e + 3f together** —
  reverting only 3f leaves Tauri builds with no persistence.
- 3g–3h: `git revert` removes the importer + UI. Already-migrated
  projects on disk still work because 3e + 3f remain.

### What is explicitly NOT in Phase 3

- No git remote (Phase 4).
- No FTS5 search UI (Phase 5).
- No streaming AI (Phase 5).
- No conflict resolution UI (Phase 5).
- No project-folder delete from within the app (user uses `rm -rf`).
- No git config UI (author hardcoded for now).
- VersionHistoryModal still loads only the last 20 commits eagerly.
  Older history is in `.git/` but not reachable through the UI yet.

---

## 2026-05-10 — Phase 3.5 (AI provider abstraction + master plan committed)

**Honest framing.** This phase completes work that the master plan
specified for Phase 1 but Phase 1 silently skipped. The plan's "Critical
files — Phase 1 — Decompose" section lists, verbatim:

> `src/lib/ai-pipeline.tsx:1-404` → refactor as the Gemini implementation
> of `src/services/ai-provider.ts`

Phase 1a extracted prompts to `.md` files but stopped there; the
`AIProvider` interface and the Gemini implementation never landed. Phase
1h closed Phase 1 without flagging the deferral. Through Phases 2 and 3,
`@google/genai` continued to be imported directly in App.tsx, the AI
pipeline file, and four React modals — exactly the anti-pattern
AGENTS.md names. Phase 3.5 is the cleanup that should have been part of
Phase 1, slotted at the seam between Phase 3 and Phase 4 because (a) the
longer it festered the more places it spread to, and (b) Phase 5's
streaming-AI polish needs the abstraction to exist.

### What changed

**AI provider abstraction.**

- New: `src/services/ai-provider.ts` — interface modeled on
  `repository.ts`. Seven methods: `generateSpecs`, `runDiagnostic`,
  `estimateDependencies`, `getCoachAdvice`, `getContentSuggestions`,
  `generatePersonas`, `refineSpec`. Each takes a typed input object and
  returns a typed domain value. A one-line comment notes that Phase 5
  will add sibling streaming methods (e.g. `streamCoachAdvice():
  AsyncIterable<string>`) without disturbing existing callers.
- New: `src/services/gemini-provider.ts` — the **one and only** file
  that imports `@google/genai`. Owns prompt assembly, model defaults
  (flash for personas, pro + 16k thinking for refineSpec), JSON parsing,
  and response normalization. Client is lazy: `this.client` is a getter
  that constructs the SDK only on first use, so an app launched without
  an API key still boots and only fails when AI is invoked (matching
  pre-3.5 behavior).
- New: `src/services/ai-provider-registry.ts` — sibling DI registry
  parallel to `repository-registry.ts`. Picks `API_KEY` from
  `process.env` as the canonical name (Vite defines both `API_KEY` and
  `GEMINI_API_KEY` from the same `.env` entry; harmless duplication).
  When OS-keyring storage lands (originally a Phase 3 deliverable that
  didn't ship; deferred to Phase 4 alongside sync credentials), only
  this file changes.
- New: `src/lib/diagnostic-helpers.ts` — pure (non-AI) helpers
  `diagnosticToStatus` and `specFromLegacyGoals` extracted from the
  retired `lib/ai-pipeline.tsx`.
- Deleted: `src/lib/ai-pipeline.tsx`. Its AI calls live in
  `gemini-provider.ts`; its pure helpers live in `diagnostic-helpers.ts`.

**Six consumers refactored.** `CoachModal`, `ContentSuggestionsModal`,
`PersonaSettingsModal`, `SpecGeneratorModal`, `App.tsx`, and the now-
deleted `ai-pipeline.tsx` all stopped instantiating `GoogleGenAI`
directly. Each call site shrank: a 30-line block of `apiKey` check +
client construction + inline prompt assembly + `generateContent` becomes
a single `aiProvider.someMethod({ ...inputs })` await.

**Doc cleanup bundled in.**

- `docs/refactor-plan.md` is new: the master plan committed to the repo
  verbatim. Authored in a web Claude session under a sandbox path that
  this Windows machine could never resolve; references from AGENTS.md,
  ARCHITECTURE.md, and this log now point at the in-repo location. The
  historical Phase 1h entry above still notes its original sandbox
  authorship.
- `README.md` rewritten: removed the AI Studio template (Gemini-key
  setup, ai.studio link), added the actual project description (Tauri 2
  desktop app, three recovery paths) and pointers to AGENTS.md /
  ARCHITECTURE.md / refactor-plan.md / this log.
- `docs/id-strategy.md` banner updated from "placeholder, Phase 1 will
  fill it in" to "Deferred. Phase 1 did not implement stable IDs.
  Revisit during Phase 5 polish or sooner if a rename/reorder bug
  surfaces." The sketch of the intended ULID approach is preserved.
- `AGENTS.md`: source-tree map gained the actual `services/` entries
  (`tauri-repository.ts`, `repository-registry.ts`, `ai-provider.ts`,
  `gemini-provider.ts`, `ai-provider-registry.ts`,
  `tauri-environment.ts`). Refactor-status section now points at
  `docs/refactor-plan.md`.
- `docs/ARCHITECTURE.md` line 3 reference updated to
  `[refactor-plan.md](refactor-plan.md)`.

### Phase 3.5 net effect

| Aspect | Before | After |
|---|---|---|
| `@google/genai` imports in `src/` | 6 (App.tsx + 4 modals + ai-pipeline.tsx) | 1 (gemini-provider.ts) |
| AI provider abstraction | missing | `AIProvider` interface + `GeminiProvider` impl + registry |
| `lib/ai-pipeline.tsx` | 405-line AI pipeline mixed with helpers | deleted; AI in services/, helpers in lib/diagnostic-helpers.ts |
| Master plan canonical location | dangling sandbox path | `docs/refactor-plan.md` in-repo |
| README | AI Studio template | Tauri-aware description + doc pointers |
| `docs/id-strategy.md` status | "placeholder, Phase 1 will do it" (false) | "Deferred to Phase 5" (true) |
| Tests | 18/18 | 18/18 (no regression) |
| AGENTS.md "Where to put X" — New AI flow row | aspirational | load-bearing |

### Verify Phase 3.5 end-state

JS side (verified):

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 18/18 passing.
- `npm run build` — succeeds.
- `Select-String -Path src\**\*.ts,src\**\*.tsx -Pattern '@google/genai' -SimpleMatch` — exactly one hit, in `gemini-provider.ts`.

Manual smoke (requires running app on user's machine):

1. Open Coach modal → request advice → response renders.
2. Open Content Suggestions on a section → suggestions render.
3. Open Persona Settings → "Auto-Generate" → new personas append to the list.
4. Open Spec Generator on a section → run → diff appears.
5. From treemap → run diagnostic on a section → result appears.
6. From sidebar / button → estimate dependencies → edges appear.
7. From the Interpolate Tasks modal → generate → tasks land on sections.

If any of the above fail with "API Key missing", the registry's lazy
client is doing its job — verify `.env.local` has `GEMINI_API_KEY` set.

### Rollback procedures

- Per-file: each consumer refactor (CoachModal, ContentSuggestionsModal,
  PersonaSettingsModal, SpecGeneratorModal, App.tsx) is independently
  revertable. `git checkout HEAD~ <file>` restores the inline
  `GoogleGenAI` instantiation while the rest of the refactor stands.
- Full revert: undo the closeout commit, then `git checkout HEAD~
  src/services/ai-provider*.ts src/services/gemini-provider.ts
  src/lib/diagnostic-helpers.ts` and `git checkout HEAD~~
  src/lib/ai-pipeline.tsx` to restore it. Doc-cleanup commits revert
  independently.

### What is explicitly NOT in Phase 3.5 (still outstanding)

- **App.tsx decomposition** — still 932 lines; target per master plan is
  ~150. Domain logic (import/export, AI orchestration, snapshot
  management) should be pulled into `useProjectActions` and slice
  actions. Separate effort.
- **300-line file-cap cleanup** — 13 other files exceed the cap
  (TestsPanel 606, Sidebar 424, EditorPanel 422, 7 modals, constants.ts,
  livePreview.ts, project-state.ts). Tackle opportunistically as their
  features get touched.
- **OS keyring secret storage** — originally a Phase 3 deliverable
  (`keyring` crate, per master plan). Did not ship. Currently the
  Gemini key flows through Vite env → `process.env.API_KEY` →
  registry. Address in Phase 4 alongside sync's git-credential needs.
- **Stable section IDs** — `docs/id-strategy.md` now correctly marked
  deferred (rather than misleading-as-pending). Implementation is a
  ~1-day chunk + a per-project migration; defer to Phase 5 unless a
  rename/reorder bug surfaces.
- **Streaming AI** — interface is shaped to accept Phase 5 streaming
  sibling methods (`streamCoachAdvice`, etc.) but no streaming method
  exists yet.

**Ready for Phase 4** — git sync. See
[`refactor-plan.md`](refactor-plan.md) Part IV "Phase 4 — Sync".

---

## 2026-05-11 — Phase 4 (git sync + OS keyring)

**Scope.** The dissertation now syncs to a private GitHub remote.
Every autosave commit auto-pushes; focusing the window auto-pulls. The
master plan's Phase 4 ("sync_pull/sync_push wired into chrome") plus
the Phase 3 keyring deliverable that didn't ship (now landed for both
git PAT *and* Gemini API key).

Seven sub-phases, each independently revertable, mirroring the Phase 3
cadence (3a–3k). Auth method: HTTPS + fine-grained PAT. SSH support
deferred to Phase 5.

### 4a — Keyring foundation (Rust + JS shared infra)

- `src-tauri/Cargo.toml`: added `keyring = "3"`.
- New `src-tauri/src/commands/credentials.rs`: `credentials_set`,
  `credentials_get` (returns Option), `credentials_delete`
  (idempotent). All three use `keyring::Entry::new("treemap-writer",
  &service)` so service names are namespaced.
- `src-tauri/src/error.rs`: `From<keyring::Error>`.
- `src-tauri/src/lib.rs`: registered the three commands.
- New `src/services/credentials.ts`: typed JS wrapper. In browser
  mode every call resolves to a no-op equivalent so callers don't
  need to branch on `isTauri()`.

Nothing in 4a calls these yet. The substrate lands first.

### 4b — Git remote operations in Rust

Split `src-tauri/src/git/mod.rs` into a folder with a sister module
`remote.rs` (180 lines, under cap). `mod.rs` keeps local-commit ops;
`remote.rs` handles everything network-facing.

Functions in `git::remote`:
- `configure_remote(repo, url)` — create-or-update the `origin` remote.
- `remote_url(repo) -> Option<String>` — read current origin URL.
- `pull(repo, token) -> PullOutcome` — fetch, fast-forward, refuse if
  dirty or divergent. Never destructive.
- `push(repo, token) -> PushOutcome` — push current branch (whatever
  HEAD points to; not hardcoded), report `NonFastForward` rather than
  erroring on divergence.
- `sync_state(repo) -> SyncState` — purely-local ahead/behind/dirty
  query, no network. Used by the UI indicator.

Auth: `Cred::userpass_plaintext("x-access-token", &token)` (GitHub's
HTTPS+PAT convention).

Hard guardrails (load-bearing for Phase 4):
- Never `reset --hard`, never force checkout. `MergeRequired` and
  `NonFastForward` outcome variants are RETURNED, not acted on.
- Refuses to pull if the working tree has tracked uncommitted edits
  (`WorkingTreeDirty` variant). Phase 3 autosave commits ~60s after
  edits, so this is rare in practice.
- Branch name read from HEAD; not hardcoded to "main".

`src-tauri/src/types.rs`: added `PullOutcome` / `PushOutcome` as
externally-tagged enums + `SyncState` struct.

### 4c — Sync Tauri commands + Repository extension + browser no-ops

The bridge between Rust git-remote and the JS Repository.

- New `src-tauri/src/commands/sync.rs`: `sync_state`, `sync_pull`,
  `sync_push`, `sync_configure_remote`. Each reads the PAT from
  keyring service "git"; `sync_configure_remote` also mirrors the URL
  into `.twriter/settings.json` as `gitRemoteUrl` so the user's
  intent travels with the project folder.
- `src/types/index.ts`: mirrored `PullOutcome` / `PushOutcome` /
  `SyncState` as discriminated unions (Rust `tag = "kind"` ↔ TS `kind`).
- `src/services/repository.ts`: extended interface with `syncState`,
  `syncPull`, `syncPush`, `configureRemote`.
- `TauriRepository`: thin `invoke()` wrappers.
- `BrowserRepository`: sentinel no-ops — `syncState` returns
  `{ hasRemote: false, ... }`; pull/push return `{ kind: 'noRemote' }`;
  `configureRemote` is a quiet no-op. Sync-policy can call these
  unconditionally without branching on `isTauri()`.

### 4d — SyncConfigModal (one-time setup UI)

One file: `src/features/modals/SyncConfigModal.tsx` (~170 lines).
Self-mounts via `showSyncConfigModal` flag. Two inputs (URL + PAT),
one "Test & Save" button. Flow:

1. `setSecret('git', token)` — stores PAT in OS keyring.
2. `repository.configureRemote(url)` — sets origin + writes
   settings.json.
3. `repository.syncPush()` — validates auth by attempting the first
   push.
4. Success → toast + dismiss. Failure → modal stays open with
   verbatim error; the user fixes the URL or token without re-typing.

Sidebar gets a GitBranch icon next to Backup as the entry point.
Modal copy steers users toward fine-grained PATs scoped to the
single dissertation repo.

### 4e — Sidebar sync indicator + sync-policy automation

The ambient automation that keeps the dot accurate.

`src/services/sync-policy.ts` (170 lines, under cap):
- `initSyncPolicy()` on project load: if `syncState.hasRemote` is
  false, sets `syncStatus='no-remote'` (dot stays hidden). Otherwise
  pulls once and subscribes to:
  - Store `revisions.length` increases → schedules a push debounced
    5s. Coalesces autosave commits into one push.
  - `document.visibilitychange` → pulls on focus, throttled to once
    per 60s.
- Outcome handlers: `MergeRequired` and `NonFastForward` flag the dot
  as `error` with a verbatim message; `WorkingTreeDirty` fails silent
  (autosave will commit soon and the next focus pull retries);
  `NoRemote` resets to `no-remote`.
- Transient error classifier (timeout / DNS / network unreachable /
  connection refused / temporary failure substrings) → silent recover
  to `idle`. Auth/config errors stay visible, then auto-clear after
  30s so the indicator doesn't pin red.
- `teardownSyncPolicy()` cancels timers + listeners; called from
  `App.tsx` `useEffect` cleanup when `activeProjectId` changes.

`src/state/ui-state.ts`: `syncStatus` + `syncError` + setters.

`src/features/sidebar/Sidebar.tsx`: 6px dot next to the existing
"autosaved" indicator. `hld-cyan` synced/in-flight (pulsing during
in-flight), `hld-magenta` on error, hidden when `no-remote`.
`title=` carries the verbatim error on hover.

### 4f — Gemini API key in OS keyring (env fallback retained)

Closes the keyring deliverable the master plan originally targeted
for Phase 3 (which didn't ship). Additive design — existing
`.env.local` users see zero behavior change.

`src/services/ai-provider-registry.ts`:
- Eager construction with `process.env.API_KEY` (sync registry).
- Background `await getSecret('gemini')` — if the keyring has a key,
  calls `setApiKey()` on the GeminiProvider, which invalidates the
  cached SDK client. Next AI call uses the keyring key.
- New `refreshGeminiKey()` helper for the UI to call after saving a
  new key, so the running session picks it up without restart.

`src/services/gemini-provider.ts`: adds `setApiKey()` method. Zero
changes to the `AIProvider` interface or to any of the 6 AI
consumers.

`src/features/modals/PersonaSettingsModal.tsx`: small "Gemini API
Key" section above the persona-generator banner. Password input + Save
button. Calls `setSecret('gemini', value)` and `refreshGeminiKey()`.

The `.env.local` path is NOT retired in 4. Removal waits until the
user has verified the keyring path works on their machine.

### 4g — Doc closeout

This entry. Plus:
- `AGENTS.md` "Where to put X" table gains rows for new keyring
  secrets, sync triggers, git remote operations (now split from
  local). Source-tree map gains `credentials.ts`, `sync-policy.ts`,
  the new Rust modules.
- `docs/ARCHITECTURE.md`: Phases table — Phase 4 ✅, Phase 5 ⏳.
  Command surface block gains the sync_* + credentials_* commands.
- `README.md`: new "Multi-machine sync" section with the 3-step
  GitHub setup walkthrough.

### Phase 4 net effect

| Aspect | Before | After |
|---|---|---|
| Multi-machine sync | impossible (no remote) | git pull/push to private GitHub |
| Auth | none | HTTPS + fine-grained PAT in OS keyring |
| Gemini API key | env-only (`.env.local`) | OS keyring with env fallback |
| Push cadence | manual `git push` from CLI | debounced 5s after each autosave commit |
| Pull cadence | manual `git pull` from CLI | on launch + on window focus (throttled 60s) |
| Conflict handling | undefined | detect + report; never destructive |
| Sidebar chrome | "autosaved" green dot only | + sync dot (cyan synced / magenta error / hidden no-remote) |
| Rust LOC in `src-tauri/` | ~1000 | ~1300 |
| Files > 300 lines | 14 (per Phase 3.5 audit) | 14 (no regressions) |
| Tests | 18/18 | 18/18 (no regression) |

### Verify Phase 4 end-state

JS side (verified on this machine):
- `npx tsc --noEmit` clean.
- `npx vitest run` — 18/18.
- `npm run build` — succeeds.

Rust side (requires user's machine):
- `cd src-tauri && cargo check`.
- `npm run tauri:dev` should launch with no errors.

End-to-end smoke (requires GitHub repo + PAT):
1. Create a private empty GitHub repo.
2. Generate a fine-grained PAT scoped to that repo (Contents: read/write).
3. Open a TreemapWriter2 project, click the GitBranch icon in the
   sidebar, paste URL + PAT, Test & Save.
4. Watch the sidebar header: cyan dot appears after the initial push.
5. Edit a section. Wait ~60s for autosave commit. Dot pulses cyan
   during the 5s push debounce, then settles cyan.
6. Second machine: `git clone <url>`, open folder in TreemapWriter2,
   Configure Sync.
7. Edit on machine A → push → focus machine B → pull on focus →
   content updates.
8. Conflict path: edit the same section on both machines, push from
   A, push from B — B's modal/dot shows `nonFastForward`. Resolve via
   `git pull` + manual merge in a CLI; subsequent push succeeds.
9. AI flow: clear `.env.local`'s API_KEY entry, set the key via
   PersonaSettingsModal, restart, run a diagnostic — should work
   from the keyring.

### Rollback procedures

Per sub-phase, in reverse order:
- 4g: doc revert is harmless.
- 4f: `git revert <commit>` restores the prior eager env-only key
  flow; in-flight users lose the keyring path but keep `.env.local`.
- 4e: revert removes the dot + automation; nothing in the
  pull/push surface changes. Manual sync via DevTools still works.
- 4d: revert removes the modal + sidebar entry; previously-configured
  remotes keep working via DevTools.
- 4c: **revert 4c, 4d, 4e together** — they form the working JS
  surface. Reverting only 4c leaves 4d/4e dangling.
- 4b: revert removes git remote ops; JS calls would error. Pair with
  4c reversion.
- 4a: revert removes keyring infra. Pair with 4f reversion.

Full Phase 4 revert: undo commits 4a through 4g in reverse. App
returns to Phase 3.5 state (local git only, no sync).

### Explicitly NOT in Phase 4 (Phase 5 polish or later)

- In-app conflict resolution UI — Phase 4 detects + reports; users
  resolve via their preferred git client.
- Multi-branch support — single branch (whatever HEAD points to;
  typically `main`).
- SSH key authentication — HTTPS+PAT only.
- Clone-from-remote UX inside the app — second machine setup uses
  `git clone` from CLI, then standard project-open flow.
- Removing the `.env` Gemini key path — env fallback stays during 4
  to avoid breaking existing setups. Full retirement is a Phase 5
  cleanup once keyring is verified working.
- App.tsx decomposition + the other 13 files >300 lines — still
  outstanding from the Phase 3.5 audit; opportunistic future work.

**Ready for Phase 5** — polish: streaming AI in a sidebar coach
panel, FTS5-backed full-text search, conflict resolution UI, and
(optionally) SSH auth. See [`refactor-plan.md`](refactor-plan.md)
Part IV "Phase 5 — Polish".

---

## 2026-06-11 — Phase 5 (partial): sync-indicator hardening

**Scope.** Not a full phase. Three targeted fixes to how the Phase 4 sync
loop behaves offline and on divergence, plus the Rust + tooling support
they needed. Auth is unchanged (HTTPS + PAT). Does **not** add in-app
conflict resolution — that remains the big Phase 5 sync item.

**What changed.**

1. **Persistent errors latch; transient ones stay silent.**
   [src/services/sync-policy.ts](../src/services/sync-policy.ts) dropped the
   30s `ERROR_CLEAR_MS` auto-clear. Divergence / auth / unknown failures
   now stay pinned in the sidebar (via `flagError`) until a later pull or
   push succeeds (`succeed()` lifts them). Offline/network failures call
   `settle()` — no scary dot, and they no longer mask a previously-latched
   error. The transient-signature list grew (`failed to connect`, `no such
   host`, `offline`, …) so being offline never latches red.
2. **"Synced" now only ever means synced.**
   [src/state/ui-state.ts](../src/state/ui-state.ts) gained `syncAhead` /
   `syncBehind` + `setSyncCounts`. sync-policy refreshes them after every
   pull/push and immediately on each local commit. The sidebar dot
   ([src/features/sidebar/Sidebar.tsx](../src/features/sidebar/Sidebar.tsx))
   shows **amber** (`hld-yellow`) when idle with unpushed/unpulled commits,
   tooltip `"N unpushed · M to pull"`. Precedence: error (magenta) >
   in-flight (cyan pulse) > pending (amber) > synced (cyan).
3. **Offline work flushes without a new edit.** `initSyncPolicy` now runs a
   `flush()` (pull → push) on launch instead of pull-only, and a
   `window 'online'` listener flushes on reconnect (removed in teardown).
   Closing offline and reopening online — with no further typing — now
   lands the queued commits.

Supporting changes:

- [src-tauri/src/git/remote.rs](../src-tauri/src/git/remote.rs) `push()`
  now advances the local remote-tracking ref (`refs/remotes/origin/<branch>`)
  to the just-pushed commit. libgit2's push does not reliably do this, which
  would otherwise leave `sync_state` reporting phantom "ahead" commits — and
  a stuck amber dot — until the next fetch. Idempotent if libgit2 already
  updated it.
- [tsconfig.json](../tsconfig.json) gained `"exclude": ["src-tauri",
  "dist", "node_modules"]`. With `allowJs: true` and no exclude, `tsc`
  swept `src-tauri/target/**/*.js` build artifacts once the Rust crate had
  been compiled, drowning `npm run typecheck` in thousands of bogus errors.

**What to verify.** `npm test` (18 pass), `npm run build`, `npm run
typecheck` (now clean — no `src-tauri/target` noise), and `cargo check
--manifest-path src-tauri/Cargo.toml`. Manual: with a remote configured,
make an edit offline (DevTools → Network offline) — dot goes amber
"unpushed"; reconnect — it flushes to cyan "synced". Force a divergence
(push from another clone) — dot latches magenta and does **not** clear
after 30s.

**Rollback.** All five files are independent of each other; revert any
subset. Reverting `sync-policy.ts` + `ui-state.ts` + `Sidebar.tsx` together
restores the Phase 4 indicator (status-only, 30s auto-clear). The
`remote.rs` and `tsconfig.json` changes are safe to keep in isolation.

---

## 2026-06-11 — Phase 5 (5C): in-app conflict resolution

**Scope.** The highest-value remaining sync item from
[phase-5.md](phase-5.md). `pull` used to return an empty conflict list on
divergence and tell the user to "resolve via your git client"; it now runs a
real in-memory 3-way merge, surfaces conflicts in a modal, and creates the
merge commit in-app. Auth unchanged (HTTPS + PAT). Shipped as ordered,
independently-revertable sub-steps (5C-0 … 5C-4).

**Core invariant.** Never destroy a local commit *and* never silently alter
prose. The merge runs entirely in memory (`merge_commits` → a detached
`Index`): nothing on disk or in refs changes until the user resolves and we
write the tree + commit + checkout. A cancelled resolution is a dropped index
— no `cleanup_state`, no half-merged repo.

**What changed.**

1. **5C-0 — line-ending policy (prerequisite).**
   [src-tauri/src/git/mod.rs](../src-tauri/src/git/mod.rs) `ensure_line_ending_policy`
   sets repo-local `core.autocrlf=false` + `core.eol=lf` and writes a
   project-local `.gitattributes` (`* text=auto eol=lf`) on every open. The
   app already writes pure-LF `project.md`; without this, a checkout on
   Windows rewrites the tree to CRLF, which reads as permanently "dirty"
   (wedging all future pulls) and makes the 3-way merge see LF-vs-CRLF — a
   whole-file conflict. The Rust tests prove the round-trip stays clean only
   with this in place.
2. **5C-1 — Rust merge engine.** New
   [src-tauri/src/git/merge.rs](../src-tauri/src/git/merge.rs): `detect` (called
   from `remote.rs`'s divergent branch) runs `merge_commits` for the correct
   recursive base, auto-finalizes a clean merge (`Merged`), or returns rich
   per-file `ConflictFile` data (`MergeRequired`) and pins the fetched commit
   under `refs/twriter/incoming`. `resolve` (new `sync_resolve_merge` command)
   re-runs the deterministic merge, applies the user's choices, and commits —
   guarded by a base-HEAD/dirty check that returns `Stale` if the repo moved.
   Conflict text comes from the `diffy` crate (git2 0.19 doesn't expose
   libgit2's merge-file). Strict UTF-8 / `is_binary` classification — content
   that might be committed is never lossily decoded. New wire types in
   [types.rs](../src-tauri/src/types.rs): `ConflictFile`, `Resolution`,
   `ResolveOutcome`, `PullOutcome::{Merged,UnrelatedHistories}`, reshaped
   `MergeRequired`.
3. **5C-2 — TS plumbing.** `PullOutcome`/`ResolveOutcome`/`ConflictFile`/
   `Resolution`/`PendingMerge` mirrored in
   [types/index.ts](../src/types/index.ts); `syncResolveMerge` added to the
   Repository interface + both impls;
   [ui-state.ts](../src/state/ui-state.ts) gained the `'conflict'` status,
   `pendingMerge`, and `showConflictModal`;
   [sync-policy.ts](../src/services/sync-policy.ts) latches `mergeRequired`
   into the modal, auto-finalizes `merged`, short-circuits pull/push while a
   conflict is pending, and on resolve reloads the document from disk (so the
   next autosave can't clobber the merge) before pushing. Autosave is
   suppressed during a pending merge in
   [project-state.ts](../src/state/project-state.ts) so a moving HEAD can't
   invalidate the open modal.
4. **5C-3 — resolution UI.** Pure, unit-tested marker parser
   [conflict-merge.ts](../src/features/modals/conflict-merge.ts) (strict
   line-anchored envelope rule — a lone `=======` Setext underline is never a
   separator); `ConflictResolutionModal` + `ConflictFileView` offer per-hunk
   LOCAL/REMOTE, whole-file pick, and manual edit, with binary and
   modify/delete handled distinctly (deleting requires an explicit choice).
   The sidebar `'conflict'` dot is clickable to reopen the modal after cancel.
5. **5C-4 — tests.** `conflict-merge.test.ts` (9 cases incl. the Setext
   non-misparse and CRLF stripping); Rust tests in `merge.rs` cover marker
   detection, clean vs conflicting `diffy` merges, a full detect→resolve
   round-trip asserting a clean working tree (the CRLF regression guard), the
   `Stale` guard, and clean auto-merge. Added `tempfile` dev-dependency.

**What to verify.** `npm test` (27 pass), `npm run typecheck`, `npm run
build`, `cargo test --manifest-path src-tauri/Cargo.toml` (4 merge tests
pass). Manual (desktop): clone the project elsewhere, edit the same lines of
`project.md` in the app and the clone, push from the clone, then pull in the
app — the modal opens; resolve and confirm a 2-parent merge commit, exact
chosen content, a **clean** working tree, and an auto-push. Edit *different*
lines for the `Merged` (no-modal) path.

**Rollback.** Sub-steps are independent. Reverting `merge.rs` +
`commands/sync.rs` + the `lib.rs` registration + the `types.rs` additions
restores the empty-conflict-list behavior; the TS/UI files then fall back to
the latched-error indicator. 5C-0 (line-ending policy) is safe to keep in
isolation and is recommended even if the rest is reverted.

**Current state.** Storage: disk + SQLite + git + remote GitHub. Sync:
pull/push automated, divergence now *resolvable* in-app. Conflict resolution
no longer requires an external git client.

---

## 2026-06-13 — Feature: Analysis + Dialogue tabs in the right panel

**What changed.** The right panel (`TestsPanel`) became a 3-tab surface —
**Spec | Analysis | Dialogue** — porting ScribesGambit's structured analysis
and Socratic dialogue/refactor loop per-section. The Spec tab is the original
spec/diagnostic UI, moved verbatim; nothing about specs, diagnostics,
dependencies, or personas changed.

1. **Types.** `SectionAnalysis` (thesis / key concepts / argument
   reconstruction with premises + implicit premises + conclusion / support /
   objections), `AnalysisVersion` (versioned, newest-first, with `inputHash`
   for the staleness badge and `sourceDialogue` provenance on refactors),
   `DialogueMessage`, `SectionAnalysisState` — all in
   [types/index.ts](../src/types/index.ts). `TestSuiteEntry` gained
   `analysis?: SectionAnalysisState` (the per-section AI data container);
   `PromptsConfig` gained `analysisPrompt`, `refactorAnalysisPrompt`,
   `dialoguePrompt`.
2. **Prompts.** Three new `.md` files in
   [services/prompts/](../src/services/prompts/), registered in
   `DEFAULT_PROMPTS_CONFIG` and editable in `PromptsGraphModal` (new
   "Exegesis & Dialogue" pillar). The analysis prompt deliberately softens
   premise-count rigidity: "use exactly as many premises as the argument
   actually warrants — do not pad, merge, or force a count."
3. **Provider.** `analyzeSection`, `refactorAnalysis`, and
   `continueDialogue(input): AsyncIterable<string>` on `AIProvider` —
   the first realized streaming method (the Phase-5 shape). Dialogue is
   stateless: full message history travels per turn; no SDK objects cross
   the boundary. Tolerant response normalization lives in
   [lib/analysis-helpers.ts](../src/lib/analysis-helpers.ts) (pure,
   unit-tested) alongside the testSuite updaters and prompt assembly.
4. **State.** `testsPanelTab` in ui-state (ephemeral); five document-state
   actions (`addAnalysisVersion`, `setActiveAnalysisVersion`, `setDialogue`,
   `startDialogue`, `clearDialogue`). `addAnalysisVersion` does NOT clear
   the dialogue — only the refactor flow clears it, explicitly, so a plain
   re-analyze never destroys an in-progress conversation. No pre-ai-write
   snapshot: versions only accumulate.
5. **UI.** `TestsPanel` is now a shell (header + tab strip + resize);
   the original content moved to `SpecTab` + `SpecDiagnostics` +
   `SpecDependencies` (verbatim; gets each file under the 300-line cap).
   New `AnalysisTab` (version selector, EDITED SINCE badge, five cards with
   per-card interrogate glyphs, collapsible source dialogue, ANALYZE /
   RE-ANALYZE) and `DialogueTab` (focus banner, streaming transcript,
   CONCLUDE & REFACTOR, quiet CLEAR). Orchestration in
   `use-analysis-actions.ts` (feature-colocated hook; not App.tsx).
   Interrogate glyphs jump to the Dialogue tab seeded with that context;
   a magenta diamond on the Dialogue tab marks an active dialogue.
6. **Persistence.** Rust mirrors in
   [src-tauri/src/types.rs](../src-tauri/src/types.rs): `analysis:
   Option<serde_json::Value>` on `TestSuiteEntry` AND `PersistedTestEntry`
   (schema-agnostic, like `last_diagnostic`), so analyses + dialogues ride
   the per-section YAML sidecar into git history and snapshots. Browser
   mode rides `StoredProjectData` wholesale (no change needed).
   `PromptsConfig` (Rust) gained the three fields with `#[serde(default)]`
   so pre-feature `prompts.json` files still load. Three promptsConfig
   call sites now merge over `DEFAULT_PROMPTS_CONFIG` (demo-project load,
   `restoreSnapshot`, VersionHistoryModal `onRestore`) so restoring old
   snapshots can't blank the new prompts; the provider also falls back
   per-prompt.

**What to verify.** `npm test` (48 pass), `npm run typecheck`,
`npm run lint` (0 errors), `npm run build`, `cargo check`. Manual: select a
section → Spec tab identical to before → Analysis → ANALYZE → cards render;
edit the section → EDITED SINCE appears; interrogate the thesis → Dialogue
tab with FOCUS banner; send a message → streamed reply; CONCLUDE & REFACTOR →
back on Analysis with "refactor 1" active, source dialogue collapsible,
selector switches versions; reload → everything persists. Desktop: confirm
the `analysis:` block in `.twriter/specs/<id>.spec.yaml` and that a
pre-feature project (old prompts.json) still opens.

**Rollback.** Revert the commit. Data written by the feature is additive
(`analysis:` keys in spec YAML / IndexedDB blobs); old builds ignore unknown
YAML fields on read (`PersistedTestEntry` is loose-by-construction), so no
data migration is needed in either direction.

**Current state.** The right panel hosts three surfaces. Spec & diagnostic
capabilities are untouched underneath. Analysis/dialogue are per-section,
versioned, persisted, and snapshot-restorable.

---

## 2026-06-13 — Fix: code-review findings on the Analysis + Dialogue tabs

**What changed.** A `/code-review` pass over the feature above surfaced 15
findings; all are addressed. No behavior of the feature's happy path changed —
these harden concurrency, error reporting, and persistence edges.

1. **Concurrency (the headline).** Analyze/refactor (gated by global
   `isProcessing`) and a dialogue send (gated by the module-level `inFlight`
   set) were not mutually exclusive, so a send fired during an in-flight
   refactor could let the stream's `onCommit` resurrect the transcript the
   refactor had just cleared. Every entry point in
   [use-analysis-actions.ts](../src/features/tests-panel/use-analysis-actions.ts)
   now bails on *either* lock (`runAnalysis`/`sendDialogueMessage`/
   `concludeAndRefactor` check `isProcessing || inFlight.has(id)`), the
   composer's `canSend` is `!isStreaming && !isProcessing`, and `interrogate`
   (which now clears on focus change — see #3) no-ops to the live dialogue
   when a turn is mid-stream rather than racing it.
2. **Save-error UX.** `await saveCurrentState()` moved out of the success
   `try` in analyze/refactor: a post-success disk-write failure now reports
   "saved in memory, but writing to disk failed" instead of the misleading
   "Analysis/Refactor failed" (the version was already committed). Fire-and-
   forget saves got `.catch(() => {})` so a disk failure can't become an
   unhandled rejection.
3. **Interrogate coherence + persistence.** Re-interrogating a *different*
   focus now starts a fresh transcript (so the FOCUS banner matches the
   conversation; same-focus re-clicks still continue), and the seed is
   persisted so it survives a reload before the first send.
4. **Stability/altitude.** `useAnalysisActions` reads
   `testSuite`/`promptsConfig`/`isProcessing` via `getState()` at call time
   instead of subscribing, so the callbacks stop churning on every streamed
   commit. `normalizePromptsConfig` (in
   [services/prompts/index.ts](../src/services/prompts/index.ts)) centralizes
   the `{...DEFAULT, ...raw}` merge at all hydration sites (demo load,
   `loadProject`, `restoreSnapshot`, VersionHistoryModal `onRestore`), letting
   the Gemini provider drop its per-prompt `|| DEFAULT` fallbacks (matching
   every other provider method). `analyzeSection`/`refactorAnalysis` share a
   `generateAnalysis` helper. `continueDialogue` caps the injected analysis
   JSON and windows the resent history (trimming any leading non-`user` turn
   the window would expose). `AnalysisTab`'s content hash is memoized;
   `EditorPanel` drops its duplicate `findSectionById` for the shared
   `useCurrentSection`.
5. **UI correctness.** `PromptsGraphModal`'s connector SVG was rebuilt for the
   3→4-pillar grid (the lines were stranded at the old 3-column centers and
   the new pillar had none). The persona/Evaluator banner — dropped from the
   no-section view when the panel became tabbed — is restored via an extracted
   `PersonaBanner` shown on the Spec tab. Version ids gain a per-session
   counter (`av_<ts>_<seq>`) so same-millisecond versions can't collide; the
   dialogue Enter handler guards `isComposing` (IME); the composer is keyed per
   section so a draft doesn't leak across selections.

**What to verify.** `npm run typecheck`, `npm test` (48 pass),
`npm run build` — all green. `npm run lint` is clean for every touched file (5
pre-existing errors remain in `livePreview.ts`/`SpecGeneratorModal.tsx`, which
this change does not touch). Manual: refactor while typing a new turn → the
cleared dialogue stays cleared; reopen the Prompts graph → four wired pillars;
deselect all sections → the Evaluator banner still shows on the Spec tab.

**Verification note.** An adversarial review pass caught that the #3 change had
itself opened a new unguarded `clearDialogue` path in `interrogate`; that hole
is closed by the `inFlight` no-op above.

**Known, out of scope.** During a stream, switching off the Dialogue tab and
back drops the live-bubble indicator (the streaming state is component-local) —
the `inFlight` guard still blocks a second send, so it's a cosmetic gap, not a
regression. Clearing a prompt to an empty string in the editor sends it empty
(consistent with every pre-existing prompt field).

**Rollback.** Revert the commit; all changes are code-only (no data shape or
migration).

## 2026-06-13 — Feature: multi-provider model selection (Gemini + Anthropic + Ollama)

**Why.** Model/provider selection was ad-hoc and Gemini-only: four duplicated
`MODELS` arrays across modals, several call kinds with no selector (silent
provider defaults), obsolescing hardcoded ids, and a broken `.env.local` key
fallback on Tauri. Goal: a thoughtful, provider-agnostic system where each of
the ten AI call kinds is configurable, saved with the project, and extensible.

**What changed.**

1. **Two-layer AI architecture** under `src/services/ai/`. A low-level
   transport interface `LLMClient` (`clients/llm-client.ts`) with one client per
   provider — `GeminiClient` (`@google/genai`), `AnthropicClient`
   (`@anthropic-ai/sdk`, new dep, `dangerouslyAllowBrowser`), `OllamaClient`
   (`fetch`) — each the SOLE importer of its own SDK. Above it, one
   provider-agnostic `MultiProviderAIProvider` (`ai-provider.impl.ts` +
   `ai-provider.specs.ts`) holds ALL prompt-building/parsing (ported verbatim
   from the deleted `gemini-provider.ts`) and dispatches per call kind. The
   `AIProvider` interface is unchanged for consumers.
2. **Model config types** (`model-types.ts`, `model-catalog.ts`,
   `model-config.ts`, `resolve-model-choice.ts`): `ProviderId`, `AICallKind`
   (the 10 kinds), `ModelChoice`, `ModelConfig`. `DEFAULT_MODEL_CONFIG`
   reproduces the exact pre-refactor ids+budgets, so an un-configured project
   behaves identically. `normalizeModelConfig` is a sparse pass-through (unlike
   `normalizePromptsConfig`) so per-project files stay minimal and the global
   default can seed unset kinds. Resolution: per-project per-kind → global
   per-kind default → built-in default.
3. **Persistence.** New per-project `modelConfig` in the `ai-state` slice,
   `StoredProjectData.modelsConfig`, saved/loaded in `project-state.ts`
   (`normalizeModelConfig` on load; excluded from snapshots — model choices are
   infra, not document content). Tauri round-trips it through
   `.twriter/models.json` (`types.rs` `models_config`, `layout.rs`
   `models_json()`, `document.rs` read/write). Global prefs (default config,
   editable catalog, Ollama base URL) live in `preferences.ts` (idb-keyval),
   hydrated at boot via `hydrateAIPreferences`; the registry's config source is
   wired to live state in `state/index.ts` (services never import the store →
   no cycle).
4. **UI.** `PersonaSettingsModal` retitled "AI & Personas" and now hosts
   `AiSettingsSection` (provider keys incl. Anthropic, Ollama endpoint + detect,
   the single "default model" knob, and a collapsed Advanced area with per-call
   overrides + an editable catalog). New shared `ModelPicker` replaces the four
   duplicated `MODELS` arrays in Interpolation/TestRunner/Coach/ContentSuggestions
   modals; the Gemini-specific token-estimate/thinking UI is gated behind
   `choice.provider === 'gemini'`.
5. **Key fallback fix.** Root cause: `.env.local` sat in `src-tauri/` but Vite
   read the project root, and the file used a non-standard quoted-key format.
   Fixed: `vite.config.ts` now `loadEnv(mode, 'src-tauri', '')` + an
   `ANTHROPIC_API_KEY` define; `.env.local` normalized to standard dotenv;
   desktop adds a runtime Rust fallback — `credentials_get` returns the process
   env var on keyring `NoEntry`, and `lib.rs::load_env_local` loads
   `src-tauri/.env.local` at startup (hand-rolled, no new crate; never overrides
   a real env var). Keeps the secret out of the JS bundle on desktop; the
   keyring remains the durable path.

**New dependencies.** `@anthropic-ai/sdk` (sanctioned by the user). No new Rust
crate (the dotenv parse is hand-rolled).

**What to verify.** `npm run typecheck`, `npm test` (68 pass — 20 new across
`services/ai/`), `npm run build`, and `cargo check` (`src-tauri`) — all green.
`npm run lint` is clean for every touched file (the 5 pre-existing errors in
untouched modal files remain). Manual E2E: (1) with only `src-tauri/.env.local`
set and no keyring entry, run an AI flow → no key re-entry (Gemini + Anthropic).
(2) AI & Personas → Advanced → set Analyze to `claude-opus-4-8`, run analysis +
dialogue. (3) Ollama running + `OLLAMA_ORIGINS` set → Detect populates the
catalog → set a kind to a local model → it streams. (4) Set a per-project
override, reload + reopen → persists (inspect `.twriter/models.json` on desktop,
IndexedDB on browser). (5) Open a pre-existing project (no models.json) →
behavior unchanged. (6) Restore an old snapshot → model config unchanged.

**Known / out of scope.** Anthropic adaptive thinking is enabled only for the
known Opus 4.x / Sonnet 4.6 ids and only for non-streaming calls (omitted on the
dialogue stream to keep the first token snappy); the numeric Gemini thinking
budget is never forwarded to Anthropic (it 400s on Opus). Ollama from the Tauri
webview may need `OLLAMA_ORIGINS` set (surfaced as a hint in the settings UI).
The secret in `src-tauri/.env.local` is gitignored (`*.local`) and was never
committed; rotation is optional.

**Rollback.** Revert the commit and run `npm install` (drops `@anthropic-ai/sdk`).
Per-project `modelConfig` / `.twriter/models.json` is additive and tolerated on
read by older code (sparse, ignored if unknown), so reverting loses the feature
but no document data.

## 2026-06-13 — Fix: code-review findings on multi-provider model selection

An adversarial code-review pass (9 finder angles) surfaced four confirmed
correctness/UI bugs in the multi-provider change above; all fixed here.

1. **Configured model ignored for Coach & Content Suggestions.** Flow modals are
   mounted unconditionally (they self-gate via `return null`), so a bare
   `useState(() => resolveModelChoice(...))` initializer froze the choice at app
   boot — before prefs hydrate or a project loads. Interpolation/TestRunner had a
   reseed `useEffect([isOpen])`; Coach/ContentSuggestions did not, so they
   permanently ran the boot-time default and ignored the user's configured model.
   Fixed at the right altitude: a shared `useModelChoice(kind, isOpen)` hook
   ([src/features/modals/use-model-choice.ts](../src/features/modals/use-model-choice.ts))
   now backs all four modals (re-seeds on open), removing the 4× duplication that
   caused the divergence.
2. **ModelPicker display desync.** A controlled `<select>` whose value isn't in
   the catalog (Ollama offline, model removed, hand-edited config) showed the
   wrong row while state held the real choice. The picker now renders a
   `"<provider>: <model> (unavailable)"` fallback option so the visible selection
   always matches the actual choice.
3. **Catalog `supportsThinking` vs adaptive-thinking mismatch.** The field means
   "exposes a numeric budget knob," which no Anthropic model does (adaptive/
   native), yet all three were marked `true` — contradicting the client's
   `supportsAdaptiveThinking`. Set Anthropic rows to `false` so the two concepts
   stop conflicting.
4. **Anthropic default `max_tokens`.** Bumped the (currently-unreached) default
   from 8192 → 16000 so a future caller that omits `maxTokens` can't have the
   adaptive-thinking pass (counted inside `max_tokens`) truncate the JSON body.

**Deferred (noted, not fixed).** The single "Default Model" knob flattens
per-kind thinking budgets across all 10 kinds — a known tradeoff of a deliberately
coarse knob (per-kind nuance survives via Advanced overrides or by leaving the
knob on "Recommended"). Lower-severity items: registry boot keyring lookup can
race a user key-save (narrow window; pre-existing pattern); Ollama fetches lack a
timeout; auto-detected Ollama rows persist to prefs. The `thinkingBudget` field
on the provider-agnostic `LLMRequest` is a deliberate pragmatic leak.

**What to verify.** `npm run typecheck`, `npm test` (68 pass), `npm run build`,
`cargo check` — all green. Manual: set a global default model, open Coach /
Content Suggestions → they now use it (previously stuck on the boot default).

**Rollback.** Revert this commit; the feature commit above stands on its own.

---

## 2026-06-13 — Design overhaul: Columns & Modals (HLD affordance grammar)

**Scope.** A visual + IA overhaul of the left sidebar, the right Spec/Analysis/
Dialogue panel, and the three worst-offender modals, implementing a Claude
Design handoff. One **affordance grammar** applied everywhere: `.hld-lit` marks
the single next action per surface; a diamond `Pip` is the one state vocabulary;
hairlines (not boxes) delimit zones; a 2px left edge marks editable text; words
appear on demand. No domain types, repository, AIProvider, sync-policy, or Rust
were touched. No new persisted state. Eight independently-revertable commits
(`ff52ae3`…`f3ed75b`) on branch `design/columns-modals-overhaul`.

**What changed.**
1. **Grammar primitives** (`src/index.css` `@layer components`): `.hld-lit` /
   `.hld-lit-magenta` and `.hld-pip*`. New `src/features/shared/` holds the
   cross-feature presentational primitives `Pip`, `Zone`, `Disclosure`,
   `CopyButton`.
2. **Shared modal kit** (`src/features/modals/`): presentational `ModalShell`
   (square, top accent line, ESC/ENTER, self-mount-friendly) + `SegControl`
   (the DEPTH/SCOPE instrument) + `depth-choice.ts`.
3. **Three modals rebuilt** on the kit — Generate Specs (3-stop DEPTH +
   prompts disclosure), Run Diagnostic (SCOPE + 2-stop DEPTH, persona chip),
   Projects (section-list rows). Their store/prop contracts are unchanged.
4. **Sidebar → variant B**: new `ProjectMenu` (◇ menu, absorbs & **replaces
   FileMenu**), `Dock` (lit CONTINUE + sprints + tools strip + caption line),
   `SectionRow`, `sync-status.ts`. `App.tsx` gains one `onContinue` prop.
5. **Spec tab merge + split**: `PanelHeader`, `MoveList` (verdicts inline — the
   separate "Move-by-Move Breakdown" is gone), `DependencyChips`, `PanelFooter`,
   `EmptyState`, `diagnostic-config.ts`. `SpecDiagnostics.tsx` +
   `SpecDependencies.tsx` dissolved.
6. **Analysis declutter + Dialogue tidy**: thesis spine + argument ladder +
   collapsed reading index + one "⊕ ask"; Dialogue gets the left-edge grammar +
   lit "Conclude → new version".

**Multi-provider reconciliation (the one behavior change).** The DEPTH control
maps to a model *tier* within the user's configured provider (Gemini/Anthropic/
Ollama), via `resolveDepthChoice` — it does NOT hardcode Gemini ids. The
selected stop reflects the configured model's tier; the fine-print shows the
resolved model name. Deep turns on thinking only where a numeric budget exists.
Covered by `src/features/modals/__tests__/depth-choice.test.ts` (7 tests).

**What to verify.** `npm run typecheck` (clean), `npm test` (75 pass), `npm run
lint` (no new problems; net 199→182), `npm run build` (ok). Manual smoke
(`npm run dev`): sidebar ◇ menu + CONTINUE + caption line + composite pip; Spec
tab NEXT/moves/deps/empty; Analysis ladder + one-at-a-time disclosures + ⊕ ask;
Dialogue conclude; each modal's DEPTH fine-print tracks the active provider (set
it in AI settings and re-check). Acceptance: exactly one `.hld-lit*` per surface;
glyph buttons carry `aria-label`; no `rounded-*` in the three modals;
`Sidebar.tsx` (361→127) and the Spec-tab files all < 300 lines.

**Rollback.** Each slice reverts independently (`git revert <sha>`); revert in
reverse order for a clean tree. Reverting the whole branch restores the prior UI
with no data implications (no schema/state changes).

**Deferred / out of scope.** Other modals (Coach, SectionMap, DependencyGraph,
PersonaSettings, Sprint, ProjectFile, PromptsGraph) still use their old frames —
migrate to `ModalShell` in a later batch. Treemap status legend still
owner-deferred. Section rows kept their square status marker (not the diamond
pip) per the handoff's "rows unchanged" note. Pre-existing lint (5 errors / ~177
warnings, incl. `DialogueTab` complexity, `use-analysis-actions` length) was
left untouched.

---

## 2026-06-15 — Living Sprints

**What changed.** Evolved the Goal/Content sprints (`BaseSprintModal.tsx`) into **Living
Sprints**: a sprint now targets ONE section (the active selection) and runs a generated,
ordered sequence of timed *moves* — opening with a context-**reinstatement** move, enforcing
**strict auto-advance**, seeded by **argument shapes**, and finalized by an optional AI
**brief**. Implements all four design directions (Reinstate / Runner / Shapes / Brief) plus
optional ambient hue + audio cues, per `docs/living-sprints-plan.md` and the
`design_handoff_living_sprints/` bundle.

- **Types** (`src/types/index.ts`): added `SprintMoveRole`, `SprintMove`, `SprintPlan`,
  `ArgumentShape`, and one `PromptsConfig` field `generateSprintPlanPrompt`. **No persisted field
  added** — plans are ephemeral run-state; the prose is saved continuously through the existing
  `onSaveContent`/`onSaveGoal` path; shapes are code; the cue toggle is a global pref.
- **Pure logic** (`src/lib/`): `argumentShapes.ts` (5 read-only shapes), `sprintPlan.ts`
  (weight→seconds scaling that sums to the total exactly, plan-from-shape, re-normalize, last
  sentence, clock fmt), `sprintRoles.ts` (role→hue), `reinstate.ts` (in-memory reinstatement +
  git/FTS seam), `ding.ts` (WebAudio). Tests: `argumentShapes`, `sprintPlan`, `sprintRoles`,
  and `sprint/__tests__/use-sprint-engine` (the save-before-advance invariant). +23 tests
  (162 total).
- **UI** (`src/features/modals/sprint/`): `SprintModal` (orchestrator, replaces `BaseSprintModal`,
  same export/props + `promptsConfig`), `SprintSetup`, `ShapeCard`, `SprintBrief`, `SprintRunner`,
  `SprintSequenceRail`, `ReinstatePanel`, `SprintEditor`, `use-sprint-engine`, `use-sprint-cues`.
  All files < 300 lines. Old `BaseSprintModal.tsx` deleted; `App.tsx` import swapped + threads
  `promptsConfig`.
- **AI flow** (Direction A): prompt `services/prompts/generate-sprint-plan.md`;
  `AIProvider.generateSprintPlan` + `GenerateSprintPlanInput`/`SprintBacklog`; impl delegates to
  `services/ai/ai-provider.sprint.ts` (structured output → validate → renormalize); new
  `AICallKind 'generateSprintPlan'` + `DEFAULT_MODEL_CONFIG` (flash). Graceful fallback to the
  shape default on error/no key.
- **Cues** (Direction D, sensory): `preferences.ts` `getSprintCuesEnabled/setSprintCuesEnabled`
  (off by default); `.sprint-ambient` cross-fade + transition flash gated by
  `prefers-reduced-motion`.

**Behavior change (intentional).** Sprints no longer march all sections; they work one section
deeply via moves (handoff §11.1). Reinstate/runner/brief machinery is shared; Goal stays
goal-shaped (reinstate → define-the-claim), Content stays draft-shaped (reinstate → shape moves).

**What to verify.** `npm run typecheck` (clean), `npm test` (162 pass), `npm run lint` (no new
errors — pre-existing 5 errors untouched; new files < 300 lines), `npm run build` (ok). Manual
(`npm run dev`): Dock `»` → Reinstate card → pick a shape (or Generate brief) → runner
countdown/checklist/sequence-rail; let the clock hit zero (text saved + advance, no confirm); +2m
works; finish closes. Toggle cues → subtle per-move hue + ding; with reduced-motion the hue
cross-fade is disabled. AI Brief without `GEMINI_API_KEY` degrades to the shape default.

**Rollback.** Pure code; no schema/state changes. `git revert` the branch restores the prior
sprint modal with no data implications.

**Deferred / out of scope.** Multi-section/chapter sprints; persisting in-flight plans; a custom
shape editor; drag-reorder/retime of the generated plan in the Brief (rows are read-only previews
in v1; re-plan = regenerate); git/FTS fragment retrieval (seam only). Pre-existing lint
(5 errors / ~197 warnings in unrelated files) left untouched.

## Hotfix — git sync HTTPS transport (2026-06-16)

**The bug.** Phase 4 git sync (push/pull to a private GitHub remote) was never actually
functional against a real remote. `src-tauri/Cargo.toml` declared
`git2 = { ..., default-features = false, features = ["vendored-libgit2"] }`. Turning off
default features dropped git2's `https` feature, so libgit2 was compiled **without an HTTPS
transport**. Every `https://github.com/...` fetch/push failed at transport lookup
("unsupported URL protocol") *before* the (correct) PAT credential callback in
`git/remote.rs` ever ran. This stayed hidden because every prior test and the Phase 5C
conflict work used local/`file://`/`tempfile` remotes, which use libgit2's *local*
transport and need no `https` feature.

**The fix.** Add `https` to the git2 feature list in `src-tauri/Cargo.toml`. On Windows this
builds libgit2 against WinHTTP; on macOS, SecureTransport — neither needs OpenSSL. (Linux note:
`https` there pulls in system OpenSSL; if `.deb`/`.AppImage` bundles are ever produced, add a
`[target.'cfg(target_os = "linux")'.dependencies]` git2 entry with `vendored-openssl` to keep
the build self-contained.)

**Second bug, found by the new regression test.** `git/remote.rs::pull()` fast-forward path
moved the branch ref to the fetched commit and *then* ran a `.safe()` checkout — which left the
working tree on the old content, so a fast-forward pull advanced the ref but never wrote the
pulled changes to `project.md`. Switched to `.force()` (the tree is already verified clean by
the `WorkingTreeDirty` guard at the top of `pull()`), matching `merge::finalize`.

**Tests.** New `git::remote::tests` (4): `https_transport_is_compiled_in` probes an https
`.invalid` host (RFC 6761, offline) and fails iff the transport is missing — the guard for the
Cargo regression; `configure_push_pull_roundtrip` drives a local bare repo through configure →
push → second-clone push → fast-forward pull and asserts the content lands on disk;
`outcomes_report_no_remote_before_configure`; `pull_refuses_dirty_working_tree`. 8 Rust tests
total. **Caveat:** local-transport fixtures cannot detect the `https`-feature regression — that
is solely what `https_transport_is_compiled_in` guards.

**What to verify.** `cd src-tauri && cargo test` (8 pass), `npm test` (166 pass),
`npm run typecheck` (clean), `npm run build` (ok). The only thing local fixtures can't prove is
a real TLS handshake: confirm with one Configure Sync → push against a throwaway private GitHub
repo + fine-grained PAT.

**Rollback.** Revert the `Cargo.toml` line and the `remote.rs` changes. Note reverting the
Cargo line reintroduces the silent no-HTTPS failure.

## Remote-aware project entry — Clone + Create-and-publish (2026-06-17)

**Why.** Sync could only be *attached* to an already-open local project via `SyncConfigModal`
(push-first, so it rejects any non-empty remote), and there was no in-app way to **load** a
project from a remote — the README told second-machine users to `git clone` from the CLI. This
adds the two missing remote-aware project entry points: **Create + publish** (new local project →
empty remote) and **Clone** (load an existing project from a remote, pulling from the start).

**Backend.**
- `git::remote::clone(url, into, token)` (`src-tauri/src/git/remote.rs`) — authenticated clone via
  `git2::build::RepoBuilder` + the same `Cred::userpass_plaintext("x-access-token", token)`
  callback as `pull`/`push`. After checkout it re-applies `ensure_line_ending_policy` and
  force-checks-out HEAD (guarded on unborn HEAD) to normalize a fresh clone to LF — the Windows
  CRLF "permanently dirty" guard, here for clones.
- `project_clone(state, url, path)` (`commands/project.rs`) — `validate_create_target` → `clone`
  (removes the folder on any clone error) → if `!looks_like_project` remove the folder and reject
  with a message routing to Create + publish → otherwise the shared `open_and_register` tail
  (extracted from `project_open`: `state.open_at` + `upsert_recent_project` + `ProjectMeta`).
  Registered in `lib.rs`. `read_git_token` in `commands/sync.rs` is now `pub(crate)` so the clone
  command reuses it (the PAT is global/keyring — available with no project open).

**Frontend.**
- `Repository.cloneProject(url, path)` (`repository.ts`) → `invoke('project_clone')` in
  `tauri-repository.ts`; browser impl throws (desktop-only).
- `project-state.ts`: thunks `cloneRemoteProject` and `createProjectWithRemote` (the latter composes
  the existing `createProjectAt` + `configureRemote` + `syncPush`). Both resolve `true` on success,
  `false` if the folder picker was cancelled, and throw on failure for the modal to surface. New
  `pickFolder` helper. `createProjectWithRemote` throws "use Clone" on a `nonFastForward` push.
- `RemoteProjectModal.tsx` — one modal, `SegControl` [Clone | Create]; mirrors `SyncConfigModal`'s
  frame/fields (not `ModalShell`, matching its sibling). Opened from `ProjectMenu` → "New from
  remote…" (desktop-only item); rendered unconditionally in `App.tsx`. New `showRemoteProjectModal`
  flag in `ui-state.ts`.

**Edge cases (all routed, non-destructive).** Empty remote or non-TreemapWriter repo → Clone
rejects + removes the folder + suggests Create; Create + publish to a non-empty remote → push
`nonFastForward` → modal says "use Clone" (the local project is still created/loaded — it degrades
to the existing attach-remote state). `SyncConfigModal` is unchanged (third case: attach a remote
to the project already open).

**Tests.** Two new `git::remote::tests`: `clone_seeded_project_opens_and_validates` (clone a local
bare repo seeded with `project.md` + `.twriter/` → content lands + `looks_like_project`) and
`clone_empty_remote_is_not_a_project` (empty remote → rejected). 10 Rust tests total. Local
transport needs no PAT, so these run offline.

**What to verify.** `cd src-tauri && cargo test` (10 pass), `npm test` (166), `npm run typecheck`
(clean), `npm run build` (ok). Manual (desktop): Create + publish to an empty private GitHub repo,
then Clone it into a second folder and confirm the document comes down and opens.

**Rollback.** Revert the listed files. `project_clone`/`cloneProject` are additive; removing the
`project-state` thunks + `RemoteProjectModal` + the `ProjectMenu` item restores the prior entry
flow. `SyncConfigModal` was untouched.

---

## 2026-06-15 — Documentation reconciliation (docs-only)

**Why.** The doc set had drifted: it mixed timeless principles, current-state
inventories (file trees, counts), and history in the same files, so any stale
fact — 5-vs-6 slices, "14 modals", Gemini-only AI, `chapters/*.md`,
`section_save`/`search`, "300-line cap enforced" — undermined the whole document.
An 18-agent excavation produced a contradiction matrix; this change reconciles it.

**What changed (no application code touched).**

- **Role-separated the living docs** so each has one job and one change-trigger:
  [`VISION.md`](VISION.md) (*why* — new), [`../AGENTS.md`](../AGENTS.md) (*how* —
  now also holds the current architecture absorbed from `ARCHITECTURE.md`),
  [`../STATUS.md`](../STATUS.md) (*now* — new living backlog), this log
  (*history*), and a thin [`../CLAUDE.md`](../CLAUDE.md) dispatch carrying a
  canonical-source-per-fact rule ("inventories live in code; prose states rules").
- **Retired phase numbering.** `phase-5.md`'s live items moved into `STATUS.md`.
- **Froze the plan docs in place** with banners (`refactor-plan.md`, `phase-5.md`,
  `living-sprints-plan.md`) rather than relocating them — moving would have broken
  ~30 relative links and forced retro-edits to this append-only log.
- **Tombstoned `docs/ARCHITECTURE.md`** (kept at its path so inbound links
  resolve); its current-state went to `AGENTS.md`, its principles to `VISION.md`.
- **Fixed the contradictions:** 6 state slices; multi-provider AI everywhere (the
  `@google/genai`-only language is gone); `project.md` as the single source of
  truth (the `chapters/*.md` target recorded as considered-but-not-shipped); the
  real Tauri command families (no `section_save`/`search`); the 300-line cap
  documented honestly as a warning-level target; env keys in
  `src-tauri/.env.local`; a vocabulary map for the four type subsystems (with
  `TestSuite` flagged as a legacy umbrella, not unit tests). Aligned the aesthetic
  to "no light mode required" (per the user's edit). Updated `metadata.json`.

**What to verify.** Docs-only: `git diff --stat` shows only `*.md` +
`metadata.json`. `npm test` / `npm run typecheck` / `npm run build` /
`npm run lint` unchanged from the branch base. Cross-reference check: every
doc-to-doc link resolves; no two living docs assert the same fact.

**Rollback.** `git revert` the commit; documentation only, no data or behavior.

**Definition of done (replaces the end-of-phase ritual).** Shipping a feature now
requires, in the same change: an entry here + a `STATUS.md` update, and
`AGENTS.md` / `VISION.md` only if a convention or principle changed. See
`AGENTS.md` → "Definition of done".

---

## 2026-06-16 — Fix: desktop autosave now persists the live draft (data-loss bugfix)

**Why.** A user lost hours of dissertation prose. Read-only forensics on the
affected project (`git` log/reflog/fsck + the sqlite cache) showed `project.md`
byte-identical across *dozens* of `autosave` commits: on desktop the 60-second
autosave wrote `state.markdown` (the "committed" copy), which only ever advanced
on a *manual* save, while the user's typing lived solely in the live editor buffer
(`localContent`). The desktop read drops `local_draft` (`document.rs` returns
`local_draft: None`), so when the WebView2 webview reloaded on wake-from-sleep it
re-hydrated the editor from the frozen `project.md` and silently reverted
everything since the last manual save. This broke VISION principle 5 ("the local
draft persists separately from the committed copy") on the desktop path only — the
browser path (which persists `localDraft` to IndexedDB) was unaffected. The lost
work was never written to disk in any form and was unrecoverable.

**What changed (TypeScript only; no schema/Rust change).**

- `saveCurrentState` (`src/state/project-state.ts`) now persists the **live**
  buffer: it writes `localContent` into both the on-disk `markdown` field and
  `localDraft`, and converges the in-memory committed `markdown` to match. Because
  `createSnapshot` calls `saveCurrentState` before `repo.commitSnapshot`, every
  autosave now both writes *and* git-commits the user's actual text.
- Added a safety guard: `saveCurrentState` refuses to overwrite a non-empty saved
  document with a transient empty buffer (the project-switch / load window).
- Simplified `handleManualSave` (`src/App.tsx`) — dropped the redundant,
  mis-ordered `setMarkdown(localContent)` that ran *after* the commit, so manual
  save had also been committing the stale copy.
- Added a regression test (`src/state/__tests__/persistence.test.ts`):
  edit → `saveCurrentState` → simulated desktop reload (`loadProject` with
  `localDraft` dropped) → asserts the live text survives and the persisted
  `markdown` equals it.

**What to verify.** `npm test` (169 pass, incl. 3 new), `npm run typecheck`
(clean), `npm run build` (ok). Manual (desktop, `npm run tauri:dev`): type prose,
wait > 60 s, hard-reload the window (Ctrl+R) → edits persist (pre-fix they
reverted); `git -C <project> log -p -1 -- project.md` shows the new text in the
latest autosave commit.

**Rollback.** Pure code; no schema/state migration. `git revert` restores the
prior behavior (and the bug). The on-disk format is unchanged — desktop simply now
writes the live text into the existing `project.md` / `localDraft` fields.

**Deferred / follow-up.** A separately-persisted, gitignored `.twriter/draft.md`
(round-tripping `local_draft` through Rust `document.rs` / `layout.rs` +
`.gitignore`) would also cover the < 60 s window and a hard crash before the first
autosave, fully restoring the draft/committed split on desktop. Tracked in
`STATUS.md`. The unrelated section-ID-orphan item ("re-enable App.tsx test-suite
cleanup") is untouched.
