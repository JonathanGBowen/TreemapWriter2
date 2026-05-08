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
