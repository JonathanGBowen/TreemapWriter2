# TreemapWriter2 — Agent Operating Guide

> If you are an AI coding agent (Claude, Cursor, Dyad, Aider, or otherwise),
> read this file in full before making any change. It is short on purpose.

## What this is

TreemapWriter2 is a single-user assistive-writing tool built to help one
philosopher with ADHD finish a dissertation. It is not an enterprise product.
It does not need user accounts, billing, RBAC, telemetry, A/B testing, or
internationalization. Do not add these. Do not propose them.

What it does need: to keep working, to never lose data, to be pleasant to
re-enter after a week away, and to support _structural_ — not summary —
analysis of academic argument.

## The user (this is load-bearing)

- A working philosopher writing a dissertation. Highly intelligent, ADHD,
  twice-exceptional. Reads complex texts; writes sophisticated prose.
- Wants the tool to feel like Hyper Light Drifter's UI: spare, glyph-driven,
  immersive, conveying scale and history through restraint. _Almost no words
  in the UI itself._ Affordances are clear from shape and behavior.
- Wants writing-help that respects the difference between summary and
  exegetical reconstruction. The domain model in `src/types/index.ts` already
  encodes this distinction; preserve it.
- Has limited working-memory budget for the codebase itself. Help the future
  user-with-this-codebase as much as you help the current user-of-the-app.

## Architectural law

The architecture is documented in detail in `docs/ARCHITECTURE.md`. The
non-negotiable rules:

1. **The source of truth for the dissertation is the markdown files on disk
   under the user's project folder** (post-Phase 3). SQLite is a derived
   cache. Git is the history. Do not treat SQLite or in-memory state as
   authoritative.
2. **Never write directly to disk or DB from a React component.** Components
   call slice actions; slices call the repository interface; only the
   repository implementation touches storage.
3. **Never call the AI provider SDK directly from a component.** Components
   call the `AIProvider` interface; only the provider implementation imports
   `@google/genai`.
4. **State is partitioned by lifecycle**, not by feature: `ui-state`,
   `editor-state`, `document-state`, `project-state`, `ai-state`. UI ephemera
   never lives in the same slice as domain data.
5. **Files cap at 300 lines.** If yours is approaching, split it before
   committing. ESLint enforces this.
6. **Prompts live as standalone `.md` files** under `src/services/prompts/`,
   one per file. Imported as raw strings. They are content, not code; treat
   them as you would treat any other text artifact.

## Where to put X

