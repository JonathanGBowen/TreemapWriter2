# Migration Log

Append-only record of architectural phase transitions. The most recent entry
at the bottom is the current state.

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
