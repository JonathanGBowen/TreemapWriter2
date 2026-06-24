import type {
  DiskSignature,
  MarkdownDelta,
  Persona,
  PromptsConfig,
  ProjectMeta,
  PullOutcome,
  PushOutcome,
  Resolution,
  ResolveOutcome,
  ReverseOutlineDoc,
  SearchHit,
  SectionInput,
  SessionRecord,
  Snapshot,
  SnapshotMeta,
  SyncState,
  TestSuite,
} from '../types';
import type { ModelConfig } from './ai/model-types';

/** One `Key: value` git trailer on a semantic session commit. Ordered. */
export interface CommitTrailer {
  key: string;
  value: string;
}

/**
 * The shape of a project as actually stored on disk. All fields are optional
 * because real-world data has accumulated under multiple schema versions and
 * the loader must tolerate gaps. Normalization happens in the store, not here.
 */
export interface StoredProjectData {
  projectName?: string;
  markdown?: string;
  localDraft?: string;
  testSuite?: TestSuite;
  hiddenSectionIds?: string[];
  activePersonaId?: string;
  customPersonas?: Persona[];
  /**
   * Per-project prompt override. Stored SPARSE — only the fields that differ
   * from the built-in defaults (resolves against the global tier on load).
   * Tolerated full or sparse on read; the store diffs it back to sparse.
   */
  promptsConfig?: Partial<PromptsConfig>;
  /** Pre-Phase-1 alias of promptsConfig. Honor on read; do not write. */
  interpolationConfig?: PromptsConfig;
  /** Per-project, per-call model overrides. Sparse; resolves against the global default. */
  modelsConfig?: ModelConfig;
  /**
   * Parallel Editor reverse outlines (outlineA), one entry per scope the user has
   * outlined (`.twriter/reverse-outline.json` on desktop). Only the faithful outline
   * persists; the edited target + regenerated draft are ephemeral session state.
   */
  reverseOutlines?: ReverseOutlineDoc[];
  cachedCoachAdvice?: { inputHash: string; advice: string } | null;
  revisions?: Snapshot[];
  lastModified?: number;
  uiState?: {
    sidebarWidth?: number;
    testsPanelWidth?: number;
    revisionRailWidth?: number;
    revisionProposalsWidth?: number;
    compareReportWidth?: number;
    focusMode?: boolean;
    selectedSectionId?: string | null;
    activeLineIndex?: number | null;
  };
}

/**
 * Persistence boundary. The store talks to a Repository; nothing else in the
 * domain layer touches IndexedDB, the filesystem, or the network directly.
 *
 * Phase 1b: BrowserRepository wraps idb-keyval + localStorage fallback.
 * Phase 3:  TauriRepository wraps SQLite + markdown-on-disk + git.
 */
export interface Repository {
  /** Project metadata list. Empty array if nothing is stored. */
  getMeta(): Promise<ProjectMeta[]>;
  setMeta(meta: ProjectMeta[]): Promise<void>;

  /** Returns null when no project exists for that id. */
  getProject(id: string): Promise<StoredProjectData | null>;
  setProject(id: string, data: StoredProjectData): Promise<void>;
  deleteProject(id: string): Promise<void>;

  /**
   * Desktop only: create a new on-disk project at `path` (an empty folder) and
   * make it the open project handle. Returns its metadata. The browser has no
   * folder concept and throws — callers branch on `isTauri()`.
   */
  createProjectAt(name: string, path: string): Promise<ProjectMeta>;

  /**
   * Desktop only: open an existing TreemapWriter folder (e.g. one cloned from a
   * remote) as the current project handle. Returns its metadata. Browser throws.
   */
  openProjectAt(path: string): Promise<ProjectMeta>;

  /**
   * Desktop only: clone an existing TreemapWriter project from `url` (HTTPS +
   * the PAT in the OS keyring) into the empty folder `path`, then open it as the
   * current handle. Throws if the remote isn't a TreemapWriter project (empty,
   * or missing project.md / .twriter/) — the caller routes to Create + publish.
   * Browser throws.
   */
  cloneProject(url: string, path: string): Promise<ProjectMeta>;

  /**
   * One-time migration of the very old `socratic_project_v1` localStorage
   * key. Returns the imported meta + data, or null if nothing to migrate.
   * The caller is responsible for adding the meta to the active list.
   */
  migrateVeryOldLegacy(): Promise<{
    meta: ProjectMeta;
    data: StoredProjectData;
  } | null>;

  /**
   * Mark a meaningful version. Under Tauri, this becomes a git commit;
   * under the browser, it's a no-op (snapshots live as plain entries on
   * the in-memory `revisions` array, persisted by `setProject`). Returns
   * the new commit OID under Tauri, null in the browser.
   *
   * Called from the store's `createSnapshot` thunk after `setProject`
   * has written current state to disk.
   */
  commitSnapshot(
    message: string,
    trigger: 'manual' | 'autosave' | 'pre-ai-write',
    affectedScope: 'all' | { sectionIds: string[] },
    /**
     * Optional git trailers, supplied only for session-end *semantic* commits.
     * When present, the commit subject becomes `Session goal: <message>` and the
     * trailers (`GMT-step`, `Session`, `WOOP-obstacle`, `Steps-completed`,
     * `Word-delta`) are appended machine-parseably. Ordered. Browser ignores it.
     */
    trailers?: CommitTrailer[],
  ): Promise<string | null>;

