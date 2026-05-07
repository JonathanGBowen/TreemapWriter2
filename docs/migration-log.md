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
