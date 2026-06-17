# TreemapWriter2 — Agent Operating Guide (the "how")

> If you are an AI coding agent (Claude, Cursor, Dyad, Aider, or otherwise), read
> this file before making any change. It tells you **how the app is built today
> and how to work on it without breaking the architecture**. For *why* the app is
> shaped this way — the user, the principles, the aesthetic — read
> [`docs/VISION.md`](docs/VISION.md) first. For what is being worked on next, see
> [`STATUS.md`](STATUS.md).
>
> **Current as of 2026-06-15.** This describes conventions and the shape of the
> system, not an exact file inventory. Exact file trees, counts, and line numbers
> live in the code — trust the code over any list here.

## Design philosophy (why the rules below exist)

This architecture exists for one reason: the domain types in
[`src/types/index.ts`](src/types/index.ts) encode a serious theory of academic
prose, and they had earned a substrate that respects them instead of a JSON blob
shared with `sidebarWidth`. Every rule in this file maps to a principle in
[`docs/VISION.md`](docs/VISION.md) — the principle came first; the rule follows.
So when a change fights a rule, re-read the principle: that re-read almost always
reveals where the change actually belongs. (For the founding mandate behind the
principles, see [`docs/FOUNDING.md`](docs/FOUNDING.md).) This is what
agent-legibility means here — the codebase teaches you the reasoning, not just
the constraint, so no session pays the re-derivation tax twice.

## Current architecture

TreemapWriter2 is a Tauri 2 desktop app: a Rust shell (`src-tauri/`) hosting a
React 19 / TypeScript / Vite webview (`src/`). The same React UI also runs in a
plain browser against an IndexedDB fallback.

**Why Tauri** (not Electron, not web-only). Tauri runs the webview behind a Rust
backend: ~10 MB bundles instead of Chromium's ~150 MB, a capability-based
security model, and API keys held in the OS keyring rather than exposed in a
browser tab's `process.env`. Electron was rejected (carry Chromium for life;
uglier key handling); web-only/OPFS was rejected because multi-machine sync needs
a *real* filesystem and the *real* git binary. This choice constrains where code
runs — Rust owns secrets/git/SQLite; React owns UI — and is not negotiable.

**Layers** (each has one reason to change):

- **Presentation** — React components that render pixels (`src/features/`).
- **Application state** — ephemeral view-model that drives the view (selection,
  modal openness, panel widths). Zustand. Lost on reload, fine.
- **Domain state** — what the user persists (prose, specs, diagnostics,
  analyses, history). The nouns of the app.
- **Repository layer** — durably stores/retrieves the domain model; ignorant of
  React.
- **Service layer** — orchestrators composing persistence + AI into use-cases
  (`src/services/`).
- **Infrastructure** — Rust crate, SQLite, git, IPC, build tooling.

**Source of truth.** The original prototype had no clear answer to "what is the
source of truth?" — that was the underlying disease, and the persistence bugs
were its symptoms. The cure is one canonical home per datum; everything else is a
cache or projection:

| Data | Authoritative location | Cache / projection |
|---|---|---|
| Dissertation prose | `<project>/project.md` on disk (single file) | SQLite `sections`; Zustand `document-state` |
| Section specs | `<project>/.twriter/specs/<id>.spec.yaml` | SQLite `specs` |
| Analyses + dialogues | same `.spec.yaml` sidecar | — |
| History | `.git/` log of the project folder | — |
| Diagnostics | SQLite (regenerable) | — |
| UI / app state | Zustand (in memory) | per-project `uistate.json` |

In the browser fallback, the authoritative location is the IndexedDB blob; treat
it the same way — one source of truth, everything else a projection.

**The on-disk layout** is owned by the code, not duplicated here:
project-folder paths live in [`src-tauri/src/project/layout.rs`](src-tauri/src/project/layout.rs)
(the only place that knows `.twriter/...`); the SQLite cache schema lives in
[`src-tauri/src/db/schema.sql`](src-tauri/src/db/schema.sql). The cache is
rebuildable from disk at any time and is gitignored.

**Two dependency-inversion seams** make the app pluggable:

- **Repository** — `src/services/repository.ts` is the interface;
  `browser-repository.ts` (IndexedDB) and `tauri-repository.ts` (SQLite +
  markdown + git) implement it; `repository-registry.ts` picks one at module
  load. Consumers import the live `repository` and never branch on `isTauri()`
  themselves.
- **AIProvider** — `src/services/ai-provider.ts` is the interface; the
  provider-agnostic implementation (`src/services/ai/ai-provider.impl.ts`)
  resolves a per-call `ModelChoice` and dispatches to one `LLMClient` per
  provider under `src/services/ai/clients/`. Consumers import the live
  `aiProvider` from `ai-provider-registry.ts`.

