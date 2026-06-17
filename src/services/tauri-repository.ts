// Phase 3e — TauriRepository.
//
// Implements the Phase 1b Repository interface against Tauri IPC commands.
// One project is "open" at a time on the Rust side; each `getProject(id)`
// transparently switches the open project by path. `revisions` is populated
// eagerly from the last 20 git commits — kept under the existing in-memory
// shape so the rest of the store doesn't notice the storage change.
//
// Components NEVER call `invoke()` directly; this module is the only
// JS-side speaker of the Tauri IPC vocabulary for persistence concerns.

import { invoke } from '@tauri-apps/api/core';
import type {
  ProjectMeta,
  PullOutcome,
  PushOutcome,
  Resolution,
  ResolveOutcome,
  Snapshot,
  SyncState,
} from '../types';
import type { Repository, StoredProjectData } from './repository';

/** Lightweight commit metadata returned by the Rust `snapshot_list` command. */
interface SnapshotMeta {
  id: string;
  timestamp: number;
  trigger: string;
  affectedScope: 'all' | { sectionIds: string[] };
  contentHash: string;
  message: string;
}

/** Number of commits eagerly fetched into in-memory `revisions` on project open. */
const REVISIONS_WINDOW = 20;

/**
 * Cache of `path` keyed by project `id`. `getMeta` populates it; `getProject`
 * needs the path to call `project_open`. Saves a round-trip per get.
 */
const idToPath = new Map<string, string>();

export const tauriRepository: Repository = {
  async getMeta(): Promise<ProjectMeta[]> {
    const list = await invoke<ProjectMeta[]>('project_list_recent');
    idToPath.clear();
    for (const m of list) {
      if (m.path) idToPath.set(m.id, m.path);
    }
    return list;
  },

  async setMeta(_meta: ProjectMeta[]): Promise<void> {
    // No-op under Tauri. The recent-projects DB on the Rust side is the
    // source of truth for the project list and updates implicitly via
    // project_create / project_open / project_delete_recent. The store
    // still calls setMeta after computing a new list locally; we ignore
    // it. Word counts may briefly look stale in the recent list and
    // refresh on the next project open — not user-blocking.
  },

  async getProject(id: string): Promise<StoredProjectData | null> {
    const path = idToPath.get(id);
    if (!path) {
      // Refresh the cache — the JS side may have called getProject
      // without a prior getMeta (e.g. on startup).
      const list = await this.getMeta();
      const found = list.find((m) => m.id === id);
      if (!found?.path) return null;
    }
    const resolved = idToPath.get(id);
    if (!resolved) return null;

    await invoke('project_open', { path: resolved });
    const data = await invoke<StoredProjectData>('project_read');

    // Eager-populate `revisions` from the last N git commits so the
    // existing VersionHistoryModal works without code changes.
    try {
      const metas = await invoke<SnapshotMeta[]>('snapshot_list', {
        limit: REVISIONS_WINDOW,
      });
      const revisions: Snapshot[] = [];
      for (const m of metas) {
        const full = await invoke<Snapshot>('snapshot_read', {
          commitId: m.id,
        });
        revisions.push(full);
      }
      data.revisions = revisions;
    } catch (e) {
      // A fresh project (no commits yet) returns an error from
      // snapshot_list — that's fine.
      console.warn('snapshot_list failed (probably empty repo):', e);
      data.revisions = [];
    }
    return data;
  },

  async setProject(_id: string, data: StoredProjectData): Promise<void> {
    // The store invariant: setProject is only called for the currently-
    // open project. Tauri's project_write writes against the active
    // ProjectHandle. (Switching projects is a getProject call.)
    await invoke('project_write', { data });
  },

  async deleteProject(id: string): Promise<void> {
    await invoke('project_delete_recent', { id });
    idToPath.delete(id);
    // The folder on disk is NOT deleted — the user removes it manually
    // if they want. This is intentional: a dissertation deletion should
    // never be a one-click event.
  },

  async createProjectAt(name: string, path: string): Promise<ProjectMeta> {
    // project_create scaffolds the folder (project.md, .twriter/, git init +
    // initial commit) and installs it as the current handle.
    const meta = await invoke<ProjectMeta>('project_create', { path, name });
    if (meta.path) idToPath.set(meta.id, meta.path);
    return meta;
  },

  async openProjectAt(path: string): Promise<ProjectMeta> {
    const meta = await invoke<ProjectMeta>('project_open', { path });
    if (meta.path) idToPath.set(meta.id, meta.path);
    return meta;
  },

  async cloneProject(url: string, path: string): Promise<ProjectMeta> {
    // project_clone clones with the keyring PAT, validates the layout, and
    // installs it as the current handle (or errors + cleans up the folder).
    const meta = await invoke<ProjectMeta>('project_clone', { url, path });
    if (meta.path) idToPath.set(meta.id, meta.path);
    return meta;
  },

  async commitSnapshot(
    message: string,
    trigger: 'manual' | 'autosave' | 'pre-ai-write',
    affectedScope: 'all' | { sectionIds: string[] },
  ): Promise<string> {
    return invoke<string>('snapshot_commit', {
      message,
      trigger,
      affectedScope,
    });
  },

  async migrateVeryOldLegacy(): Promise<null> {
    // The old `socratic_project_v1` key only ever existed in browser
    // localStorage. Tauri runs in a fresh webview with no shared storage
    // origin. Nothing to migrate from here.
    return null;
  },

  // --- Phase 4: sync ---

  async syncState(): Promise<SyncState> {
    return invoke<SyncState>('sync_state');
  },

  async syncPull(): Promise<PullOutcome> {
    return invoke<PullOutcome>('sync_pull');
  },

  async syncPush(): Promise<PushOutcome> {
    return invoke<PushOutcome>('sync_push');
  },

  async syncResolveMerge(
    theirCommit: string,
    baseHead: string,
    resolutions: Resolution[],
  ): Promise<ResolveOutcome> {
    return invoke<ResolveOutcome>('sync_resolve_merge', {
      theirCommit,
      baseHead,
      resolutions,
    });
  },

  async configureRemote(url: string): Promise<void> {
    await invoke('sync_configure_remote', { url });
  },
};
