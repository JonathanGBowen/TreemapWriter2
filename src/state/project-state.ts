import type { StateCreator } from 'zustand';
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import { DEFAULT_PROMPTS_CONFIG } from '../lib/constants';
import defaultProjectData from '../lib/defaultProject.json';
import { repository as repo } from '../services/repository-registry';
import { isTauri } from '../services/tauri-environment';
import type { Dependency, ProjectMeta, PromptsConfig, Snapshot, TestSuite } from '../types';
import type { AppState } from '.';

/**
 * Project lifecycle: which project is open, which projects exist, and the
 * thunks that load, save, snapshot, and delete them.
 *
 * The thunks coordinate writes across other slices (document, editor, ai)
 * by calling `get()` and `set()` against the full `AppState`. They are the
 * only place in the codebase that knows the on-disk project schema; the
 * rest of the app talks to in-memory slices.
 *
 * Persistence is delegated to a `Repository`. To swap IndexedDB for SQLite
 * (Phase 3) you replace `browserRepository` with a `tauriRepository`; no
 * other code changes.
 */
export interface ProjectStateSlice {
  projectList: ProjectMeta[];
  activeProjectId: string | null;
  projectName: string;
  /**
   * Desktop: true once the active project is backed by a real on-disk handle
   * (created or opened via a folder). The first-launch demo is an in-memory
   * preview with this false, so autosave/snapshot writes are suppressed until
   * the user creates or opens a real project. Browser persistence ignores it.
   */
  hasOpenProject: boolean;

  setProjectList: (list: ProjectMeta[]) => void;
  setActiveProjectId: (id: string | null) => void;
  setProjectName: (name: string) => void;

