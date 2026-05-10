# TreemapWriter2 — Architectural Refactor Plan

> _For a working philosopher with ADHD, finishing a dissertation, who is also the developer._
>
> This is the master plan that informed Phases 0–3+ of the refactor. It was
> authored in a web Claude session under the path
> `/root/.claude/plans/act-as-a-senior-toasty-teacup.md` and committed
> in-repo during Phase 3.5 so every future agent (and machine) reads from
> the same source. See [migration-log.md](migration-log.md) for what each
> phase actually shipped versus what's specified here.

## Context

You have built, by vibe-coding, a real and working assistive-writing tool that already does something philosophically distinctive: it does not summarize, it _structures_. The domain model in `src/types/index.ts` reflects this — `SectionFunction`, `RequiredMove`, `incomingContext`, `outgoingCommitments`, `ReadinessLevel`. That vocabulary is not vibes. That is a thoughtful theory of academic prose, encoded.

The problem is not the idea. The problem is that the substrate the idea is sitting on has reached its first scaling wall. Specifically:

1. **Persistence is a single JSON blob per project, rewritten in full every 60 seconds**, with up to 50 deep-copied snapshots of the entire document and test suite stored _inside_ that blob. Storage grows as `O(history × document)`. (`src/store/index.ts:406-481`)
2. **State management is a single 482-line Zustand store** with ~60 fields mixing UI ephemera (sidebar width, 14 modal-open booleans) with domain data (markdown, sections, testSuite, revisions) and AI configuration. No partition by concern, no middleware. (`src/store/index.ts:119-482`)
3. **`App.tsx` is 1,061 lines** with 14 `useEffect` hooks, 12 modals mounted inline, and prop drilling so severe that `Sidebar` takes 31 props and `EditorPanel` takes 21. (`src/App.tsx:88-1062`)
4. **Change tracking is full-document snapshot, not differential.** You correctly intuited that git's model would be a better fit. It is — but the right move is not to re-implement git; it is to _use_ git.
5. **There is no agent-facing documentation.** Every Dyad/Claude/Cursor session re-derives intent from scratch. For an ADHD developer, this is a tax paid daily.

What follows is an analysis, the principles by which I am analyzing, the recommended target architecture, and a phased path that never breaks your working tool.

---

## Part I — Architectural Analysis (with the appropriate vocabulary)

### The right distinctions

You asked for the most appropriate language for these distinctions. The vocabulary that will serve you longest:

- **Presentation layer / view layer** — the React components that render pixels. UI concern only.
- **Application state / view-model** — ephemeral runtime state that exists to drive the view (selection, modal openness, panel widths). Lost on reload, and that is fine.
- **Domain model / domain state** — the things the user actually cares about persisting (the dissertation text, specs, diagnostics, history). The "nouns" of the application.
- **Persistence layer / repository layer** — the code that knows how to durably store and retrieve the domain model. Should be ignorant of React.
- **Service layer** — orchestrators that compose persistence + external calls (AI providers) into use-cases. "Generate specs for sections" is a service operation; "fetch project by id" is a repository operation.
- **Infrastructure** — the runtime, the database engine, the IPC, the build tooling. Below the service layer; ideally invisible to it.

These are not pedantic. The reason your `App.tsx` hurts is precisely that it conflates all six. Naming them is the first move toward unconflating them.

A second pair of terms worth holding onto, because it directly addresses your change-tracking instinct:

- **Source of truth** — the authoritative copy of a piece of state. There can be only one.
- **Derived state / projection / cache** — anything computed from the source of truth. Can always be rebuilt; never authoritative.

Right now your application has no clear answer to "what is the source of truth?" The IndexedDB blob, the Zustand store, and the CodeMirror buffer all sometimes act like it. That is the underlying disease; the persistence symptoms are surface manifestations.

### What you actually have, in those terms

