# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

[`AGENTS.md`](AGENTS.md) is the canonical operating guide and takes precedence over this file — read it in full before changing code. It carries the load-bearing context this summary omits: who the user is, the "where to put X" table, anti-patterns that get reverted, the aesthetic system, and the end-of-phase doc-refresh ritual. Supporting docs:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, principles, target shape.
- [`docs/migration-log.md`](docs/migration-log.md) — what each refactor phase actually shipped.
- [`docs/refactor-plan.md`](docs/refactor-plan.md) — the multi-phase master plan.
- [`docs/phase-5.md`](docs/phase-5.md) — current polish phase + deferred items.

## What this is

A single-user assistive-writing tool for one philosopher with ADHD finishing a dissertation. Tauri 2 desktop app: React/TS front end, Rust back end. It is deliberately **not** an enterprise product — no accounts, billing, RBAC, telemetry, i18n. Do not add those. The treemap surfaces document structure; AI provides _structural_ (not summary) analysis of argument. Hyper Light Drifter aesthetic: spare, glyph-driven, dark, almost no UI text.

## Commands

```
npm install          # first time
npm run dev          # Vite browser dev server (port 5173)
npm test             # Vitest (single run); npm run test:watch for watch mode
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # browser production build → ./dist
npm run tauri:dev    # desktop dev: spawns Vite + opens native window
npm run tauri:build  # desktop installer (.app/.dmg/.exe/.deb/.AppImage)
```

- Single test file: `npx vitest run path/to/file.test.ts`
- Single test by name: `npx vitest run -t "name fragment"`
- After any change, all three must pass: `npm test`, `npm run build`, `npm run typecheck`.

## Architecture in one screen

Strictly layered. Each rule below is non-negotiable; the rationale and the full "where to put X" mapping are in [`AGENTS.md`](AGENTS.md).

- **Source of truth is the markdown on disk** (`project.md` in the user's project folder). SQLite (`.twriter/index.sqlite`) is a derived, rebuildable cache; git is the history. Never treat the DB or in-memory state as authoritative.
- **Components never touch storage or SDKs directly.** Components → state-slice actions → the `Repository` interface → one repository implementation. Likewise components → the `AIProvider` interface, never `@google/genai` / `@anthropic-ai/sdk` directly.
- **State is partitioned by lifecycle, not feature** ([src/state/](src/state/)): `ui-state` and `editor-state` are ephemeral; `document-state`, `project-state`, `ai-state` are domain. Cross-slice mutations live in `project-state` via `get().otherSliceAction()` — not in component `useCallback`s.
- **Repository DI:** consumers import `repository` from [src/services/repository-registry.ts](src/services/repository-registry.ts), which picks `tauriRepository` (SQLite + markdown + git) or `browserRepository` (IndexedDB fallback) at module load. Use `isTauri()` only inside the registry layer.
- **AI layer** ([src/services/ai/](src/services/ai/)) is multi-provider: exactly one `LLMClient` per provider under `clients/` is the sole importer of that provider's SDK; `ai-provider.impl.ts` is provider-agnostic and dispatches by `ModelChoice`.
- **Rust back end** ([src-tauri/src/](src-tauri/src/)): components never call `invoke()` directly — go through a typed wrapper in `tauri-repository.ts`. Each `#[tauri::command]` is registered in `lib.rs::run`. Only `src-tauri/src/git/` touches `git2`; only `project/layout.rs` knows on-disk paths; `fs_io` does atomic writes.
- **Prompts are content, not code:** standalone `.md` files in [src/services/prompts/](src/services/prompts/), one per file, imported as raw strings. Never inline a prompt in TypeScript.
- **Domain types** in [src/types/index.ts](src/types/index.ts) encode the summary-vs-exegetical-reconstruction distinction. Extend them; do not collapse or "simplify" them.

Adding a persisted field touches multiple layers in lockstep: `Repository` interface → both TS implementations → the domain slice → and on the Tauri side the Rust mirror (`types.rs`), an on-disk path (`layout.rs`), and read/write in `document.rs` (serde silently drops unknown fields, so land Rust + TS together).

## Conventions & gotchas

- **File size:** target ≤300 lines/file, ≤80 lines/function. ESLint flags these as **warnings** (not hard errors), but AGENTS.md treats 300 as a real cap — split before committing rather than leaning on the warning.
- **Env keys:** Vite loads `.env.local` from **`src-tauri/`** (not the repo root) — see [vite.config.ts](vite.config.ts). Set `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` there. The desktop build also has a Rust keyring/env fallback in `src-tauri/src/commands/credentials.rs`.
- **Path alias:** `@/` resolves to the repo root.
- **Styling:** Tailwind v4 via `@tailwindcss/vite`. In new code use the `hld-*` color tokens (e.g. `hld-bg`, `hld-cyan`), not raw Tailwind colors. JetBrains Mono for chrome/glyphs; serif for the prose surface. No emoji in UI text.
- **Modals:** flat under [src/features/modals/](src/features/modals/), one file per modal. A modal subscribes to its own `showXModal` flag in `ui-state` via `useStore` — do not pass `isOpen`/`onClose`; only orchestration handlers (`onRun`, `onConfirm`) are props. Wrap the body in `ModalShell`.
- **Icons:** `lucide-react` only — do not add a second icon library.
- **New dependencies:** ask the user first. The default answer is "we don't need it."
- **End-of-phase ritual:** when a refactor-plan phase completes, refresh `docs/migration-log.md`, `docs/ARCHITECTURE.md`, and `AGENTS.md` in the same phase — see AGENTS.md for the full checklist.
