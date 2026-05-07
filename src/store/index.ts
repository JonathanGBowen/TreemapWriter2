import { create } from 'zustand';
import { DEFAULT_PROMPTS_CONFIG } from '../lib/constants';
import defaultProjectData from '../lib/defaultProject.json';
import { parseMarkdown } from '../lib/utils';
import { browserRepository as repo } from '../services/browser-repository';
import {
  Section, TestSuite, Persona, ProjectMeta, Snapshot,
  Dependency, PromptsConfig, SectionSpec, DiagnosticResult
} from '../types';

/**
 * Legacy storage keys kept exported for back-compat with App.tsx, which still
 * reaches into IndexedDB directly in a few code paths. Phase 1c removes those
 * call sites; afterward these exports can be deleted.
 *
 * @deprecated Use `browserRepository` from `src/services/browser-repository.ts`.
 */
export const STORAGE_PREFIX = 'socratic_p_';
/** @deprecated See STORAGE_PREFIX. */
export const META_KEY = 'socratic_meta_v1';

export interface AppState {
  // Project Management
  projectList: ProjectMeta[];
  activeProjectId: string | null;

  // Editor State
  markdown: string;
  projectName: string;
  testSuite: TestSuite;
  hiddenSectionIds: string[];
  localContent: string;
  lastAutoSave: Date | null;
  revisions: Snapshot[];

  // Parsed sections
  sections: Section[];

  // UI State
  sidebarWidth: number;
  testsPanelWidth: number;
  focusMode: boolean;
  selectedId: string | null;
  activeLineIndex: number | null;
  runTutorial: boolean;
  isDarkMode: boolean;

  // Modals & Process state
  showProjectModal: boolean;
  showRunModal: boolean;
  showPersonaModal: boolean;
  showSpecModal: boolean;
  showSuggestionsModal: boolean;
  showInterpolationModal: boolean;
  showPromptsGraphModal: boolean;
  showSectionMapModal: boolean;
  showProjectFileModal: boolean;
  showGoalSprintModal: boolean;
  showContentSprintModal: boolean;
  showHistoryModal: boolean;
  showGraphModal: boolean;
  showCoachModal: boolean;
  isProcessing: boolean;
  isInterpolating: boolean;

  // Advanced State
  activePersonaId: string;
  customPersonas: Persona[];
  promptsConfig: PromptsConfig;
  cachedCoachAdvice: { inputHash: string, advice: string } | null;

  // Actions
  setProjectList: (list: ProjectMeta[]) => void;
  setActiveProjectId: (id: string | null) => void;
  setLocalContent: (content: string | ((prev: string) => string)) => void;
  setSections: (sections: Section[]) => void;
  setMarkdown: (markdown: string) => void;
  setProjectName: (name: string) => void;
  setTestSuite: (suite: TestSuite | ((prev: TestSuite) => TestSuite)) => void;
  setHiddenSectionIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setRevisions: (revs: Snapshot[] | ((prev: Snapshot[]) => Snapshot[])) => void;
  setLastAutoSave: (date: Date | null) => void;
  
  // UI Actions
  setSidebarWidth: (w: number) => void;
  setTestsPanelWidth: (w: number) => void;
  setFocusMode: (mode: boolean) => void;
  setSelectedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setActiveLineIndex: (idx: number | null) => void;
  setRunTutorial: (run: boolean) => void;
  setIsDarkMode: (dark: boolean) => void;
  
  // Modal Actions
  setShowProjectModal: (show: boolean) => void;
  setShowRunModal: (show: boolean) => void;
  setShowPersonaModal: (show: boolean) => void;
  setShowSpecModal: (show: boolean) => void;
  setShowSuggestionsModal: (show: boolean) => void;
  setShowInterpolationModal: (show: boolean) => void;
  setShowPromptsGraphModal: (show: boolean) => void;
  setShowSectionMapModal: (show: boolean) => void;
  setShowProjectFileModal: (show: boolean) => void;
  setShowGoalSprintModal: (show: boolean) => void;
  setShowContentSprintModal: (show: boolean) => void;
  setShowHistoryModal: (show: boolean) => void;
  setShowGraphModal: (show: boolean) => void;
  setShowCoachModal: (show: boolean) => void;
  setIsProcessing: (proc: boolean) => void;
  setIsInterpolating: (interp: boolean) => void;

  // Advanced Actions
  setActivePersonaId: (id: string) => void;
  setCustomPersonas: (personas: Persona[] | ((prev: Persona[]) => Persona[])) => void;
  setPromptsConfig: (config: PromptsConfig) => void;
  setCachedCoachAdvice: (advice: { inputHash: string, advice: string } | null) => void;

