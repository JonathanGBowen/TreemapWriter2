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