| If you're adding... | It goes in... |
|---|---|
| A new modal | `src/features/modals/<Name>Modal.tsx`. Add a `showXModal` boolean + `setShowXModal` setter to `src/state/ui-state.ts`. The modal must subscribe to its own openness flag via `useStore` — do not accept `isOpen` / `onClose` as props. Only orchestration handlers (e.g. `onRun`, `onConfirm`) should be props. Wrap the body in `modals/ModalShell` (the presentational HLD frame; it owns no openness — pass it `onClose`/`onPrimary`). For a model-depth control use `modals/SegControl` + `depth-choice.ts` rather than a raw model picker. |
| A new editor command | `src/features/editor/commands/` |
| A new Tauri IPC command | Add `#[tauri::command]` fn in the right `src-tauri/src/commands/<area>.rs`, register in `lib.rs::run`'s `tauri::generate_handler![...]`, expose a typed wrapper as a method on `tauriRepository` (`src/services/tauri-repository.ts`) or in a sibling service module. Components never call `invoke()` directly. |
| A new on-disk file in a project | Path goes in `src-tauri/src/project/layout.rs`. Read/write via `crate::fs_io::*` helpers (atomic write). If the file should be gitignored, update the `.gitignore` written by `project_create` in `src-tauri/src/commands/project.rs`. |
| A new git local operation | New function in `src-tauri/src/git/mod.rs`. |
| A new git remote operation | New function in `src-tauri/src/git/remote.rs`. Nothing outside `src-tauri/src/git/` touches `git2::*` directly. |
| A new AI flow | New prompt in `src/services/prompts/`, new method on `AIProvider` (`src/services/ai-provider.ts`), implementation in `src/services/ai/ai-provider.impl.ts` (provider-agnostic; calls an `LLMClient`), a new `AICallKind` + `DEFAULT_MODEL_CONFIG` entry in `src/services/ai/`, consumed via `aiProvider` from the registry |
| A new AI provider | New `LLMClient` in `src/services/ai/clients/<name>-client.ts` — the ONE file importing that SDK. Wire its key + dispatch in `ai-provider-registry.ts`; seed it in `model-catalog.ts`. Components never import the SDK. |
| A new OS-keyring secret | Add a `SecretService` literal in `src/services/credentials.ts`; the Rust side (`src-tauri/src/commands/credentials.rs`) is generic over the service name. AI keys (`gemini`/`anthropic`) also get an env fallback in `credentials.rs` so `.env.local` works without re-entry. |
| A new sync trigger | Extend `src/services/sync-policy.ts`. Don't add network calls outside that module — sync-policy owns the debounce / throttle invariants. |
| A new persisted field | Update `Repository` interface first (`src/services/repository.ts`), then both implementations, then the matching domain slice (`src/state/<name>-state.ts`). For Tauri, "both implementations" includes the Rust mirror (`types.rs`), an on-disk path (`layout.rs`), and read/write in `document.rs` — serde silently drops unknown fields, so land Rust + TS together (e.g. `modelsConfig` ↔ `.twriter/models.json`). Global, non-project settings go in `services/preferences.ts`, not the project file. |
| A new domain mutation (testSuite, document, etc.) | Action on the appropriate state slice, NOT a `useCallback` in a component. Cross-slice mutations live in `project-state` and use `get().otherSliceAction()`. |
| A new UI panel | New folder under `src/features/<panel-name>/` |
| A new icon | `lucide-react`. Do not introduce a second icon library |
| A new dependency | Ask the user. Default answer is "we don't need it" |

## Source-tree map

