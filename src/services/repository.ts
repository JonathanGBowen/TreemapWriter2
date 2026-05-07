import type {
  Persona,
  PromptsConfig,
  ProjectMeta,
  Snapshot,
  TestSuite,
} from '../types';

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
   * One-time migration of the very old `socratic_project_v1` localStorage
   * key. Returns the imported meta + data, or null if nothing to migrate.
   * The caller is responsible for adding the meta to the active list.
   */
  migrateVeryOldLegacy(): Promise<{
    meta: ProjectMeta;
    data: StoredProjectData;
  } | null>;
}