**Tauri command surface** — registered in
[`src-tauri/src/lib.rs`](src-tauri/src/lib.rs); one file per concern under
`src-tauri/src/commands/`. The families: `app_info`; `project_*`
(create/open/close/list_recent/delete_recent); `project_read` / `project_write`
(bulk document IO — there is **no** per-section `section_save`); `snapshot_*`
(commit/list/read); `migration_import_legacy` (a stub); `credentials_*`
(OS-keyring); and `sync_*` (state/pull/push/resolve_merge/configure_remote).
Full-text `search` is **not yet implemented** (see [STATUS.md](STATUS.md)).

## Architectural law (non-negotiable)

1. **`project.md` on disk is the source of truth** for the prose. SQLite is a
   derived cache; git is the history. Never treat SQLite or in-memory state as
   authoritative. (Single-file by design — simpler git sync/merge. A per-chapter
   layout was considered and not shipped.)
2. **Never write directly to disk or DB from a React component.** Components call
   slice actions; slices call the `Repository` interface; only the repository
   implementation touches storage (`idb-keyval`, `fs`, `git2`, `invoke()`).
3. **Never call an AI SDK directly from a component.** Components call the
   `AIProvider` interface. Exactly **one** `LLMClient` file per provider imports
   that provider's SDK — today `@google/genai` (Gemini), `@anthropic-ai/sdk`
   (Anthropic), and a `fetch`-based Ollama client. No other file imports an AI
   SDK.
4. **State is partitioned by lifecycle, not by feature.** The slices are combined
   in [`src/state/index.ts`](src/state/index.ts): `ui-state` (modal flags,
   widths, focus — ephemeral), `editor-state` (draft, cursor — ephemeral),
   `document-state` (markdown, sections, the `testSuite`, history — domain),
   `project-state` (project list, persistence thunks), `ai-state` (personas,
   prompts config), and `revision-state` (the Glass-Box workflow — ephemeral).
   UI ephemera never shares a slice with domain data. Cross-slice mutations live
   in `project-state` via `get().otherSliceAction()`.
5. **Prompts are content, not code.** They live as standalone `.md` files under
   `src/services/prompts/`, one per file, imported as raw strings. Never inline a
   prompt string in TypeScript. The `.md` files are catalogued in one registry —
   `src/services/prompts/registry.ts` — the single source of truth for the prompt
   *inventory* and its metadata (label, description, category, flow, whether a
   user may edit it, declared `{{variables}}`). `PromptsConfig`,
   `DEFAULT_PROMPTS_CONFIG`, and the tier resolver are **derived** from it; do not
   hand-maintain a parallel prompt list. Effective prompt text resolves through
   three tiers — built-in defaults ◁ global user overrides ◁ per-project overrides
   (`resolvePromptsConfig`); both override layers are stored **sparse**. Engine
   internals are registry entries marked `editability: 'locked'`: catalogued, but
   never persisted or user-editable.
6. **Files trend small (~300-line target).** ESLint surfaces violations as a
   **warning, not an error** (`max-lines: warn` in `eslint.config.js`), so lint
   passes even when a file is over. The cap is a cognitive-load *target*: split a
   file before it grows rather than adding to a large one. Several files (notably
   `App.tsx`) currently exceed it — acknowledged debt, decomposed opportunistically
   (see [STATUS.md](STATUS.md)), not a build gate.

## Domain vocabulary (read this before touching `src/types/index.ts`)

The domain types in [`src/types/index.ts`](src/types/index.ts) grew in four
layers as features shipped. They **coexist on purpose**; there is no
half-finished rename to "fix." Knowing which layer a type belongs to prevents
mis-modeling new work:

| Layer | Key types | What it models |
|---|---|---|
| Original spec / diagnostic (the exegesis core) | `Section`, `SectionSpec`, `RequiredMove`, `MoveResult`, `DiagnosticResult` | the argument structure of a section and how well the prose realizes it |
| Grimoire / Analysis | `SectionAnalysis`, `AnalysisSpell`, `AnalysisVersion`, `SectionAnalysisState`, `DialogueMessage` | structural analysis + Socratic dialogue (the Analysis/Dialogue tabs) |
| Glass-Box revision | `RevisionProposal`, `RevisionType`, `RevisionMode`, `SourceDocument`, `DirectiveSuggestion` | the proposal-driven revision workspace |
| Living Sprints | `SprintPlan`, `SprintMove`, `SprintMoveRole`, `ArgumentShape` | the timed, move-based writing session |