```
src/
├── App.tsx                    layout shell + remaining handlers (shrinking)
├── index.tsx                  React entry point
├── state/                     5 lifecycle slices + combined useStore
│   ├── ui-state.ts            modal flags, panel widths, focus mode (ephemeral)
│   ├── editor-state.ts        localContent, cursor (ephemeral)
│   ├── document-state.ts      markdown, sections, testSuite, history (domain)
│   ├── project-state.ts       projectList, activeProjectId, persistence thunks
│   ├── ai-state.ts            personas, prompts config, coach cache
│   └── index.ts               combines slices, exports useStore + AppState
├── store/index.ts             @deprecated re-export of state/ for back-compat
├── services/                  persistence + external APIs
│   ├── repository.ts          interface
│   ├── browser-repository.ts  IndexedDB impl (browser-only fallback)
│   ├── tauri-repository.ts    Tauri impl (SQLite + markdown + git + sync)
│   ├── repository-registry.ts DI: picks impl at module load
│   ├── ai-provider.ts         AI provider interface
│   ├── ai/                    multi-provider model layer
│   │   ├── clients/           one LLMClient per provider (sole SDK importers: gemini/anthropic/ollama)
│   │   ├── ai-provider.impl.ts provider-agnostic impl — prompts + parsing, dispatch by ModelChoice
│   │   ├── ai-provider.specs.ts spec-generation flow (split for size)
│   │   ├── model-types.ts     ProviderId, AICallKind, ModelChoice, ModelConfig
│   │   ├── model-catalog.ts   editable catalog (Gemini+Anthropic seed; Ollama auto-detected)
│   │   ├── model-config.ts    DEFAULT_MODEL_CONFIG + normalizeModelConfig (sparse)
│   │   └── resolve-model-choice.ts  per-kind resolution: project → global → default
│   ├── ai-provider-registry.ts DI for AI; bg-loads Gemini+Anthropic keys from keyring; injects config source
│   ├── credentials.ts         JS wrapper over OS-keyring Tauri commands
│   ├── sync-policy.ts         debounced auto-push + focus-pull (Phase 4)
│   ├── tauri-environment.ts   isTauri() runtime detector
│   ├── preferences.ts         global app prefs (tutorial flag, default model, catalog, Ollama URL)
│   └── prompts/               .md prompts + index.ts that assembles DEFAULT_PROMPTS_CONFIG
├── features/
│   ├── shared/                  cross-feature HLD presentational primitives
│   │   ├── Pip.tsx              the one diamond status vocabulary (.hld-pip*)
│   │   ├── Zone.tsx             eyebrow + hairline rule (structure, not boxes)
│   │   ├── Disclosure.tsx       collapsed open-one-at-a-time section
│   │   └── CopyButton.tsx       quiet copy-to-clipboard affordance
│   ├── sidebar/Sidebar.tsx      shell; composes ProjectMenu + MapZone + Dock
│   │   ├── ProjectMenu.tsx      the ◇ menu (absorbed + replaced FileMenu)
│   │   ├── Dock.tsx             CONTINUE (lit) + sprints + tools strip + caption
│   │   ├── SectionRow.tsx       one section-tree row
│   │   └── sync-status.ts       summarizeSync() → composite pip + label
│   ├── treemap/Treemap.tsx
│   ├── editor/EditorPanel.tsx
│   ├── tests-panel/             right panel: Spec | Analysis | Dialogue tabs
│   │   ├── TestsPanel.tsx       shell: accent line + tab strip + ⚙, resize
│   │   ├── SpecTab.tsx          orientation → NEXT → spec-with-verdicts → act
│   │   ├── PanelHeader.tsx      section + readiness pips
│   │   ├── MoveList.tsx         merged moves (verdict pip inline; expand WHERE/ACTION)
│   │   ├── DependencyChips.tsx  met/unmet chips + add popover
│   │   ├── PanelFooter.tsx      persona chip + suggestions + lit RUN DIAGNOSTIC
│   │   ├── EmptyState.tsx       no-spec lit GENERATE SPEC + manual goals
│   │   ├── diagnostic-config.ts STATUS/READINESS → pip mappings
│   │   ├── AnalysisTab.tsx      thesis spine + argument ladder + reading index
│   │   ├── DialogueTab.tsx      Socratic dialogue (streaming) + refactor
│   │   ├── PersonaBanner.tsx    evaluator banner (no-section empty state)
│   │   ├── use-analysis-actions.ts  orchestration hook (provider + slice actions)
│   │   └── use-current-section.ts   shared selectedId → Section derivation
│   ├── tutorial/Tutorial.tsx
│   └── modals/<Name>Modal.tsx   one file per modal; flat. Shared frame:
│       ModalShell.tsx (presentational, owns no openness) + SegControl.tsx
│       + depth-choice.ts (DEPTH stop → model tier in the active provider)
├── lib/                       pure utilities — parseMarkdown, exportBackup,
│                              defaultPersonas, etc. No React, no store.
└── types/index.ts             domain types (Section, SectionSpec, Snapshot, …)
```