| Layer | What lives there now | Verdict |
|---|---|---|
| Presentation | 31 components, ~3,200 LOC, Tailwind + HLD theme | Aesthetically coherent in dark mode; structurally tangled |
| Application state | `AppState` Zustand store (UI flags) | Mixed with domain state; not partitioned |
| Domain model | Same `AppState` store + `types/index.ts` | The _types_ are excellent. The _store_ co-locates them with UI flags. |
| Persistence | `idb-keyval` flat KV — one JSON blob per project | Works at small scale; will not scale |
| Service layer | `lib/ai-pipeline.tsx` + scattered handlers in `App.tsx` | Partially extracted; mostly inlined |
| Infrastructure | Vite SPA, browser only | Hits the wall at Gemini-key handling, real filesystem access, real DB |

The good news: your **types are already at the right level of abstraction.** The bad news: nothing else respects them yet.

---

## Part II — The Principles (as diagnosis)

I am going to name these as I apply them, because in a codebase that will continue to be co-developed with AI agents, the principles need to be _legible to the agent_, not just held in your head.

### 1. Separation of concerns

> _A module should have one reason to change._

Your `App.tsx` has at least seven reasons to change: a new modal, a new keyboard shortcut, a new auto-save trigger, a new AI flow, a new editor feature, a new persistence policy, a new section-parsing rule. This is the textbook smell. The fix is to give each of those reasons its own home.

### 2. Single source of truth

> _Every piece of state has exactly one canonical location; everything else is a projection._

Your draft (`localContent`) and your committed (`markdown`) and your snapshots and your IDB blob all act, at different moments, like the truth. This produces the race conditions the audit found. The fix is to declare _one_ store as authoritative and treat the rest as caches that can be rebuilt.

### 3. Persistence ignorance / dependency inversion

> _High-level domain logic does not import low-level storage details._

`App.tsx` and `Sidebar.tsx` directly call `idb-keyval` and Zustand setters that themselves call IndexedDB. The domain depends on the database. Inverting this — domain calls a `Repository` interface, the IndexedDB implementation _implements_ that interface — is what lets you swap IndexedDB for SQLite without touching components.

### 4. Content-addressable, append-only history

> _Past states are immutable. New states are derivations. History is a graph of derivations, not a list of overwrites._

This is git's central insight, and it is exactly the right model for a dissertation. A draft is never destroyed; it is superseded. You can return to any prior state cheaply because you never deleted it. You asked whether to model on git: yes, but **use the actual git binary** rather than re-implementing it. More on this below.

### 5. Minimum cognitive surface area (the ADHD principle)

> _A file should fit in working memory. A folder should answer one question. Re-entering the codebase after a week should not require re-derivation._

This is not a vanity principle for you. It is structural. A 1,061-line `App.tsx` is a ravine you fall into every time you open it; a 60-field god-store is an interrogation room. The fix is hard caps — **300 lines per file, then split** — enforced by a linter, plus a folder structure where the answer to "where does X go?" is a 5-second decision.

### 6. Agent-legibility

> _The codebase teaches an AI agent how to extend it correctly without re-deriving design intent each session._

A new principle, peculiar to your situation. It implies: an `AGENTS.md` at the root, file-level docstrings, naming conventions agents can pattern-match, anti-pattern callouts, and tests an agent can run before declaring victory.

### 7. Reversibility and durability proportional to stakes

> _The harder it is to recover from a mistake, the more redundant the safety net should be._

This is your dissertation. The safety net should be _excessive_. SQLite as the working store, plain markdown files on disk as a human-readable mirror, and git as the version-controlled, syncable, recoverable backbone. Three independent recovery paths.

---

## Part III — Target Architecture

Given your answers (Tauri 2, belt-and-suspenders, phased, multi-machine auto-sync), the architecture writes itself with surprising elegance. The pieces interlock.

### The runtime: Tauri 2

**Why Tauri over Electron.** Tauri ships a Rust backend behind your existing webview-rendered React UI. The backend can read/write files, embed SQLite, shell out to git, and hold your Gemini API key in OS-level secret storage rather than `process.env` exposed to a browser tab. Bundles are ~10MB instead of ~150MB. Security model is capability-based rather than "Node has full access to your machine."

**Why not Electron.** It would work. But you'd carry Chromium for life, and the Gemini key handling story is uglier (main process vs renderer process leakage). The Rust learning curve is real but small for what you'd write — and the AI agent does most of it.

