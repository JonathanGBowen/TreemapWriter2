import type {
  Persona,
  PromptsConfig,
  ProjectMeta,
  PullOutcome,
  PushOutcome,
  Resolution,
  ResolveOutcome,
  Snapshot,
  SyncState,
  TestSuite,
} from '../types';
import type { ModelConfig } from './ai/model-types';

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
  promptsConfig?: PromptsConfig;
  /** Pre-Phase-1 alias of promptsConfig. Honor on read; do not write. */
  interpolationConfig?: PromptsConfig;
  /** Per-project, per-call model overrides. Sparse; resolves against the global default. */
  modelsConfig?: ModelConfig;
  cachedCoachAdvice?: { inputHash: string; advice: string } | null;
  revisions?: Snapshot[];
  lastModified?: number;
  uiState?: {
    sidebarWidth?: number;
    testsPanelWidth?: number;
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
  ): Promise<string | null>;

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
}
