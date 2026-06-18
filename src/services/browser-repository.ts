import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type {
  DiskSignature,
  MarkdownDelta,
  ProjectMeta,
  PullOutcome,
  PushOutcome,
  ResolveOutcome,
  Snapshot,
  SnapshotMeta,
  SyncState,
} from '../types';
import type { Repository, StoredProjectData } from './repository';

const STORAGE_PREFIX = 'socratic_p_';
const META_KEY = 'socratic_meta_v1';
const VERY_OLD_LEGACY_KEY = 'socratic_project_v1';

/**
 * The last project handed to `getProject`. The browser has no "open project"
 * concept on the Rust side, so the parameterless snapshot reads resolve against
 * this — keeping `listSnapshotMeta` / `readSnapshot` symmetric with Tauri.
 */
let lastOpenedId: string | null = null;

const wordCountOf = (text: string): number => {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
};

const parseIfString = <T>(value: unknown): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
};

export const browserRepository: Repository = {
  async getMeta(): Promise<ProjectMeta[]> {
    let saved = await idbGet(META_KEY);

    if (!saved) {
      const lsMeta = localStorage.getItem(META_KEY);
      if (lsMeta) {
        try {
          saved = JSON.parse(lsMeta);
          await idbSet(META_KEY, saved);
        } catch (e) {
          console.warn('Failed to parse legacy localStorage meta', e);
        }
      }
    }

    if (!saved) return [];
    const parsed = parseIfString<ProjectMeta[]>(saved);
    return Array.isArray(parsed) ? parsed : [];
  },

  async setMeta(meta: ProjectMeta[]): Promise<void> {
    await idbSet(META_KEY, meta);
  },

  async getProject(id: string): Promise<StoredProjectData | null> {
    let data: unknown = await idbGet(STORAGE_PREFIX + id);

    if (!data) {
      const raw = localStorage.getItem(STORAGE_PREFIX + id);
      if (raw) {
        try {
          data = JSON.parse(raw);
          await idbSet(STORAGE_PREFIX + id, data);
        } catch (e) {
          console.warn('Failed to parse legacy localStorage project', e);
        }
      }
    }

    if (!data) return null;
    lastOpenedId = id;
    return parseIfString<StoredProjectData>(data);
  },

  async setProject(id: string, data: StoredProjectData): Promise<void> {
    await idbSet(STORAGE_PREFIX + id, data);
  },

  async deleteProject(id: string): Promise<void> {
    await idbDel(STORAGE_PREFIX + id);
    localStorage.removeItem(STORAGE_PREFIX + id);
  },

  async createProjectAt(): Promise<ProjectMeta> {
    throw new Error('Folder-based projects require the desktop app.');
  },

  async openProjectAt(): Promise<ProjectMeta> {
    throw new Error('Folder-based projects require the desktop app.');
  },

  async cloneProject(): Promise<ProjectMeta> {
    throw new Error('Cloning from a remote requires the desktop app.');
  },

  async commitSnapshot(): Promise<null> {
    // No-op in the browser. Snapshots live as plain entries on the
    // in-memory `revisions` array (capped at 50) and are persisted via
    // setProject. The TauriRepository overrides this to make a real
    // git commit.
    return null;
  },

  async listSnapshotMeta(): Promise<SnapshotMeta[]> {
    // No git: project the stored `revisions` (full, capped at 50) to metadata.
    if (!lastOpenedId) return [];
    const proj = await browserRepository.getProject(lastOpenedId);
    return (proj?.revisions ?? []).map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      trigger: r.trigger,
      affectedScope: r.affectedScope,
      contentHash: r.contentHash,
      message: '',
    }));
  },

  async readSnapshot(id: string): Promise<Snapshot | null> {
    if (!lastOpenedId) return null;
    const proj = await browserRepository.getProject(lastOpenedId);
    return proj?.revisions?.find((r) => r.id === id) ?? null;
  },

  async migrateVeryOldLegacy() {
    const raw = localStorage.getItem(VERY_OLD_LEGACY_KEY);
    if (!raw) return null;

    try {
      const data = JSON.parse(raw) as StoredProjectData;
      const newId = `proj_${Date.now()}`;
      const meta: ProjectMeta = {
        id: newId,
        name: data.projectName || 'Migrated Project',
        lastModified: data.lastModified || Date.now(),
        wordCount: wordCountOf(data.localDraft || ''),
      };
      await idbSet(STORAGE_PREFIX + newId, data);
      return { meta, data };
    } catch (e) {
      console.error('Very-old legacy migration failed', e);
      return null;
    }
  },

  async readMarkdownIfChanged(_known: DiskSignature | null): Promise<MarkdownDelta> {
    // No filesystem in the browser; nothing can edit a file out-of-band.
    return { signature: null, content: null };
  },

  async writeExportBytes(): Promise<void> {
    throw new Error('writeExportBytes is desktop-only; the browser downloads instead.');
  },

  // --- Phase 4: sync (browser is a no-op) ---

  async syncState(): Promise<SyncState> {
    return {
      hasRemote: false,
      remoteUrl: null,
      ahead: 0,
      behind: 0,
      workingTreeDirty: false,
      branch: null,
    };
  },

  async syncPull(): Promise<PullOutcome> {
    return { kind: 'noRemote' };
  },

  async syncPush(): Promise<PushOutcome> {
    return { kind: 'noRemote' };
  },

  async syncResolveMerge(): Promise<ResolveOutcome> {
    return { kind: 'noRemote' };
  },

  async configureRemote(_url: string): Promise<void> {
    // No remote storage in the browser repository.
  },
};
