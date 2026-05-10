# TreemapWriter2 — Architecture

> The full plan lives at [`refactor-plan.md`](refactor-plan.md). This file
> is the in-repo, agent-readable summary. Update both when reality drifts.

## Vocabulary

- **Presentation layer / view layer** — React components that render pixels.
  UI concern only.
- **Application state / view-model** — ephemeral runtime state that drives
  the view (selection, modal openness, panel widths). Lost on reload, fine.
- **Domain model / domain state** — what the user persists (the dissertation
  text, specs, diagnostics, history). The "nouns" of the application.
- **Persistence layer / repository layer** — code that durably stores and
  retrieves the domain model. Ignorant of React.
- **Service layer** — orchestrators composing persistence + external calls
  (AI providers) into use-cases.
- **Infrastructure** — runtime, database engine, IPC, build tooling.

## Source of truth

| Data | Authoritative location | Cache |
|---|---|---|
| Dissertation prose | `<project>/chapters/*.md` on disk (post-Phase 3) | SQLite `sections` table; Zustand `document-state` |
| Section specs | `<project>/.twriter/specs/*.spec.yaml` | SQLite `specs` table |
| History | `.git/` log of the project folder | — |
| Diagnostics | SQLite (ephemeral, regenerable) | — |
| UI state | Zustand `ui-state` (in memory) | — |

Pre-Phase 3, the authoritative location is the IndexedDB blob. Treat it the
same way: one source of truth, everything else is a projection.

## Principles

1. **Separation of concerns** — a module has one reason to change.
2. **Single source of truth** — every piece of state has exactly one
   canonical location.
3. **Persistence ignorance / dependency inversion** — domain logic depends
   on a `Repository` interface; storage implementations depend on it.
4. **Content-addressable, append-only history** — past states are immutable;
   git is the substrate.
5. **Minimum cognitive surface area** — files cap at 300 lines; folder
   structure answers "where does X go?" in 5 seconds.
6. **Agent-legibility** — the codebase teaches an AI agent how to extend it
   correctly without re-deriving design intent each session.
7. **Reversibility and durability proportional to stakes** — three
   recovery paths: SQLite, plain markdown on disk, git history pushed to
   a private GitHub remote.

## Target layout (end state, Phase 4 complete)

```
<project-folder>/                  ← user-chosen, e.g. ~/Dissertation
├── .git/                          ← real git repo, pushed to private GitHub
├── .twriter/
│   ├── index.sqlite               ← derived cache (FTS5 search, queries)
│   ├── settings.json              ← project-local settings
│   └── specs/
│       └── <section-id>.spec.yaml ← structured specs as YAML sidecars
├── chapters/
│   ├── 01-introduction.md         ← prose, source of truth
│   └── ...
└── README.md
```

```
<repo>/                            ← this codebase
├── AGENTS.md
├── docs/
│   ├── ARCHITECTURE.md            ← this file
│   ├── id-strategy.md             ← stable section ID derivation
│   └── migration-log.md           ← append-only phase log
├── src/
│   ├── App.tsx                    ← target: ~150 lines, layout shell only
│   ├── index.tsx
│   ├── state/
│   │   ├── ui-state.ts
│   │   ├── editor-state.ts
│   │   ├── document-state.ts
│   │   ├── project-state.ts
│   │   └── ai-state.ts
│   ├── services/
│   │   ├── repository.ts          ← interface
│   │   ├── browser-repository.ts  ← legacy IndexedDB impl
│   │   ├── tauri-repository.ts    ← Tauri impl (Phase 3+)
│   │   ├── ai-provider.ts         ← interface
│   │   ├── gemini-provider.ts
│   │   └── prompts/
│   │       ├── system-instruction.md
│   │       ├── generate-specs.md
│   │       └── ...
│   ├── features/
│   │   ├── sidebar/Sidebar.tsx        ← chrome + project tree
│   │   ├── treemap/Treemap.tsx        ← Plotly hierarchical view
│   │   ├── editor/EditorPanel.tsx     ← CodeMirror surface + focus mode
│   │   ├── tests-panel/TestsPanel.tsx ← spec / diagnostic / dependency UI
│   │   ├── tutorial/Tutorial.tsx      ← onboarding (react-joyride)
│   │   ├── modals/*.tsx               ← 14 self-mounting modals (flat)
│   │   ├── migration/             ← Phase 3
│   │   └── sync/                  ← Phase 4
│   ├── lib/                       ← pure utilities (parser, hash, defaults)
│   └── types/
├── src-tauri/                     ← Phase 2+
│   └── src/
│       ├── commands.rs
│       ├── db/{mod.rs,schema.sql}
│       └── git.rs
└── package.json
```