**Why not stay web-only with OPFS.** Because you also chose multi-machine auto-sync, which needs a real filesystem and a real git binary. OPFS does not give you that.

### The data architecture: SQLite + markdown-on-disk + git

This is the single most important decision in the plan. Read it carefully.

```
~/Dissertation/                  ← a real folder you can ls into
├── .git/                        ← actual git repo, pushed to private GitHub
├── .twriter/
│   ├── index.sqlite             ← derived cache: fast queries, never authoritative
│   ├── settings.json
│   └── specs/
│       ├── 01-introduction.spec.yaml ← structured specs as YAML sidecars (gittable)
│       └── 02-explication.spec.yaml
└── chapters/
    ├── 01-introduction.md       ← your prose, in markdown, the source of truth
    └── 02-explication.md
```

**Why this layout works:**

1. **Plain markdown is the source of truth.** Your dissertation, in human-readable form, on your filesystem, forever. If TreemapWriter2 evaporates tomorrow, you open the folder in any text editor and your work is intact. This is the foundational durability property.
2. **SQLite is a derived cache.** It exists for fast queries — "give me all sections with a `fail` diagnostic," "find sections with broken dependency edges," full-text search via FTS5. It can be deleted and rebuilt from the markdown + sidecar files at any time. It is _never authoritative_.
3. **YAML sidecars carry structured data.** Specs (`SectionSpec`), persona configs, dependency edges — anything that is structured but per-section — live in `.twriter/specs/` as YAML files alongside the prose. YAML diffs cleanly in git, unlike SQLite blobs.
4. **Diagnostics are ephemeral.** AI diagnostic results live in SQLite only. They are cheap to regenerate, they go stale on edits, and they would clutter git history if persisted. `.gitignore` them.
5. **Git is your change-tracking system.** Every save is a `git commit`. Every "branch this draft" is `git branch`. Every undo-to-yesterday is `git checkout`. You asked whether to model on git — the answer is to _use_ git, because:
   - It is already the best content-addressable store ever built for prose.
   - It already does diff, merge, branching, blame.
   - `git log` _is_ your version history UI's data source.
   - You get free de-duplication via content-addressable blobs.
   - You don't have to maintain it.
6. **Git is also your sync system.** Multi-machine auto-sync = `git pull` on app launch, `git push` on app exit (and on save, debounced). Private GitHub repo as the cloud backbone. No Syncthing, no iCloud Drive races, no custom sync protocol. If a real conflict occurs (rare for single-author writing), the app surfaces it; the user resolves in the UI.

This single decision makes the persistence problem, the change-tracking problem, the multi-machine problem, AND the durability problem all the same problem, solved once.

### State management restructure

Partition the single Zustand store into **slices by lifecycle**, each as its own file (~150 lines each):

```
src/state/
├── ui-state.ts          ← modal flags, panel widths, focus mode, dark mode
├── editor-state.ts      ← localContent, selection, cursor, active line
├── document-state.ts    ← sections (parsed view of current document)
├── project-state.ts     ← activeProjectId, projectList
└── ai-state.ts          ← active provider, prompts config, in-flight requests
```

The persistence layer (next section) subscribes to `document-state` and `project-state` changes and writes through to disk. UI components subscribe to whichever slice they need. **No store ever calls IndexedDB or fs directly.**

### Service / repository layer

Introduce a clean boundary that the UI never crosses:

```
src/services/
├── repository.ts            ← interface: getProject, listProjects, saveSection, etc.
├── tauri-repository.ts      ← implementation calling Rust IPC commands
├── browser-repository.ts    ← legacy IndexedDB implementation (Phase 1 fallback)
├── ai-provider.ts           ← interface: generateSpecs, runDiagnostic, streamCoach
├── gemini-provider.ts       ← Google GenAI implementation
└── prompts.ts               ← extracted from constants.ts; one prompt per file
                              under src/services/prompts/
```

Components import _interfaces_, never implementations. `tauri-repository.ts` is selected at boot via a small DI registry. Switching to Anthropic later = adding `anthropic-provider.ts` and a config flag, not a refactor.

### The Rust side (Tauri commands)

Surface the smallest possible API:

```rust
// src-tauri/src/commands.rs (sketch)
#[tauri::command] async fn project_open(path: PathBuf) -> Result<ProjectMeta>
#[tauri::command] async fn project_list_recent() -> Result<Vec<ProjectMeta>>
#[tauri::command] async fn section_save(section_id: String, markdown: String, spec: SectionSpec) -> Result<()>
#[tauri::command] async fn snapshot_commit(message: String, trigger: SnapshotTrigger) -> Result<CommitId>
#[tauri::command] async fn snapshot_list(limit: u32) -> Result<Vec<CommitMeta>>
#[tauri::command] async fn snapshot_diff(from: CommitId, to: CommitId) -> Result<UnifiedDiff>
#[tauri::command] async fn sync_pull() -> Result<SyncReport>
#[tauri::command] async fn sync_push() -> Result<SyncReport>
#[tauri::command] async fn search(query: String) -> Result<Vec<SearchHit>>  // FTS5
```

Recommended Rust crates:
- `rusqlite` with `bundled` feature for SQLite (FTS5 included).
- `git2` for git operations (libgit2 bindings; no shelling out).
- `serde` / `serde_yaml` for sidecar IO.
- `tokio` for async; `keyring` for OS secret storage (Gemini API key).
- `tantivy` only if SQLite FTS5 proves insufficient — defer.

### Component architecture

Break up `App.tsx` along feature lines, not technical lines:

```
src/features/
├── editor/         ← CodeMirror + EditorPanel, autosave, focus mode
├── treemap/        ← Plotly viz + section tree
├── tests-panel/    ← spec editing + goals + diagnostics
├── modals/         ← each modal as its own folder with its own slice subscription
├── ai-coach/       ← coaching, suggestions, persona-driven feedback
├── version-history/ ← snapshot browser, diff viewer (now backed by git log)
└── project-manager/ ← project list, open/create/delete
```

Each feature folder owns: its components, its hooks, its store-slice subscriptions, its types. **Modals subscribe to slices directly instead of receiving 31 props.** `App.tsx` shrinks to a layout shell — routing-equivalent for a single-page app — and is target-sized at ~150 lines.

### AI service layer

Move all 547 lines of prompts out of `constants.ts` into one-prompt-per-file under `src/services/prompts/`:

```
src/services/prompts/
├── system-instruction.md    ← the core philosophical-architect prompt
├── generate-specs.md
├── run-diagnostic.md
├── coach.md
├── refine-spec.md
└── ...
```

Each is a `.md` file, imported as a string via Vite's `?raw` import. This makes prompts diffable in git, editable without recompiling mental code-vs-prose context, and reviewable as text artifacts. Variables get interpolated via a tiny templating helper.

Streaming: Gemini SDK supports streaming; the AI provider interface should expose it as `AsyncIterable<Chunk>`. The UI surfaces it as token-by-token append in a sidebar panel — a small, non-trivial polish that hugely improves the felt responsiveness for an ADHD writer.

---

## Part IV — Phased Migration

The constraint is absolute: **at no point may your dissertation become unreachable.** Every phase ends with a shippable, working app and a viable rollback.

### Phase 0 — Foundations (1–2 sessions, no functional change)

- Create `AGENTS.md` at repo root (full content drafted in Part V below).
- Add ESLint with `max-lines: 300` and `complexity` rules.
- Add `.editorconfig`.
- Set up minimal Vitest for the parser and the markdown round-trip.
- Add a "data export" button to current app: dumps every project as JSON to disk. **Run this. Save the dump.** This is your migration insurance.

### Phase 1 — Decompose without changing storage (2–4 sessions)

- Split `store/index.ts` into the five slices listed above. Persistence stays IndexedDB; only the in-memory shape changes.
- Extract feature folders. `App.tsx` shrinks to a shell.
- Modals subscribe to slices instead of receiving props.
- Extract prompts from `constants.ts` to `src/services/prompts/*.md`.
- Introduce `Repository` interface; current IndexedDB code becomes `BrowserRepository` implementing it.

End of Phase 1: same UX, same storage, dramatically more legible code. Shippable. Already a win.

### Phase 2 — Add Tauri shell (2–3 sessions)