```
src-tauri/                     Rust crate, Phase 2+ desktop shell
├── Cargo.toml                 crate name `treemap-writer`, lib `treemap_writer_lib`
├── tauri.conf.json            window config, build hooks, identifier
├── build.rs                   tauri-build hook
├── capabilities/default.json  capability set granted to the main window
├── icons/                     bundle icons (default placeholders for now)
└── src/
    ├── main.rs                desktop entry — calls treemap_writer_lib::run()
    ├── lib.rs                 builder + AppState + invoke_handler registration
    ├── error.rs               AppError + AppResult; serde glue for IPC
    ├── types.rs               Rust mirrors of TS types (camelCase wire format)
    ├── commands/              one file per concern; thin facades that dispatch
    │   ├── project.rs         project_create / open / close / list_recent / delete_recent
    │   ├── document.rs        project_read / project_write
    │   ├── snapshot.rs        snapshot_commit / list / read
    │   ├── migration.rs       migration_import_legacy (currently a stub; logic lives JS-side)
    │   ├── credentials.rs     credentials_set / get / delete (OS keyring, Phase 4)
    │   └── sync.rs            sync_state / sync_pull / sync_push / sync_configure_remote (Phase 4)
    ├── project/               handle, layout, state
    │   ├── mod.rs             AppState (global recent DB + current ProjectHandle)
    │   └── layout.rs          path helpers — only place that knows ".twriter/specs/..."
    ├── db/                    SQLite cache + global recent-projects DB
    │   ├── mod.rs             rusqlite Connection wrapper, schema bootstrap
    │   └── schema.sql         per-project + global tables
    ├── git/                   git2 wrappers — no other module touches git2 directly
    │   ├── mod.rs             local ops: init / commit_all / ensure_initial_commit
    │   └── remote.rs          remote ops: configure_remote / pull / push / sync_state (Phase 4)
    └── fs_io/                 filesystem I/O helpers
        ├── mod.rs             atomic_write_str + JSON helpers
        └── yaml.rs            serde_yaml glue for per-section spec sidecars
```

```
<user-picked-folder>/          A TreemapWriter project on disk (Phase 3+)
├── .git/                      Real git repo (libgit2-managed; revisions = commits)
├── .gitignore                 Excludes .twriter/index.sqlite + diagnostics
├── project.md                 THE prose. Source of truth. Open in any text editor.
└── .twriter/
    ├── settings.json          { name, schemaVersion, activePersonaId }
    ├── personas.json          custom personas
    ├── prompts.json           per-project PromptsConfig override
    ├── hidden.json            hiddenSectionIds (validated against parsed tree on load)
    ├── uistate.json           per-project layout (sidebar/panel widths, focus mode)
    ├── specs/<id>.spec.yaml   per-section SectionSpec + history + dependencies
    └── index.sqlite           derived cache (gitignored; rebuildable any time)
```

## Aesthetic

- Hyper Light Drifter dark theme is the canonical look. Light mode is
  acceptable but secondary. Keep both working.
- Color tokens: `hld-bg`, `hld-surface`, `hld-surface2`, `hld-border`,
  `hld-text`, and accent: `hld-cyan`, `hld-magenta`, `hld-yellow`,
  `hld-green`, `hld-purple`. Use these. Do not reach for raw Tailwind colors
  in new code.
- Typography: JetBrains Mono for chrome, status, and any glyph-like UI. The
  prose surface uses a serif (the editor itself).
- "Juicy" feedback is permitted at the **moment of consequence** — saving,
  diagnosing, syncing. It is forbidden as ambient decoration. Animation that
  does not communicate state is noise.
- No emoji in UI text. The HLD aesthetic is glyphic and quiet.

## ADHD-aware UX heuristics

- Default to fewer choices. If a screen offers more than five primary
  actions, it is wrong.
- Save automatically. Never ask the user to confirm a save.
- Show progress for any operation over 200ms. Spinners are minimum;
  streaming AI text is preferred.
- Make destructive actions undoable, not confirmable. Confirmation modals
  are an executive-function tax. (Exception: deleting a project — that one
  needs a confirm.)
- Never lose user input across crashes, reloads, or AI errors. Local draft
  persists separately from the committed copy.
- Surface state at a glance via color and shape, not text. The treemap is
  the primary affordance for "where am I in this document?".

## How to extend safely