## SQLite schema (Phase 3 cache, never authoritative)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  last_opened INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES sections(id),
  title TEXT NOT NULL,
  level INTEGER NOT NULL,
  ordinal INTEGER NOT NULL,
  source_file TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL
);
CREATE INDEX sections_project ON sections(project_id);
CREATE INDEX sections_parent  ON sections(parent_id);

CREATE TABLE specs (
  section_id TEXT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  function TEXT NOT NULL,
  main_claim TEXT NOT NULL,
  required_moves_json TEXT NOT NULL,
  incoming_context_json TEXT NOT NULL,
  outgoing_commitments_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE diagnostics (
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  generated_at INTEGER NOT NULL,
  readiness TEXT NOT NULL,
  next_priority TEXT,
  move_results_json TEXT NOT NULL,
  coherence_notes_json TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  PRIMARY KEY (section_id, generated_at)
);

CREATE TABLE dependencies (
  from_section TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  to_section   TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  PRIMARY KEY (from_section, to_section, kind)
);

CREATE VIRTUAL TABLE sections_fts USING fts5(
  section_id UNINDEXED,
  title,
  body,
  content='',
  tokenize='porter unicode61'
);
```

Rebuild policy: drop & recreate `sections`, `specs`, `dependencies`,
`sections_fts` on project open if the cache is older than `.git/HEAD` mtime.
`projects` and `diagnostics` survive rebuilds.

## Tauri command surface (Phase 2+)

```rust
project_open(path) -> ProjectMeta
project_list_recent() -> Vec<ProjectMeta>
section_save(section_id, markdown, spec) -> ()
snapshot_commit(message, trigger) -> CommitId
snapshot_list(limit) -> Vec<CommitMeta>
snapshot_diff(from, to) -> UnifiedDiff
sync_pull() -> SyncReport
sync_push() -> SyncReport
search(query) -> Vec<SearchHit>
```

Recommended crates: `rusqlite` (bundled feature, FTS5 included), `git2` for
git operations, `serde` + `serde_yaml` for sidecar IO, `tokio` for async,
`keyring` for OS secret storage of the Gemini API key.

## Phases

| Phase | Goal | Storage at end | Status |
|---|---|---|---|
| 0 | Foundations: AGENTS.md, ESLint, Vitest, backup export button | IndexedDB (unchanged) | ✅ done |
| 1 | Decompose: split store, extract features, prompts to .md | IndexedDB (unchanged) | ✅ done |
| 2 | Tauri shell wraps existing UI; verify desktop build | IndexedDB (unchanged) | ✅ done |
| 3 | TauriRepository: SQLite + markdown-on-disk + git init; importer migrates legacy data | Disk + SQLite + git | ✅ done |
| 3.5 | AI provider abstraction (deferred Phase 1 deliverable); commit master plan to repo | Disk + SQLite + git | ✅ done |
| 4 | Sync: git pull/push wired into chrome | Disk + SQLite + git + remote | ⏳ next |
| 5 | Polish: streaming AI, FTS5 search, conflict resolution UI | — | |

Current phase is recorded in [`docs/migration-log.md`](migration-log.md).

## Anti-patterns

See `AGENTS.md`. Listed here too:

- Adding state to the wrong slice.
- Calling `idb-keyval`, `fs`, `git2`, or `@google/genai` from a React component.
- Inlining a prompt string in TypeScript.
- "Simplifying" the domain types in `src/types/index.ts`.
- Adding a confirmation modal for a non-destructive action.
- Adding a configuration knob without a sensible default.
- Adding a feature flag for a hypothetical user.