One naming trap: **`TestSuite` / `TestSuiteEntry` is a legacy umbrella name, not
unit tests.** `TestSuite` is a `{ [sectionId]: TestSuiteEntry }` map; each entry
holds that section's goals, `spec`, latest `diagnostic`, dependencies, history,
and `analysis`. The fields carry their own legacy/new lineage in comments. Treat
the name as historical; do not "simplify" the structure.

## Where to put X

| If you're adding... | It goes in... |
|---|---|
| A new modal | `src/features/modals/<Name>Modal.tsx` (flat, one file per modal). Add a `showXModal` boolean + `setShowXModal` setter to `src/state/ui-state.ts`. The modal subscribes to its **own** openness flag via `useStore` — do not accept `isOpen`/`onClose` as props. Only orchestration handlers (`onRun`, `onConfirm`) are props. Wrap the body in `modals/ModalShell` (presentational HLD frame; owns no openness). Use `modals/SegControl` + `depth-choice.ts` for a model-depth control. A modal earns its **own folder** only when it grows a multi-component subtree (today: `modals/sprint/`, `modals/topo/`). |
| A new editor command | `src/features/editor/commands/` |
| A new Tauri IPC command | `#[tauri::command]` fn in the right `src-tauri/src/commands/<area>.rs`, register in `lib.rs::run`'s `tauri::generate_handler![...]`, expose a typed wrapper as a method on `tauriRepository` (`src/services/tauri-repository.ts`) or a sibling service. Components never call `invoke()` directly. |
| A new on-disk file in a project | Path goes in `src-tauri/src/project/layout.rs`. Read/write via `crate::fs_io::*` helpers (atomic write). If it should be gitignored, update the `.gitignore` written by `project_create` in `src-tauri/src/commands/project.rs`. |
| A new git local / remote operation | Local: `src-tauri/src/git/mod.rs`. Remote: `src-tauri/src/git/remote.rs`. Nothing outside `src-tauri/src/git/` touches `git2::*` directly. |
| A new project-entry flow (create / open / clone) | Command in `src-tauri/src/commands/project.rs`; reuse the `open_and_register` tail (it installs the handle via `state.open_at` and upserts the recent-projects row). Expose it on the `Repository` interface + both impls, then drive it from a `project-state.ts` thunk (folder picker via the `pickFolder` helper). The remote-aware entries (clone existing / create-and-publish) are the `RemoteProjectModal`; attaching a remote to the already-open project stays in `SyncConfigModal`. |
| A new AI flow | New prompt `.md` in `src/services/prompts/` + **one entry in `src/services/prompts/registry.ts`** (the type, defaults, and normalizer derive from it — no other prompt-wiring edit needed), a new method on `AIProvider` (`src/services/ai-provider.ts`), implementation in `src/services/ai/` (provider-agnostic; calls an `LLMClient`; read editable prompts via `input.config.<key>`, locked ones via `getPromptText(key)`, templated ones via `renderPrompt(key, vars)`), a new `AICallKind` + `DEFAULT_MODEL_CONFIG` entry, consumed via `aiProvider` from the registry. |
| A new AI provider | New `LLMClient` in `src/services/ai/clients/<name>-client.ts` — the ONE file importing that SDK. Wire its key + dispatch in `ai-provider-registry.ts`; seed it in `model-catalog.ts`. Components never import the SDK. |
| A new OS-keyring secret | Add a `SecretService` literal in `src/services/credentials.ts`; the Rust side (`src-tauri/src/commands/credentials.rs`) is generic over the service name. AI keys also get an env fallback so `src-tauri/.env.local` works without re-entry. |
| A new sync trigger | Extend `src/services/sync-policy.ts`. Don't add network calls outside it — sync-policy owns the debounce / throttle invariants. |
| A new persisted field | Update the `Repository` interface **first** (`src/services/repository.ts`), then **both** implementations, then the matching slice. For Tauri, "both implementations" includes the Rust mirror (`types.rs`), an on-disk path (`layout.rs`), and read/write in `document.rs` — serde silently drops unknown fields, so land Rust + TS together (e.g. `modelsConfig` ↔ `.twriter/models.json`). Global, non-project settings go in `services/preferences.ts`, not the project file. |
| A new domain mutation (testSuite, document, etc.) | An action on the appropriate state slice, NOT a `useCallback` in a component. |
| A new UI panel | New folder under `src/features/<panel-name>/`. |
| A new icon | `lucide-react`. Do not introduce a second icon library. |
| A new dependency | Ask the user. Default answer is "we don't need it." |

## Where things live (orientation, not an inventory)

