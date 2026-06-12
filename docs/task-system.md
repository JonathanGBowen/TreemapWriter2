# Task system — design

> Design only; nothing here is implemented. Written 2026-06-12 after a full
> codebase review (file/line references verified against that day's tree).
> Indexed from [phase-5.md](phase-5.md) § Big-ticket work. Two scope
> decisions are already ratified: **no due dates anywhere**, and
> implementation waits for the trigger at the bottom of § Phases.

## Why

The app already externalizes the *argument*: specs say what a section must
do, diagnostics measure the gap move by move, dependencies say what blocks
what, and the treemap shows the whole at a glance. What it does not
externalize is *transient intention* — the things that evaporate between
sessions:

- "find the page number for the Quine quote" (chore, belongs to a section)
- "email Susan about the ch. 3 draft" (process, belongs to no section)
- "next time: rewrite the objection paragraph in 2.3" (session intention)

For the intended user (ADHD, dissertation-length work), holding these in
working memory while writing is exactly the tax the app exists to remove.
The design optimizes two costs and nothing else: **capture cost** (one
chord, type, Enter — without leaving the editor) and **re-entry cost**
("where was I, what's next" answered in the first five seconds of a
session).

Anti-goals follow from the same profile: no system that itself becomes
meta-work (priorities, labels, boards), no guilt machinery (dates, overdue
states, streaks), and graceful neglect — a task list ignored for three
weeks folds quietly instead of rotting accusingly.

## Taxonomy — where the truth lives

Four kinds of dissertation work, distinguished by where their truth lives;
that dictates representation:

| Kind | Truth lives in | Representation |
|---|---|---|
| Structural/argumentative ("the objection move is missing") | spec + prose; diagnostics measure the gap | **Derived, never stored** — computed at render from `requiredMoves` × `lastDiagnostic`. An explicit *promote* pins one as a stored Task. |
| Mechanical chores (citations, footnotes, figures) | the user's head until captured | Stored `Task`, usually section-bound. The case quick capture exists for. |
| External/process (advisor, paperwork) | the user's head | Stored `Task`, unbound → project inbox. |
| Session intention ("next time: …") | the user's head at the moment of stopping | One singleton `SessionNote`, shown on launch. Prose-to-self, not a checkbox. |

Storing structural items would duplicate `MoveResult`s and drift the moment
a diagnostic re-runs or a move is edited; deriving them keeps the
spec/diagnostic machinery the single source of truth and avoids building
the checklist-completion trap the docs warn against. Promotion is the user
saying "this one survives restarts and re-runs."

## Data model

TS in [src/types/index.ts](../src/types/index.ts); Rust mirror in
[src-tauri/src/types.rs](../src-tauri/src/types.rs) following its
loose-by-construction serde pattern (strings for enums, `Option` + 
`#[serde(default)]` everywhere).

```ts
type TaskStatus = 'open' | 'done' | 'dropped';

interface Task {
  id: string;            // task_<epochMs>_<rand> — never derived from content
  title: string;         // the only required content field
  status: TaskStatus;
  kind: 'manual' | 'promoted';
  sectionId?: string;    // absent = project inbox
  sectionTitle?: string; // snapshot at capture — load-bearing, see § Orphans
  moveId?: string;       // promoted only: which RequiredMove this pins
  note?: string;         // overflow detail; never prompted for
  createdAt: number;     // epoch ms
  closedAt?: number;     // set when status leaves 'open'
}

interface SessionNote {  // singleton per project
  text: string;
  updatedAt: number;
  sectionId?: string;    // where the user was; resume jumps here
}
```

`done` and `dropped` stay distinct because dropping is the *designed*
graceful-degradation path (§ Graceful neglect) and conflating them poisons
any later "what did I actually do" review.

Deliberately cut:

- **Due dates** — ratified. Dates manufacture overdue states; overdue
  states are guilt machinery. The few truly dated items per year belong in
  a calendar, not the writing tool.
- **Manual ordering / priority** — reordering is meta-work. Order is
  computed (recency for the inbox, document order for section tasks, the
  queue's own sort). "Do this first" is what the `SessionNote` is for.
- **Categories / labels / tags** — the binding already encodes the
  taxonomy: bound = chore/structural, unbound = external.
- **`in-progress` status** — a single user has one thing in progress:
  whatever the editor shows.
- **Text-location anchors** — offsets rot under every keystroke and
  sections are already small. Possible v2: `anchorQuote?: string`.

## Persistence

One git-tracked file: `.twriter/tasks.yaml`.

```yaml
version: 1
sessionNote:
  text: "Rewrite the objection paragraph in 2.3 — start from Susan's email"
  updatedAt: 1781234567890
  sectionId: the-objection-from-vagueness-141
tasks:
  - id: task_1781230000000_k3f9
    title: Find page number for the Quine quote
    status: open
    kind: manual
    sectionId: indeterminacy-of-translation-88
    sectionTitle: Indeterminacy of Translation
    createdAt: 1781230000000
```

**Wire path** — tasks ride the existing payloads; **no new IPC commands**:

- `StoredProjectData` gains `tasks?: Task[]` and `sessionNote?: SessionNote`
  ([src/services/repository.ts:19-40](../src/services/repository.ts#L19);
  Rust mirror [types.rs:216-246](../src-tauri/src/types.rs#L216)).
- [document.rs](../src-tauri/src/commands/document.rs) `read_from` /
  `write_to` read and write the YAML via the existing `fs_io::yaml` atomic
  helpers; the path accessor goes in
  [layout.rs](../src-tauri/src/project/layout.rs). Same "only write when
  the field is present" convention as personas/prompts.
- Browser repository: **zero changes** — it round-trips the whole blob
  through idb-keyval.
- Store: a sixth Zustand slice, `src/state/task-state.ts` (it is domain
  lifecycle, but `document-state.ts` would blow the 300-line cap by
  Phase B). Hydrate/save in `loadProject` / `saveCurrentState`, normalizing
  exactly like the legacy-deps pass
  ([project-state.ts:251-261](../src/state/project-state.ts#L251)):
  absent file → `[]`, unknown enum strings clamped to `open` / `manual`.
  Old projects load with **no migration**; `version: 1` exists for future
  shape changes.

**Rejected layouts:**

- *Inside the `.spec.yaml` sidecars* — welds task lifecycle to the spec
  orphan-rot described below; worse, `snapshot_read` reconstructs
  `testSuite` from the specs tree, so tasks would leak into `Snapshot` and
  `restoreSnapshot` would resurrect Tuesday's task list along with
  Tuesday's prose. Tasks are present intentions, not document state.
- *Per-section `.twriter/tasks/<id>.yaml`* — multiplies orphan files,
  still needs a special file for the inbox, N writes instead of one, at a
  scale (dozens of tasks, not thousands) that never justifies it.

**Git/sync/history are free, verified:** `commit_all` stages `["*"]`
honoring `.gitignore` ([git/mod.rs:80-90](../src-tauri/src/git/mod.rs#L80)),
so `tasks.yaml` lands in every autosave/manual snapshot commit;
sync-policy pushes it; cross-machine conflicts flow through the existing
ConflictResolutionModal as a normal text file (append-mostly YAML merges
cleanly in the common case). Do **not** gitignore it — the
three-recovery-paths durability story is the point. Tasks are deliberately
**excluded** from the `Snapshot` type and from `restoreSnapshot`: restoring
Tuesday's prose must not restore Tuesday's intentions.

**SQLite:** ship a `tasks` table in
[schema.sql](../src-tauri/src/db/schema.sql) (soft `section_id`, **no FK**
to `sections` — orphaned bindings are legal states) but do not wire a write
path. Verified 2026-06-12: the per-project cache tables (`sections`,
`specs`, `diagnostics`, `dependencies`, `sections_fts`) are written by
nothing — only the global `projects` table has live writes. Tasks should
not pioneer cache wiring alone; the table exists so the planned FTS work
can index tasks when the cache comes alive.

## Section-ID orphans — the critical risk

Verified behavior today: IDs are `slug(title)-lineIndex`
([utils.ts:4-6](../src/lib/utils.ts#L4)) and reparse reuses an old ID only
on *exact title match*, consumed in document order
([utils.ts:78-92](../src/lib/utils.ts#L78)). So body edits and section
moves survive; **a heading rename mints a new ID instantly**. Spec sidecars
rot invisibly when that happens: orphan files are left on disk by design
([document.rs:12-16](../src-tauri/src/commands/document.rs#L12)), loaded
back into `testSuite` forever
([document.rs:129-151](../src-tauri/src/commands/document.rs#L129)),
reachable from no UI; the in-memory cleanup that would remove them is
disabled after a data-loss bug ([App.tsx:300](../src/App.tsx#L300), tracked
in phase-5). Acceptable for specs (regenerable); **unacceptable for
tasks** — a captured chore that silently vanishes from every list is the
worst possible failure for this user.

Tasks therefore do better. Three rules:

1. **Orphans are first-class, never hidden.** A bound task whose
   `sectionId` no longer resolves renders in the project inbox under an
   *unanchored* heading, showing its `sectionTitle` snapshot
   (`◇ was: "The Objection from Vagueness"`). Zero data loss, zero
   invisibility, no migration.
2. **Automatic re-adoption by unique title.** `reconcileTasks(sections)`
   runs after each reparse settles: an orphan whose `sectionTitle` matches
   exactly one current section rebinds silently — the same matching
   philosophy `parseMarkdown` itself uses, so tasks re-attach precisely in
   the cases section identity itself recovers (rename-then-rename-back,
   moves). Ambiguous (0 or 2+ matches) → stays unanchored with a one-click
   re-anchor dropdown (reuse the flat-section `<select>` pattern at
   [TestsPanel.tsx:476-489](../src/features/tests-panel/TestsPanel.tsx#L476)).
3. **Import must not rebuild tasks.** `handleImportMarkdown` rebuilds
   `testSuite` from scratch ([App.tsx:354-389](../src/App.tsx#L354)); tasks
   persist as-is and reconcile against the new tree, orphaning gracefully
   if sections vanish.

Forward-compatible with the planned stable ULIDs
([phase-5.md § Stable section IDs](phase-5.md)): `sectionId` becomes a
ULID and reconciliation simply stops finding orphans. That is exactly why
`sectionTitle` is a snapshot field rather than a join.

## Derived work queue (Phase B)

Pure module `src/lib/queue.ts` (no React, no store — like `parseMarkdown`):

```ts
type QueueItem =
  | { type: 'task'; task: Task; blocked: boolean; orphaned: boolean }
  | { type: 'structural'; sectionId: string; sectionTitle: string;
      nextPriority: string; missingMoves: MoveResult[];
      readiness: ReadinessLevel; fresh: boolean; blocked: boolean };

function buildQueue(sections, testSuite, tasks): QueueItem[];
function isBlocked(sectionId, sections, suite): boolean; // extracted from Treemap
function openTaskCounts(tasks): Record<string /* sectionId|'inbox' */, number>;
```

- **One structural item per section, not per move** — a 40-section document
  with 4 moves each must not yield a 160-row queue. The row shows
  `nextPriority` (already designed as "the most important thing") plus a
  missing/partial count; expanding reveals move rows, each with a *promote*
  glyph (creates `Task{kind:'promoted', moveId, title: suggestedAction ??
  moveDescription, sectionId, sectionTitle}`).
- **De-dup:** a move with an open promoted task is suppressed from the
  derived expansion — the pinned task represents it. When a later
  diagnostic reports that move `present`, the promoted task shows a quiet
  *resolved?* affordance — one click to `done`. Never auto-complete:
  diagnostics are probabilistic AI output.
- **Staleness:** stamp `lastDiagnosticAt` and `lastDiagnosticInputHash =
  computeHash(fullContent + JSON.stringify(spec))` on the entry when a
  diagnostic lands (mirroring the `cachedSuggestions.inputHash` pattern;
  [utils.ts:8-15](../src/lib/utils.ts#L8)). Hash mismatch → row dims, sorts
  below fresh items, gets a re-run glyph.
- **Blocked:** extract the ancestor-walking prerequisite check inlined at
  [Treemap.tsx:55-69](../src/features/treemap/Treemap.tsx#L55) into
  `queue.ts::isBlocked` and have the treemap consume it too — one
  consistent meaning of "don't start this yet." Blocked rows sort last, in
  the treemap's gray family.
- **Sort:** session note (pinned) → open tasks on the *selected* section →
  fresh structural (readiness ascending, `draft` first) → inbox (newest
  first) → stale structural → blocked → dormant fold → archive fold.

**Bundled repair — diagnostic amnesia (verified bug):** desktop diagnostics
never survive a restart. `PersistedTestEntry` omits them and `into_entry()`
resets every section to `stale` with `last_diagnostic: None`
([types.rs:139-179](../src-tauri/src/types.rs#L139)); the comment there
claiming they "round-trip through SQLite cache" is aspirational — nothing
writes that cache. `.twriter/diagnostics.json` is already gitignored at
project creation
([project.rs:29-33](../src-tauri/src/commands/project.rs#L29)) but never
written by any code. Phase B writes
`{ [sectionId]: { generatedAt, inputHash, diagnostic } }` there, merges it
into the suite on load, and recomputes status via
[diagnosticToStatus](../src/lib/diagnostic-helpers.ts#L9) only when the
hash still matches. Until that lands, the desktop queue simply has no
derived rows after a restart — honest, not broken.

## UI

- **Sidebar "Queue" (primary surface):** a collapsible section between the
  treemap and the Sections list in
  [Sidebar.tsx](../src/features/sidebar/Sidebar.tsx) — project scope,
  always visible, adjacent to the existing "where am I" answer. Top ~5
  `QueueItem`s; clicking an item selects its section; collapsed = one
  header row with an open count. Not a modal: hidden-by-default violates
  ambient externalization, and modals are an executive-function tax.
- **Per-section block:** new `SectionTasks.tsx` mounted in TestsPanel below
  the Dependencies block
  ([TestsPanel.tsx:429-495](../src/features/tests-panel/TestsPanel.tsx#L429)),
  in its row style — open tasks for the current section plus one
  borderless inline add-input. Own component: TestsPanel already exceeds
  the 300-line cap.
- **Quick capture — `Mod-J` ("jot"):** new self-mounting overlay
  `src/features/quick-capture/QuickCaptureOverlay.tsx` (modal convention:
  own `ui-state` flag, mounted beside the other modals at
  [App.tsx:943](../src/App.tsx#L943)) — a single centered input row,
  HLD-bracketed. Window-level capture-phase `keydown` listener: fires
  before CodeMirror's handlers, collides with none of the loaded keymaps;
  `preventDefault` suppresses Chrome's downloads shortcut in the browser
  build. Pre-targets the current section (dim title chip); `Tab` toggles
  to `INBOX`; `Enter` saves and closes; `Esc` closes; focus returns to
  where it was. Total capture cost: chord, type, Enter.
- **Treemap badge:** append `◆n` for sections with open tasks to the
  existing per-node `text` entries
  ([Treemap.tsx:193-196](../src/features/treemap/Treemap.tsx#L193)) — the
  typography channel, so the status-color and readiness-border channels
  stay untouched. Own-section counts only (parent tiles are occluded by
  children). Sidebar section rows get the same `◆n` suffix — two surfaces,
  one convention.
- **Session resumption (Phase C):** `Mod-Shift-J` opens the same overlay in
  session-note mode; the note is also the pinned, inline-editable `NEXT ▸`
  row of the Queue. Capture is *always-editable, never on-quit* — quit
  hooks are unreliable (crash, force-quit; none is wired today) and exit
  prompts train the user to avoid closing the app. On app launch (after
  `loadInitialState`, [App.tsx:230](../src/App.tsx#L230)) a one-sentence
  resume overlay shows a non-empty note: `Enter` jumps to
  `sessionNote.sectionId`, `Esc` dismisses. **Launch only** — sync-policy
  reloads the project after merges
  ([sync-policy.ts:170-177](../src/services/sync-policy.ts#L170)) and the
  overlay must not ambush mid-session. The note is not auto-cleared on
  dismiss; it stays in the `NEXT ▸` slot until edited.

## Graceful neglect

Nothing persisted; all render-time folding:

- Closed tasks fold into an archive count — one expandable line, never a
  rotting list.
- Open tasks older than 21 days fold into `dormant n` with a single
  *sweep* action marking them all `dropped` (reversible from the archive
  fold — dropped ≠ deleted; there is no hard delete).
- No overdue states, no red, no badge counts on dormant items. Dormancy is
  a fold, not a reproach.

## Phases

**A — capture, persist, see (~600–800 LOC; both sides of IPC):**
types (`Task`, `SessionNote`); new `src/state/task-state.ts` slice
(`addTask`, `promoteMove`, `setTaskStatus`, `reanchorTask`,
`reconcileTasks`, `setSessionNote`, `setTasks`) registered in
`state/index.ts`; `ui-state` flag; `repository.ts` fields;
`project-state.ts` hydrate/save/reset; Rust `types.rs` + `layout.rs` +
`document.rs`; `schema.sql` table; `QuickCaptureOverlay`; `SectionTasks`;
sidebar `TaskQueue` v0 (stored tasks only, orphan handling, folds); Vitest
for normalization + reconcile (mirror the `parseMarkdown` tests).

**B — derived queue, treemap badges, diagnostics persistence
(~400–500 LOC):** `lib/queue.ts` + tests; stamp
`lastDiagnosticAt`/`inputHash` where diagnostics land in App.tsx
(`handleRunTests`); `.twriter/diagnostics.json` read/write; full unified
`TaskQueue`; promote glyphs on TestsPanel move rows + *resolved?* in
`SectionTasks`; `◆n` in Treemap + Sidebar; switch Treemap to
`queue.ts::isBlocked`.

**C — session resumption (~150–250 LOC):** `showResumeOverlay` flag;
session-note mode + `Mod-Shift-J`; `ResumeOverlay.tsx`; activate the
`NEXT ▸` slot.

Each phase ends with the AGENTS.md ritual: update
[migration-log.md](migration-log.md), [ARCHITECTURE.md](ARCHITECTURE.md)
(project folder layout gains `tasks.yaml`), and AGENTS.md "Where to put X"
(task mutations → `task-state.ts`; new on-disk file row).

**Trigger to prioritize:** the next time a todo captured on paper gets
lost, or a session starts with more than five minutes of "where was I."

## Explicit non-goals

- **Due dates / scheduling** (ratified) — overdue states are guilt
  machinery; the model has no date field on purpose, not as an omission.
- **Kanban, swimlanes, priorities, labels, filters** — meta-work
  playground; sort order is the priority signal; binding is the category.
- **Recurring tasks, time tracking, pomodoro, streaks, stats** — different
  products; streak-breaking is punishment-by-design for ADHD.
- **Notifications / reminders** — the app is opened intentionally; the
  resume overlay at launch is the only "push."
- **AI auto-task-generation** — diagnostics already generate the
  structural work and the queue surfaces it; auto-spawning persistent
  chores creates volume the user didn't consent to and trust-debt when
  they're wrong. Promotion keeps a human finger on every persisted item.
  Revisit only as "promote from Content Suggestions."
- **Cross-project inbox, external tool sync, collaboration, assignees** —
  single user, single dissertation.
- **Hard delete** — `dropped` + archive covers it; deleting captured
  thoughts should not be one keystroke.
- **New Tauri commands or a wired tasks cache** — `project_read`/`write`
  already carry the payload; the SQLite cache stays unwired until
  something wires it for real.
