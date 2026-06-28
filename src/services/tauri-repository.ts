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
  AgentFileEntry,
  DiskSignature,
  MarkdownDelta,
  ProjectMeta,
  PullOutcome,
  PushOutcome,
  Resolution,
  ResolveOutcome,
  SearchHit,
  SectionInput,
  SessionRecord,
  Snapshot,
  SnapshotMeta,
  SyncState,
} from '../types';
import type { CommitTrailer, Repository, StoredProjectData } from './repository';

/** Number of commits eagerly fetched into in-memory `revisions` on project open. */
const REVISIONS_WINDOW = 20;

/**
 * How far back `listSnapshotMeta` reaches by default. Generous because the walk
 * is blob-free (metadata only); the Version Compare picker groups these by day.
 * If a real project ever exceeds this, a parameterless `snapshot_list_all` is a
 * trivial follow-up.
 */
const COMPARE_INDEX_LIMIT = 2000;

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

  async readMarkdownIfChanged(known: DiskSignature | null): Promise<MarkdownDelta> {
    // Reads against the currently-open project handle, like project_read.
    return invoke<MarkdownDelta>('project_read_markdown_if_changed', { known });
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
    trailers?: CommitTrailer[],
  ): Promise<string> {
    return invoke<string>('snapshot_commit', {
      message,
      trigger,
      affectedScope,
      // Omitted (undefined) for ordinary snapshots → Rust sees None.
      trailers: trailers ?? null,
    });
  },

  async createTag(tagName: string, commitId: string): Promise<void> {
    await invoke('git_create_tag', { tagName, commitId });
  },

  async listTags(pattern?: string): Promise<string[]> {
    try {
      return await invoke<string[]>('git_list_tags', { pattern: pattern ?? null });
    } catch (e) {
      console.warn('git_list_tags failed (probably empty repo):', e);
      return [];
    }
  },

  async resolveRef(refname: string): Promise<string | null> {
    try {
      return await invoke<string | null>('git_resolve_ref', { refname });
    } catch (e) {
      console.warn('git_resolve_ref failed:', e);
      return null;
    }
  },

  async wordCountDelta(fromRef: string, toRef: string): Promise<number> {
    try {
      return await invoke<number>('git_word_count_delta', { fromRef, toRef });
    } catch (e) {
      console.warn('git_word_count_delta failed:', e);
      return 0;
    }
  },

  async listSessions(): Promise<SessionRecord[]> {
    try {
      return await invoke<SessionRecord[]>('session_list');
    } catch (e) {
      console.warn('session_list failed:', e);
      return [];
    }
  },

  async saveSession(record: SessionRecord): Promise<void> {
    await invoke('session_save', { record });
  },

  async listSnapshotMeta(limit?: number): Promise<SnapshotMeta[]> {
    try {
      return await invoke<SnapshotMeta[]>('snapshot_list', {
        limit: limit ?? COMPARE_INDEX_LIMIT,
      });
    } catch (e) {
      // Fresh project (no commits) — snapshot_list errors; an empty index is fine.
      console.warn('snapshot_list failed (probably empty repo):', e);
      return [];
    }
  },

  async readSnapshot(id: string): Promise<Snapshot | null> {
    try {
      return await invoke<Snapshot>('snapshot_read', { commitId: id });
    } catch (e) {
      console.warn('snapshot_read failed:', e);
      return null;
    }
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

  // --- Full-text search ---

  async indexSections(sections: SectionInput[]): Promise<void> {
    // Best-effort: the Rust side is panic-safe and decoupled from saves, and a
    // missing/partial index only weakens search — never the document. Swallow.
    try {
      await invoke('index_sections', { sections });
    } catch (e) {
      console.warn('index_sections failed (search may be stale):', e);
    }
  },

  async searchSections(query: string, limit?: number): Promise<SearchHit[]> {
    try {
      return await invoke<SearchHit[]>('search_sections', {
        query,
        limit: limit ?? null,
      });
    } catch (e) {
      console.warn('search_sections failed:', e);
      return [];
    }
  },

  // --- Local-agent filesystem tools ---

  async agentListFiles(subdir?: string): Promise<AgentFileEntry[]> {
    try {
      return await invoke<AgentFileEntry[]>('agent_list_files', {
        subdir: subdir ?? null,
      });
    } catch (e) {
      console.warn('agent_list_files failed:', e);
      return [];
    }
  },

  async agentReadFile(path: string): Promise<string> {
    // Errors propagate: the agent loop surfaces a failed read as a tool error so
    // the model can recover, rather than silently receiving an empty file.
    return invoke<string>('agent_read_file', { path });
  },

  async agentWriteOutput(name: string, contents: string): Promise<string> {
    return invoke<string>('agent_write_output', { name, contents });
  },
};