- `npm create tauri-app` alongside existing Vite app; Tauri wraps the existing UI unchanged.
- Implement minimum Rust commands: filesystem read/write, no DB yet.
- App launches as desktop app; still uses IndexedDB for now.
- Verify build pipeline, code-signing path on your platform.

End of Phase 2: same app, now a desktop installer. Web build still works as fallback.

### Phase 3 — Storage migration (3–5 sessions)

- Implement `TauriRepository`: SQLite via `rusqlite`, markdown sidecar layout on disk.
- Implement git initialization and the `snapshot_commit` command.
- Implement importer: reads the legacy IndexedDB JSON dump, writes markdown + SQLite + initial git commit.
- Add a migration UI: "I have existing projects in the old format — import them."
- Run the importer on your real dissertation. **Commit before, commit after.** Verify the round-trip.
- Switch repository implementation flag from `BrowserRepository` to `TauriRepository`.

End of Phase 3: dissertation now lives in `~/Dissertation/`, with full git history, queryable in SQLite, mirrored as plain markdown.

### Phase 4 — Sync (1–2 sessions)

- Add `sync_pull` / `sync_push` Tauri commands wrapping git2.
- Add UI affordance: subtle sync indicator in chrome (HLD-style: small dot, magenta if dirty, cyan if synced).
- Configure your private GitHub repo. Test pull/push cycle from a second machine.

End of Phase 4: multi-machine auto-sync via git. Belt-and-suspenders durability achieved.

### Phase 5 — Polish (ongoing)

- Streaming AI responses in a sidebar coach panel.
- FTS5-backed full-text search.
- Conflict-resolution UI for the rare case where two machines diverge.
- Consider Y.js / Automerge for collaborative editing **only if** you ever invite a co-author. Otherwise: out of scope, do not pre-build.

---

## Part V — `AGENTS.md` (drafted)

This file lives at the repo root. It is the first thing every coding agent reads. The current contents of `AGENTS.md` are derived from the draft in this section; refer to that file directly for the live version. The key sections originally drafted were:

- "What this is" — scope guardrails (no enterprise features).
- "The user" — load-bearing description of the philosopher-author.
- "Architectural law" — six non-negotiable rules.
- "Where to put X" — table-driven contributor guide.
- "Aesthetic" — HLD color tokens, typography, juicy-feedback rules.
- "ADHD-aware UX heuristics" — fewer choices, automatic saves, undo over confirm.
- "How to extend safely" — pre- and post-change checklists.
- "Anti-patterns (will be reverted)" — explicit forbidden practices.
- "Commands" — the canonical npm scripts.

---

## Part VI — Verification

Each phase ends with the following checks:

- `npm run build` succeeds.
- `npm test` passes (parser round-trip, markdown import/export, repository contract tests).
- App launches; existing projects load (Phase 1) or migrate cleanly (Phase 3).
- Manual smoke: create section → edit → save → close app → relaunch → content present.
- After Phase 3: open `~/Dissertation/chapters/*.md` in a plain editor; content matches what the app shows.
- After Phase 4: edit on machine A, push, pull on machine B, content matches.

---

## Part VII — SQLite schema (Phase 3 reference)

The cache only. Authoritative data is markdown + YAML on disk.