  // Thunks / Complex Actions
  loadInitialState: () => Promise<void>;
  createDemoProject: () => Promise<void>;
  createNewProject: () => Promise<void>;
  loadProject: (id: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<void>;
  saveCurrentState: () => Promise<void>;
  createSnapshot: (trigger: Snapshot['trigger'], affectedScope?: Snapshot['affectedScope'], configOverride?: PromptsConfig) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Project Management
  projectList: [],
  activeProjectId: null,

  // Editor State
  markdown: '',
  projectName: 'Untitled Project',
  testSuite: {},
  hiddenSectionIds: [],
  localContent: '',
  lastAutoSave: null,
  revisions: [],
  sections: [],

  // UI State
  sidebarWidth: 320,
  testsPanelWidth: 350,
  focusMode: true,
  selectedId: null,
  activeLineIndex: null,
  runTutorial: false,
  isDarkMode: true,

  // Modals & Process state
  showProjectModal: false,
  showRunModal: false,
  showPersonaModal: false,
  showSpecModal: false,
  showSuggestionsModal: false,
  showInterpolationModal: false,
  showPromptsGraphModal: false,
  showSectionMapModal: false,
  showProjectFileModal: false,
  showGoalSprintModal: false,
  showContentSprintModal: false,
  showHistoryModal: false,
  showGraphModal: false,
  showCoachModal: false,
  isProcessing: false,
  isInterpolating: false,

  // Advanced State
  activePersonaId: 'default',
  customPersonas: [],
  promptsConfig: DEFAULT_PROMPTS_CONFIG,
  cachedCoachAdvice: null,

  // Simple Setters
  setProjectList: (list) => set({ projectList: list }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setLocalContent: (content) => set((state) => ({ localContent: typeof content === 'function' ? content(state.localContent) : content })),
  setSections: (sections) => set({ sections }),
  setMarkdown: (markdown) => set({ markdown }),
  setProjectName: (name) => set({ projectName: name }),
  setTestSuite: (suite) => set((state) => ({ testSuite: typeof suite === 'function' ? suite(state.testSuite) : suite })),
  setHiddenSectionIds: (ids) => set((state) => ({ hiddenSectionIds: typeof ids === 'function' ? ids(state.hiddenSectionIds) : ids })),
  setRevisions: (revs) => set((state) => ({ revisions: typeof revs === 'function' ? revs(state.revisions) : revs })),
  setLastAutoSave: (date) => set({ lastAutoSave: date }),
  
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setTestsPanelWidth: (w) => set({ testsPanelWidth: w }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setSelectedId: (id) => set((state) => ({ selectedId: typeof id === 'function' ? id(state.selectedId) : id })),
  setActiveLineIndex: (idx) => set({ activeLineIndex: idx }),
  setRunTutorial: (run) => set({ runTutorial: run }),
  setIsDarkMode: (dark) => set({ isDarkMode: dark }),

  setShowProjectModal: (show) => set({ showProjectModal: show }),
  setShowRunModal: (show) => set({ showRunModal: show }),
  setShowPersonaModal: (show) => set({ showPersonaModal: show }),
  setShowSpecModal: (show) => set({ showSpecModal: show }),
  setShowSuggestionsModal: (show) => set({ showSuggestionsModal: show }),
  setShowInterpolationModal: (show) => set({ showInterpolationModal: show }),
  setShowPromptsGraphModal: (show) => set({ showPromptsGraphModal: show }),
  setShowSectionMapModal: (show) => set({ showSectionMapModal: show }),
  setShowProjectFileModal: (show) => set({ showProjectFileModal: show }),
  setShowGoalSprintModal: (show) => set({ showGoalSprintModal: show }),
  setShowContentSprintModal: (show) => set({ showContentSprintModal: show }),
  setShowHistoryModal: (show) => set({ showHistoryModal: show }),
  setShowGraphModal: (show) => set({ showGraphModal: show }),
  setShowCoachModal: (show) => set({ showCoachModal: show }),
  setIsProcessing: (proc) => set({ isProcessing: proc }),
  setIsInterpolating: (interp) => set({ isInterpolating: interp }),

  setActivePersonaId: (id) => set({ activePersonaId: id }),
  setCustomPersonas: (personas) => set((state) => ({ customPersonas: typeof personas === 'function' ? personas(state.customPersonas) : personas })),
  setPromptsConfig: (config) => set({ promptsConfig: config }),
  setCachedCoachAdvice: (advice) => set({ cachedCoachAdvice: advice }),

  // Thunks
  loadInitialState: async () => {
    let meta: ProjectMeta[];
    try {
      meta = await repo.getMeta();
    } catch (e) {
      console.warn("Meta load fail", e);
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
        meta = meta.filter(p => p.id !== projMeta.id);
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
    const newName = defaultProjectData.projectName || "Socratic Demo";
    
    set({
      projectName: newName,
      markdown: defaultProjectData.markdown || "",
      localContent: defaultProjectData.localDraft || defaultProjectData.markdown || "",
      testSuite: defaultProjectData.testSuite || {},
      hiddenSectionIds: defaultProjectData.hiddenSectionIds || [],
      activePersonaId: defaultProjectData.activePersonaId || 'default',
      customPersonas: defaultProjectData.customPersonas || [],
      promptsConfig: defaultProjectData.promptsConfig || DEFAULT_PROMPTS_CONFIG,
      cachedCoachAdvice: defaultProjectData.cachedCoachAdvice || null,
      selectedId: null,
      activeLineIndex: null,
      activeProjectId: newId,
      lastAutoSave: null,
      revisions: defaultProjectData.revisions || [],
    });

    const uiState: any = (defaultProjectData as any).uiState;
    if (uiState) {
      set({
        sidebarWidth: uiState.sidebarWidth || get().sidebarWidth,
        testsPanelWidth: uiState.testsPanelWidth || get().testsPanelWidth,
        focusMode: uiState.focusMode !== undefined ? uiState.focusMode : get().focusMode,
        selectedId: uiState.selectedSectionId || get().selectedId,
      });
    }

    await get().saveCurrentState();
  },

  createNewProject: async () => {
    const newId = `proj_${Date.now()}`;
    const newName = "Untitled Project";
    
    set({
      projectName: newName,
      markdown: "",
      localContent: "",
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
    });

    await get().saveCurrentState();
  },

  loadProject: async (id: string) => {
    try {
      const data = await repo.getProject(id);
      if (!data) throw new Error("Project data not found");

      const loadedTestSuite: TestSuite = data.testSuite || {};
      Object.keys(loadedTestSuite).forEach(key => {
        const entry = loadedTestSuite[key];
        // Migrate legacy `dependencies: string[]` → `dependencies: Dependency[]`.
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
        projectName: data.projectName || "Untitled",
        markdown: data.markdown || "",
        localContent: data.localDraft !== undefined ? data.localDraft : (data.markdown || ""),
        testSuite: loadedTestSuite,
        hiddenSectionIds: data.hiddenSectionIds || [],
        lastAutoSave: data.lastModified ? new Date(data.lastModified) : null,
        revisions: (data.revisions || []).map((r: any) => ({
          ...r,
          markdown: r.markdown || r.content || "",
          testSuite: r.testSuite || {},
        })),
        activePersonaId: data.activePersonaId || 'default',
        customPersonas: Array.isArray(data.customPersonas) ? data.customPersonas : [],
        promptsConfig: data.promptsConfig ? {...DEFAULT_PROMPTS_CONFIG, ...data.promptsConfig} : (data.interpolationConfig ? {...DEFAULT_PROMPTS_CONFIG, ...data.interpolationConfig} : DEFAULT_PROMPTS_CONFIG),
        cachedCoachAdvice: data.cachedCoachAdvice || null,
      });

      if (data.uiState) {
        set({
          sidebarWidth: data.uiState.sidebarWidth || get().sidebarWidth,
          testsPanelWidth: data.uiState.testsPanelWidth || get().testsPanelWidth,
          focusMode: data.uiState.focusMode !== undefined ? data.uiState.focusMode : get().focusMode,
          selectedId: data.uiState.selectedSectionId || get().selectedId,
          activeLineIndex: data.uiState.activeLineIndex !== undefined ? data.uiState.activeLineIndex : get().activeLineIndex,
        });
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  deleteProject: async (id: string) => {
    await repo.deleteProject(id);

    const currentList = Array.isArray(get().projectList) ? get().projectList : [];
    const updatedMeta = currentList.filter(p => p.id !== id);
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
        activeLineIndex: state.activeLineIndex
      }
    };
     
    await repo.setProject(state.activeProjectId, data);

    const wordCount = state.localContent.trim() === '' ? 0 : state.localContent.trim().split(/\s+/).length;
    const metaEntry: ProjectMeta = {
      id: state.activeProjectId,
      name: state.projectName,
      lastModified: Date.now(),
      wordCount
    };

    const currentList = Array.isArray(state.projectList) ? state.projectList : [];
    const others = currentList.filter(p => p.id !== state.activeProjectId);
    const updated = [metaEntry, ...others];
    set({ projectList: updated, lastAutoSave: new Date() });
    repo.setMeta(updated).catch(console.error);
  },

  createSnapshot: async (trigger, affectedScope = 'all', configOverride) => {
    const state = get();
    if (!state.activeProjectId) return;
    
    const hashString = async (str: string) => {
      const msgUint8 = new TextEncoder().encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const stateString = JSON.stringify({ markdown: state.localContent, testSuite: state.testSuite, interpolationConfig: configOverride || state.promptsConfig });
    const contentHash = await hashString(stateString);
    
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
      interpolationConfig: configOverride || state.promptsConfig
    };
    const newRevisions = [newSnapshot, ...prev].slice(0, 50);
    set({ revisions: newRevisions });
    await get().saveCurrentState();
  }
}));