Before any change:
1. Run `npm test` and ensure it passes on the branch base.
2. Read the file you're modifying _in full_, plus `docs/ARCHITECTURE.md`.
3. Identify which architectural layer your change belongs in. If it spans
   layers, you are about to introduce coupling — stop and ask.

After any change:
1. Run `npm test` and `npm run build`. Both must pass.
2. Run `npm run typecheck`. Must pass.
3. If you changed a `Repository` or `AIProvider` method signature, update
   _both_ implementations.
4. If you added a new persisted field, write the migration.

## Anti-patterns (will be reverted)

- Adding state to the wrong slice ("just for now").
- Calling `idb-keyval`, `fs`, `git2`, or `@google/genai` from a React
  component.
- Inlining a prompt string in TypeScript.
- "Simplifying" the domain types in `src/types/index.ts`. They are the most
  carefully considered part of this codebase. Extend, do not collapse.
- Adding a confirmation modal for a non-destructive action.
- Adding a configuration knob without a default that does the right thing.
- Adding a feature flag for a hypothetical user.
- Refactoring the test suite or the build pipeline as a side quest in an
  unrelated PR.

## Commands

```
npm install          # first time
npm run dev          # Vite browser dev server (port 5173)
npm test             # Vitest, must pass
npm run typecheck    # tsc --noEmit, must pass
npm run lint         # ESLint, must pass (max-lines: 300 enforced)
npm run build        # browser production build (./dist)
npm run tauri:dev    # desktop app dev — spawns Vite + opens native window
npm run tauri:build  # desktop installer (.app/.dmg/.exe/.deb/.AppImage)
```

Single test file: `npx vitest run path/to/file.test.ts`. Single test by name: `npx vitest run -t "name fragment"`.

### Tauri 2 desktop shell (Phase 2+)

The `src-tauri/` directory is a Rust crate. `tauri:dev` runs the Vite
server and opens a native webview pointing at it; the React UI is
unchanged. Storage stays IndexedDB until Phase 3, when SQLite +
markdown-on-disk + git replace the IndexedDB blob via a Tauri
`Repository` implementation.

**Linux system deps for desktop builds:**
```
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```
macOS needs Xcode CLT; Windows needs the Microsoft C++ Build Tools and
WebView2 runtime (preinstalled on Win10/11).

**Detect runtime:** `import { isTauri } from 'src/services/tauri-environment'`.
This is the branch point for `browserRepository` vs `tauriRepository` —
but consumers never need it; they import `repository` from
`src/services/repository-registry.ts`, which picks the right
implementation at module load.

## Refactor status

Phases 0–4 are shipped. The master design lives in
[`docs/refactor-plan.md`](docs/refactor-plan.md) (design archive);
[`docs/migration-log.md`](docs/migration-log.md) records what each phase
actually shipped; [`docs/phase-5.md`](docs/phase-5.md) tracks Phase 5
polish + every deferred item. Do not skip ahead to a later phase without
explicit instruction.

## End-of-phase ritual (load-bearing)

Whenever a phase from the refactor plan completes, before declaring it
done, refresh the agent-facing instructions in the SAME commit (or the
final commit of the phase):

1. Update `docs/migration-log.md` with what changed, what to verify, and
   the rollback procedure.
2. Update `docs/ARCHITECTURE.md` if the target shape, target file layout,
   or principles shifted.
3. Update this file (`AGENTS.md`) if there are new rules, new "where to
   put X" entries, new anti-patterns, or new commands.
4. Verify a fresh agent reading these three files alone could pick up
   the next phase without re-deriving design intent from the codebase.

This is not optional. The point of these files is that the next session
— whether the user's, yours, or another agent's — does not pay the
re-derivation tax. If the docs drift from reality, the tax compounds.

## When you're stuck

If a change is fighting you, the architecture is probably trying to tell
you something. Stop, re-read this file, re-read `docs/ARCHITECTURE.md`,
and ask which principle the proposed change violates. Usually that question
reveals where the change actually belongs.