```sql
-- One project = one folder. This table indexes recently-opened folders.
CREATE TABLE projects (
  id TEXT PRIMARY KEY,                 -- UUID
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,           -- absolute path on disk
  last_opened INTEGER NOT NULL,        -- epoch ms
  word_count INTEGER NOT NULL DEFAULT 0
);

-- Sections are derived from parsing the markdown files; rebuildable.
CREATE TABLE sections (
  id TEXT PRIMARY KEY,                 -- stable id, see id-strategy.md
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES sections(id),
  title TEXT NOT NULL,
  level INTEGER NOT NULL,
  ordinal INTEGER NOT NULL,            -- position among siblings
  source_file TEXT NOT NULL,           -- e.g. "chapters/02-explication.md"
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL           -- sha-256 of section body
);
CREATE INDEX sections_project ON sections(project_id);
CREATE INDEX sections_parent  ON sections(parent_id);

-- Specs mirror the YAML sidecars; rebuildable from disk.
CREATE TABLE specs (
  section_id TEXT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  function TEXT NOT NULL,              -- 'introduce' | 'explicate' | ...
  main_claim TEXT NOT NULL,
  required_moves_json TEXT NOT NULL,   -- jsonb-style storage
  incoming_context_json TEXT NOT NULL,
  outgoing_commitments_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Diagnostics are ephemeral. Not in git, not on disk. SQLite only.
CREATE TABLE diagnostics (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  generated_at INTEGER NOT NULL,
  readiness TEXT NOT NULL,             -- 'draft' | 'developing' | ...
  next_priority TEXT,
  move_results_json TEXT NOT NULL,
  coherence_notes_json TEXT NOT NULL,
  input_hash TEXT NOT NULL,            -- input that produced this; staleness check
  PRIMARY KEY (section_id, generated_at)
);

-- Dependencies between sections (the graph in DependencyGraphModal).
CREATE TABLE dependencies (
  from_section TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  to_section   TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                  -- 'prerequisite' | 'reference'
  PRIMARY KEY (from_section, to_section, kind)
);

-- FTS5 virtual table over section content for full-text search.
CREATE VIRTUAL TABLE sections_fts USING fts5(
  section_id UNINDEXED,
  title,
  body,
  content='',
  tokenize='porter unicode61'
);
```

Rebuild policy: drop & recreate `sections`, `specs`, `dependencies`, `sections_fts`
on project open if the cache is older than the `.git/HEAD` mtime.
`projects` and `diagnostics` survive rebuilds.

---

## Critical files to modify (with line ranges from the audit)

### Phase 0 — Foundations
- New: `/AGENTS.md` (root)
- New: `/.eslintrc.cjs` with `max-lines: 300`, `max-lines-per-function: 80`
- New: `/.editorconfig`
- New: `/vitest.config.ts`
- New: `/src/lib/__tests__/utils.parseMarkdown.test.ts`
- Add: `package.json` scripts — `test`, `typecheck`

### Phase 1 — Decompose
- **`src/App.tsx:88-1062`** — extract everything except a layout shell.
  - Lines 254-298 (autosave + parse effects) → move to `src/features/editor/use-autosave.ts`
  - Lines 479-617 (handleInterpolateTasks, handleRunTests, etc.) → move to feature folders or `src/services/ai-flows.ts`
  - Lines 836-878 (EditorPanel mount) → wrap as feature in `src/features/editor/`
  - Lines 880-1057 (12 modals) → each becomes `src/features/modals/<name>/index.tsx` and subscribes to slices directly
- **`src/store/index.ts:119-482`** — split:
  - UI flags, modal openness, panel widths → `src/state/ui-state.ts`
  - `localContent`, selection, cursor → `src/state/editor-state.ts`
  - `markdown`, `sections`, `testSuite`, `revisions` → `src/state/document-state.ts`
  - `projectList`, `activeProjectId` → `src/state/project-state.ts`
  - `activePersonaId`, `customPersonas`, `promptsConfig`, AI flags → `src/state/ai-state.ts`
  - Persistence thunks (`loadInitialState`, `saveCurrentState`, `createSnapshot`) → behind `src/services/repository.ts`
- **`src/lib/constants.ts:16-547`** (the `DEFAULT_PROMPTS_CONFIG`) — each field becomes a file under `src/services/prompts/`
- **`src/lib/ai-pipeline.tsx:1-404`** — refactor as the Gemini implementation of `src/services/ai-provider.ts`
- **`src/components/Sidebar.tsx`** (31 props) — rewrite to subscribe to slices
- **`src/components/panels/EditorPanel.tsx`** (21 props) — same
- **`src/components/Treemap.tsx:42-51,212`** — separate Plotly-rendering from testSuite-color logic; rendering takes a derived `TreemapNode[]` rather than reading store

### Phase 2 — Tauri shell
- New: `/src-tauri/` — generated by `npm create tauri-app` then customized
- New: `/src-tauri/src/commands.rs` with the 9 commands listed in Part III
- New: `/src/services/tauri-repository.ts` — calls Rust via `@tauri-apps/api/core invoke()`
- Update: `/src/services/repository.ts` — at boot, select `tauri-repository` if running in Tauri, else `browser-repository`