```
src/
├── App.tsx              layout shell + remaining handlers (large; being shrunk)
├── state/               lifecycle slices + combined useStore (index.ts)
├── services/            persistence + external APIs
│   ├── repository*.ts   interface + browser/tauri impls + registry
│   ├── ai/              provider-agnostic impl, clients/ (one SDK each), model-*
│   └── prompts/         one .md per prompt + registry (inventory/metadata) + index (derives config)
├── features/            one folder per UI panel (sidebar, treemap, editor,
│                        tests-panel, revision, tutorial, modals/, shared/, …)
├── lib/                 pure utilities — no React, no store
└── types/index.ts       the domain types (see vocabulary above)

src-tauri/src/           Rust crate: lib.rs (builder + handlers), commands/,
                         project/ (layout, state), db/, git/, fs_io/, types.rs
```

For the exact, current tree, list the directories — do not rely on a snapshot in
prose, which is exactly what drifts.

## Commands

```
npm install          # first time
npm run dev          # Vite browser dev server (port 5173)
npm test             # Vitest — must pass
npm run typecheck    # tsc --noEmit — must pass
npm run lint         # ESLint (max-lines is a warning, not an error)
npm run build        # browser production build → ./dist
npm run tauri:dev    # desktop app: spawns Vite + opens a native window
npm run tauri:build  # desktop installer (.app/.dmg/.exe/.deb/.AppImage)
```

- Single test file: `npx vitest run path/to/file.test.ts`. By name:
  `npx vitest run -t "name fragment"`.
- Rust tests: `cargo test` inside `src-tauri/`.
- **API keys / env:** Vite loads env from **`src-tauri/.env.local`**, not the
  repo root (`vite.config.ts` → `loadEnv(mode, 'src-tauri', '')`); the desktop
  build also loads it at startup as a fallback to the OS keyring. Set
  `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` there. (A root `.env.local` exists
  for historical reasons but is not what the build reads.)
- **Detect runtime:** `import { isTauri } from 'src/services/tauri-environment'`
  — but consumers don't need it; they import `repository` /  `aiProvider` from
  the registries, which pick the right implementation at module load.

**Linux desktop build deps:** `libwebkit2gtk-4.1-dev libgtk-3-dev
libsoup-3.0-dev libjavascriptcoregtk-4.1-dev libayatana-appindicator3-dev
librsvg2-dev`. macOS needs Xcode CLT; Windows needs the MSVC C++ Build Tools and
the WebView2 runtime (preinstalled on Win10/11).

## How to extend safely

Before a change: read the file you're modifying *in full* and identify which
layer the change belongs in. If it spans layers, you are about to introduce
coupling — stop and ask which principle (see [`docs/VISION.md`](docs/VISION.md))
the change is fighting.

After a change: `npm test`, `npm run typecheck`, and `npm run build` must pass.
If you changed a `Repository` or `AIProvider` signature, update **both**
implementations. If you added a persisted field, write the migration.

## Definition of done (keep the docs honest — load-bearing)

The phased refactor that built this app is finished; work is now tracked as a
living backlog in [`STATUS.md`](STATUS.md), not by phase number. The doc-refresh
ritual is therefore per-feature, not per-phase. **Shipping a feature is not done
until, in the same change:**

1. [`docs/migration-log.md`](docs/migration-log.md) gets an append-only entry
   (what changed, how to verify, how to roll back).
2. [`STATUS.md`](STATUS.md) is updated (move the item out of Next; add any new
   lingering item or non-goal).
3. **This file** (`AGENTS.md`) is updated *only if a convention or the
   architecture changed*; [`docs/VISION.md`](docs/VISION.md) *only if intent
   changed*. Do not restate feature facts here that the code already encodes.

The point of these docs is that the next session — yours, the user's, or another
agent's — does not pay the re-derivation tax. If they drift from reality, the tax
compounds.

## Anti-patterns (will be reverted)

- Adding state to the wrong slice ("just for now").
- Calling `idb-keyval`, `fs`, `git2`, `invoke()`, `@google/genai`,
  `@anthropic-ai/sdk`, or an Ollama call directly from a React component.
- Inlining a prompt string in TypeScript.
- "Simplifying" or collapsing the domain types in `src/types/index.ts`. They are
  the most carefully considered part of this codebase. Extend, do not collapse.
- Adding a confirmation modal for a non-destructive action (an executive-function
  tax — make it undoable instead; the one exception is deleting a project).
- Adding a configuration knob without a default that does the right thing.
- Adding a feature flag for a hypothetical user.
- Refactoring the test suite or build pipeline as a side quest in an unrelated PR.
- Hand-maintaining a file tree, modal count, or command count in prose. Describe
  the rule; let the code carry the inventory.

## When you're stuck

If a change is fighting you, the architecture is probably trying to tell you
something. Stop, re-read [`docs/VISION.md`](docs/VISION.md), and ask which
principle the proposed change violates. Usually that question reveals where the
change actually belongs.