  loadInitialState: () => Promise<void>;
  createDemoProject: () => Promise<void>;
  createNewProject: () => Promise<void>;
  /** Desktop: pick an existing project folder and open it. Browser: no-op. */
  openExistingProject: () => Promise<void>;
  loadProject: (id: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<void>;
  saveCurrentState: () => Promise<void>;
  createSnapshot: (
    trigger: Snapshot['trigger'],
    affectedScope?: Snapshot['affectedScope'],
    configOverride?: PromptsConfig,
  ) => Promise<void>;

  /**
   * Restore a snapshot from the revisions list. Replaces working draft +
   * committed markdown + testSuite, optionally restores promptsConfig, and
   * triggers a save. Cross-slice, hence here.
   */
  restoreSnapshot: (snapshot: Snapshot) => Promise<void>;
}

const sha256Hex = async (str: string): Promise<string> => {
  const bytes = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/** Derive a project name from the trailing segment of a folder path. */
const folderName = (p: string): string =>
  p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'Untitled Project';

/**
 * Desktop create/open flow: pick a folder, scaffold (project_create) or open
 * (project_open) it — both establish the Rust project handle — then load it.
 * Shared by createNewProject and openExistingProject.
 */
async function createFolderProject(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  mode: 'create' | 'open',
): Promise<void> {
  let selected: string | string[] | null;
  try {
    selected = await openFolderDialog({
      directory: true,
      multiple: false,
      title:
        mode === 'create'
          ? 'Choose an empty folder for your new project'
          : 'Open a TreemapWriter project folder',
    });
  } catch (e) {
    console.error('folder picker failed', e);
    toast.error('Could not open the folder picker.');
    return;
  }
  const folder = Array.isArray(selected) ? selected[0] : selected;
  if (!folder) return; // user cancelled the dialog

  try {
    const meta =
      mode === 'create'
        ? await repo.createProjectAt(folderName(folder), folder)
        : await repo.openProjectAt(folder);
    // Refresh the recent list (also repopulates the id→path cache) and load.
    set({ projectList: await repo.getMeta() });
    const ok = await get().loadProject(meta.id);
    if (ok) {
      toast.success(mode === 'create' ? `Created "${meta.name}".` : `Opened "${meta.name}".`);
    } else {
      toast.error('Project handle opened but its data could not be loaded.');
    }
  } catch (e) {
    const msg = String((e as { message?: string })?.message || e || 'Unknown error');
    toast.error(`${mode === 'create' ? 'Create' : 'Open'} failed: ${msg}`);
  }
}

export const createProjectStateSlice: StateCreator<AppState, [], [], ProjectStateSlice> = (set, get) => ({
  projectList: [],
  activeProjectId: null,
  projectName: 'Untitled Project',
  hasOpenProject: false,

  setProjectList: (list) => set({ projectList: list }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setProjectName: (name) => set({ projectName: name }),

  loadInitialState: async () => {
    let meta: ProjectMeta[];
    try {
      meta = await repo.getMeta();
    } catch (e) {
      console.warn('Meta load fail', e);
      meta = [];
    }

    if (meta.length === 0) {
      const migrated = await repo.migrateVeryOldLegacy();
      if (migrated) {
        meta.push(migrated.meta);
        await repo.setMeta(meta);
      }
    }

    set({ projectList: meta });

    if (meta.length > 0) {
      const sorted = [...meta].sort((a, b) => b.lastModified - a.lastModified);
      let loaded = false;
      for (const projMeta of sorted) {
        loaded = await get().loadProject(projMeta.id);
        if (loaded) break;
        meta = meta.filter((p) => p.id !== projMeta.id);
        set({ projectList: meta });
        await repo.setMeta(meta);
      }
      if (!loaded) await get().createDemoProject();
    } else {
      await get().createDemoProject();
    }
  },

  createDemoProject: async () => {
    const newId = `proj_${Date.now()}`;
    const newName = defaultProjectData.projectName || 'Socratic Demo';

    set({
      projectName: newName,
      markdown: defaultProjectData.markdown || '',
      localContent: defaultProjectData.localDraft || defaultProjectData.markdown || '',
      testSuite: (defaultProjectData.testSuite as TestSuite) || {},
      hiddenSectionIds: defaultProjectData.hiddenSectionIds || [],
      activePersonaId: defaultProjectData.activePersonaId || 'default',
      customPersonas: defaultProjectData.customPersonas || [],
      promptsConfig: (defaultProjectData.promptsConfig as PromptsConfig) || DEFAULT_PROMPTS_CONFIG,
      cachedCoachAdvice: defaultProjectData.cachedCoachAdvice || null,
      selectedId: null,
      activeLineIndex: null,
      activeProjectId: newId,
      lastAutoSave: null,
      revisions: (defaultProjectData.revisions as Snapshot[]) || [],
      // Browser persists to IndexedDB; desktop shows the demo as an unsaved
      // preview until the user creates/opens a real folder-backed project.
      hasOpenProject: !isTauri(),
    });

    const uiState = (defaultProjectData as { uiState?: {
      sidebarWidth?: number;
      testsPanelWidth?: number;
      focusMode?: boolean;
      selectedSectionId?: string | null;
    } }).uiState;
    if (uiState) {
      set({
        sidebarWidth: uiState.sidebarWidth || get().sidebarWidth,
        testsPanelWidth: uiState.testsPanelWidth || get().testsPanelWidth,
        focusMode: uiState.focusMode !== undefined ? uiState.focusMode : get().focusMode,
        selectedId: uiState.selectedSectionId || get().selectedId,
      });
    }

    // Desktop demo is an unsaved preview (no open handle yet); only the
    // browser path persists.
    if (!isTauri()) await get().saveCurrentState();
  },

  createNewProject: async () => {
    // Desktop: a project is a real folder on disk. Pick one, scaffold it via
    // project_create (which opens the handle), then load it.
    if (isTauri()) {
      await createFolderProject(get, set, 'create');
      return;
    }

    // Browser: an in-memory project persisted to IndexedDB.
    const newId = `proj_${Date.now()}`;
    set({
      projectName: 'Untitled Project',
      markdown: '',
      localContent: '',
      testSuite: {},
      hiddenSectionIds: [],
      activePersonaId: 'default',
      customPersonas: [],
      promptsConfig: DEFAULT_PROMPTS_CONFIG,
      cachedCoachAdvice: null,
      selectedId: null,
      activeLineIndex: null,
      activeProjectId: newId,
      lastAutoSave: null,
      revisions: [],
      hasOpenProject: true,
    });

    await get().saveCurrentState();
  },

  openExistingProject: async () => {
    if (!isTauri()) return;
    await createFolderProject(get, set, 'open');
  },

  loadProject: async (id: string) => {
    try {
      const data = await repo.getProject(id);
      if (!data) throw new Error('Project data not found');

      const loadedTestSuite: TestSuite = data.testSuite || {};
      Object.keys(loadedTestSuite).forEach((key) => {
        const entry = loadedTestSuite[key];
        const legacyDeps = entry.dependencies as unknown as (string | Dependency)[] | undefined;
        if (legacyDeps && legacyDeps.length > 0 && typeof legacyDeps[0] === 'string') {
          entry.dependencies = (legacyDeps as string[]).map((depId): Dependency => ({
            id: depId,
            type: 'prerequisite',
          }));
        }
      });

      set({
        activeProjectId: id,
        hasOpenProject: true,
        projectName: data.projectName || 'Untitled',
        markdown: data.markdown || '',
        localContent: data.localDraft !== undefined ? data.localDraft : data.markdown || '',
        testSuite: loadedTestSuite,
        hiddenSectionIds: data.hiddenSectionIds || [],
        lastAutoSave: data.lastModified ? new Date(data.lastModified) : null,
        revisions: (data.revisions || []).map((r) => ({
          ...r,
          markdown: r.markdown || '',
          testSuite: r.testSuite || {},
        })),
        activePersonaId: data.activePersonaId || 'default',
        customPersonas: Array.isArray(data.customPersonas) ? data.customPersonas : [],
        promptsConfig: data.promptsConfig
          ? { ...DEFAULT_PROMPTS_CONFIG, ...data.promptsConfig }
          : data.interpolationConfig
            ? { ...DEFAULT_PROMPTS_CONFIG, ...data.interpolationConfig }
            : DEFAULT_PROMPTS_CONFIG,
        cachedCoachAdvice: data.cachedCoachAdvice || null,
      });

      if (data.uiState) {
        set({
          sidebarWidth: data.uiState.sidebarWidth || get().sidebarWidth,
          testsPanelWidth: data.uiState.testsPanelWidth || get().testsPanelWidth,
          focusMode: data.uiState.focusMode !== undefined ? data.uiState.focusMode : get().focusMode,
          selectedId: data.uiState.selectedSectionId || get().selectedId,
          activeLineIndex:
            data.uiState.activeLineIndex !== undefined ? data.uiState.activeLineIndex : get().activeLineIndex,
        });
      }
      return true;
    } catch {
      return false;
    }
  },

  deleteProject: async (id: string) => {
    await repo.deleteProject(id);

    const currentList = Array.isArray(get().projectList) ? get().projectList : [];
    const updatedMeta = currentList.filter((p) => p.id !== id);
    set({ projectList: updatedMeta });
    await repo.setMeta(updatedMeta);

    if (get().activeProjectId === id) {
      if (updatedMeta.length > 0) {
        let loaded = false;
        for (const p of updatedMeta) {
          loaded = await get().loadProject(p.id);
          if (loaded) break;
        }
        if (!loaded) await get().createDemoProject();
      } else {
        await get().createDemoProject();
      }
    }
  },

  saveCurrentState: async () => {
    const state = get();
    if (!state.activeProjectId) return;
    // Desktop: the demo preview has no on-disk handle; writing would fail with
    // "no project is currently open". Skip until a real project is created/opened.
    if (isTauri() && !state.hasOpenProject) return;
    // Phase 5: while a merge awaits in-app resolution, suppress disk writes so
    // the working tree stays clean (a dirty tree trips resolve()'s Stale guard).
    // In-progress edits remain in editor-state and flush once the merge resolves.
    if (state.pendingMerge) return;

    const data = {
      projectName: state.projectName,
      markdown: state.markdown,
      localDraft: state.localContent,
      testSuite: state.testSuite,
      hiddenSectionIds: state.hiddenSectionIds,
      activePersonaId: state.activePersonaId,
      customPersonas: state.customPersonas,
      promptsConfig: state.promptsConfig,
      cachedCoachAdvice: state.cachedCoachAdvice,
      revisions: state.revisions,
      lastModified: Date.now(),
      uiState: {
        sidebarWidth: state.sidebarWidth,
        testsPanelWidth: state.testsPanelWidth,
        focusMode: state.focusMode,
        selectedSectionId: state.selectedId,
        activeLineIndex: state.activeLineIndex,
      },
    };

    await repo.setProject(state.activeProjectId, data);

    const wordCount = state.localContent.trim() === '' ? 0 : state.localContent.trim().split(/\s+/).length;
    const metaEntry: ProjectMeta = {
      id: state.activeProjectId,
      name: state.projectName,
      lastModified: Date.now(),
      wordCount,
    };

    const currentList = Array.isArray(state.projectList) ? state.projectList : [];
    const others = currentList.filter((p) => p.id !== state.activeProjectId);
    const updated = [metaEntry, ...others];
    set({ projectList: updated, lastAutoSave: new Date() });
    repo.setMeta(updated).catch(console.error);
  },

  createSnapshot: async (trigger, affectedScope = 'all', configOverride) => {
    const state = get();
    if (!state.activeProjectId) return;
    // Desktop demo preview has no on-disk handle to commit against.
    if (isTauri() && !state.hasOpenProject) return;
    // Phase 5: don't land new commits while a merge is pending resolution —
    // a moving HEAD would invalidate the conflict data the modal is showing.
    if (state.pendingMerge) return;

    const stateString = JSON.stringify({
      markdown: state.localContent,
      testSuite: state.testSuite,
      interpolationConfig: configOverride || state.promptsConfig,
    });
    const contentHash = await sha256Hex(stateString);

    const prev = state.revisions;
    const last = prev.length > 0 ? prev[0] : null;
    if (last && last.contentHash === contentHash) {
      return;
    }

    const newSnapshot: Snapshot = {
      id: `snap_${Date.now()}`,
      timestamp: Date.now(),
      trigger,
      affectedScope,
      contentHash,
      markdown: state.localContent,
      testSuite: JSON.parse(JSON.stringify(state.testSuite)),
      interpolationConfig: configOverride || state.promptsConfig,
    };
    const newRevisions = [newSnapshot, ...prev].slice(0, 50);
    set({ revisions: newRevisions });
    await get().saveCurrentState();

    // Under Tauri, mark the version as a real git commit. No-op in the
    // browser. The message format mirrors the in-memory Snapshot's
    // metadata so that snapshot_list can reconstruct it.
    try {
      const message = configOverride
        ? `${trigger} with config override`
        : `${trigger} @ ${new Date(newSnapshot.timestamp).toISOString()}`;
      const commitId = await repo.commitSnapshot(message, trigger, affectedScope);
      if (commitId) {
        // Replace the synthetic id with the real commit OID so future
        // restores resolve correctly under Tauri.
        set((s) => ({
          revisions: s.revisions.map((r) =>
            r.id === newSnapshot.id ? { ...r, id: commitId, contentHash: commitId } : r,
          ),
        }));
      }
    } catch (e) {
      console.warn('commitSnapshot failed (browser mode is no-op; this is a Tauri error):', e);
    }
  },

  restoreSnapshot: async (snapshot) => {
    set({
      localContent: snapshot.markdown,
      markdown: snapshot.markdown,
      testSuite: snapshot.testSuite || {},
    });
    if (snapshot.interpolationConfig) {
      set({ promptsConfig: snapshot.interpolationConfig });
    }
    if (get().activeProjectId) {
      await get().saveCurrentState();
    }
  },
});