### Phase 3 — Migration
- New: `/src-tauri/src/db/schema.sql` (the SQL above)
- New: `/src-tauri/src/db/mod.rs` — rusqlite wrapper
- New: `/src-tauri/src/git.rs` — git2 wrapper for commit/log/diff/pull/push
- New: `/src/features/migration/import-from-indexeddb.ts` — reads the Phase 0 export, calls Tauri commands to write disk + DB + initial git commit
- New: `/src/features/migration/MigrationModal.tsx` — UI for one-time migration

### Phase 4 — Sync
- Update: `/src-tauri/src/git.rs` — add pull/push with credentials helper
- New: `/src/features/sync/SyncIndicator.tsx` — small dot in chrome
- New: `/src/services/sync-policy.ts` — when to push (debounced after commit), when to pull (on focus, on launch)

### Documentation (Phase 0 + ongoing)
- New: `/docs/ARCHITECTURE.md` — the full target architecture, kept in sync with reality
- New: `/docs/id-strategy.md` — how section IDs are assigned and survive renames (replacing the fragile title-slug-based scheme in `src/lib/utils.ts:4-6`)
- New: `/docs/migration-log.md` — append-only log of each migration applied, for forensic reconstruction if anything goes wrong

---

## Part VIII — A 90-minute Phase 0 quickstart

Because executive function is the scarce resource, the first sitting needs a
crisp checklist with no decisions in it. Open this list, work top to bottom,
do not branch:

1. `git switch -c claude/architect-philosophy-mentoring-u78W5`
2. Run the existing app once. Confirm it loads your dissertation. Note the project list.
3. Add a "Export all projects" button to `Sidebar.tsx` that calls `idb-keyval`'s `entries()` and dumps everything to a single `backup.json` download. ~30 lines. Write it.
4. Click the button. Save `backup.json` somewhere safe. **This is your migration insurance.**
5. Create `/AGENTS.md` from Part V of this plan.
6. Create `/docs/ARCHITECTURE.md` containing Parts I–IV of this plan.
7. Add ESLint with `max-lines: 300`. Run it. Note the violations (don't fix yet).
8. Add Vitest. Write one test: round-trip `parseMarkdown` on a known input.
9. Commit with message `chore: phase 0 — foundations, agent guide, backup`.
10. Done. Stop here. Phase 1 is its own sitting.

---

## Verification (across all phases)

End-to-end smoke test (run after every phase):

1. Launch app.
2. Open existing project. Sections appear in treemap.
3. Edit a section. Wait 5s. Reload app. Edit persists.
4. Generate spec for a section via AI. Confirm spec persists.
5. Run diagnostic on a section. Confirm result renders.
6. Open Version History. See list of snapshots/commits.
7. _Phase 3+:_ Open `~/Dissertation/chapters/*.md` in a plain editor; verify content matches.
8. _Phase 4+:_ Edit on machine A, push, pull on machine B, verify content matches.

Automated tests (Vitest):
- `parseMarkdown` round-trip on representative inputs
- `markdown → section tree` invariants (titles preserved, ordering preserved, word counts correct)
- Repository contract tests run against both `BrowserRepository` and `TauriRepository`
- Migration test: feed a sample legacy IndexedDB export, assert resulting markdown + SQLite + git state

---

## Closing note (the philosophical one)

The deepest reason to do this refactor is not the storage efficiency or the
file-size cap. It is that your domain types in `src/types/index.ts` —
`SectionFunction`, `RequiredMove`, `incomingContext`, `outgoingCommitments`
— already encode a serious theory of academic prose. They deserve a
substrate that respects them. Right now they are wrapped in a JSON blob
inside an IndexedDB key, jostling for room with `sidebarWidth: number` and
`showProjectModal: boolean`. The refactor's real work is to give your
philosophical model the architectural seat it has earned.

The git decision is the same kind of move at a different scale. You asked
whether to model history on git. The deeper answer is: your dissertation is
already _the kind of artifact_ that wants to be in git — long-form,
incremental, branchable, recoverable, sync-friendly, human-readable. The
work isn't to imitate git. The work is to admit that git is what you've
been reaching for.