  // --- Session ceremony: git tags, refs, word-count delta, session sidecar ---

  /**
   * Create or move a lightweight git tag (`session/<id>/start|end`) at a commit.
   * Idempotent (force). Browser: no-op (no git). Used to bracket a session.
   */
  createTag(tagName: string, commitId: string): Promise<void>;

  /**
   * List tag names, optionally filtered by a glob (e.g. `session/*`). Browser: [].
   */
  listTags(pattern?: string): Promise<string[]>;

  /**
   * Resolve a ref (tag/branch/OID/HEAD) to a commit OID, or null if unresolved
   * (e.g. an unsynced tag). Lets Version Compare turn a session tag into a
   * selectable snapshot id. Browser: returns the input unchanged if it names a
   * known in-memory revision, else null.
   */
  resolveRef(refname: string): Promise<string | null>;

  /**
   * Word-count delta of `project.md` between two refs (`to - from`). Desktop
   * uses git blobs; the browser computes it from in-memory `revisions` markdown.
   */
  wordCountDelta(fromRef: string, toRef: string): Promise<number>;

  /**
   * All recorded sessions for the open project, newest first. Desktop reads
   * `.twriter/sessions/*.yaml`; the browser reads its IndexedDB session store.
   */
  listSessions(): Promise<SessionRecord[]>;

  /**
   * Persist one session record (create or overwrite by `id`). Desktop writes a
   * single YAML sidecar; the browser updates its IndexedDB session store.
   */
  saveSession(record: SessionRecord): Promise<void>;

  /**
   * Blob-free listing of the open project's snapshot history, newest first.
   * Cheap (commit metadata only, no file reads), so it can reach far back —
   * used by Version Compare to index deep history without the cost of loading
   * full content. `limit` caps the walk (default: a generous implementation
   * constant). Tauri wraps `snapshot_list`; the browser maps its in-memory
   * `revisions`. Returns [] for an empty/fresh history.
   */
  listSnapshotMeta(limit?: number): Promise<SnapshotMeta[]>;

  /**
   * Lazily fetch ONE snapshot's full content (markdown + testSuite) by id.
   * Returns null if the commit is gone or unreadable. Tauri wraps
   * `snapshot_read`; the browser finds it in the in-memory `revisions`. Used to
   * resolve the two operands a comparison actually needs, regardless of how far
   * back they sit.
   */
  readSnapshot(id: string): Promise<Snapshot | null>;

  /**
   * Desktop only: read the open project's `project.md` only if it changed on
   * disk since `known` (its last-returned signature; pass `null` to force a
   * read). Returns the current signature plus content — `content` is non-null
   * only when the file changed, so an unchanged file is a cheap stat. The
   * browser has no filesystem and returns `{ signature: null, content: null }`.
   * Used to detect edits made to the file outside the app.
   */
  readMarkdownIfChanged(known: DiskSignature | null): Promise<MarkdownDelta>;

  // --- Phase 4: sync ---

  /**
   * Purely-local snapshot of the project's git state. No network. Used by
   * the UI indicator on every project open and after every commit. Browser
   * mode returns { hasRemote: false } and the sync UI hides.
   */
  syncState(): Promise<SyncState>;

  /**
   * Fetch + fast-forward from `origin`. Never destructive — divergence and
   * dirty-working-tree cases are returned as outcome variants, not acted on.
   * Browser mode returns `{ kind: 'noRemote' }`.
   */
  syncPull(): Promise<PullOutcome>;

  /**
   * Push the current branch to `origin`. Reports `nonFastForward` rather
   * than erroring on divergence. Browser mode returns `{ kind: 'noRemote' }`.
   */
  syncPush(): Promise<PushOutcome>;

  /**
   * Apply the user's per-file conflict resolutions (from a prior `mergeRequired`
   * pull) and create the merge commit. `theirCommit`/`baseHead` are echoed from
   * that outcome. Returns `stale` if the repo moved since detect — re-pull and
   * reopen. Browser mode returns `{ kind: 'noRemote' }`.
   */
  syncResolveMerge(
    theirCommit: string,
    baseHead: string,
    resolutions: Resolution[],
  ): Promise<ResolveOutcome>;

  /**
   * Set the `origin` remote URL for the currently-open project. Also writes
   * the URL to .twriter/settings.json. Browser mode is a no-op.
   */
  configureRemote(url: string): Promise<void>;

  // --- Full-text search (desktop only) ---

  /**
   * Rebuild the open project's search index from `sections` (the frontend's
   * already-parsed section tree). Desktop wraps the `index_sections` command,
   * which runs a whole-index rebuild OFF the document save path; the browser
   * is a no-op (search is desktop-only). Best-effort: failures are swallowed
   * because the cache is rebuildable and indexing must never block the app.
   */
  indexSections(sections: SectionInput[]): Promise<void>;

  /**
   * Full-text search over the open project's indexed sections, ranked best
   * first. Desktop wraps `search_sections` (sanitized FTS5 MATCH); the browser
   * returns `[]` (search is desktop-only — callers hide the UI when not Tauri).
   * Empty / operator-only queries return `[]`.
   */
  searchSections(query: string, limit?: number): Promise<SearchHit[]>;
}
