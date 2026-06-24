import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { Sidebar } from "./features/sidebar/Sidebar";
import { EditorPanel } from "./features/editor/EditorPanel";
import { TestsPanel } from "./features/tests-panel/TestsPanel";
import { TestRunnerModal } from "./features/modals/TestRunnerModal";
import { PersonaSettingsModal } from "./features/modals/PersonaSettingsModal";
import { GrimoireModal } from "./features/modals/GrimoireModal";
import { SpecGeneratorModal } from "./features/modals/SpecGeneratorModal";
import { SprintModal } from "./features/modals/sprint/SprintModal";
import { ProjectManagerModal } from "./features/modals/ProjectManagerModal";
import { VersionHistoryModal } from "./features/modals/VersionHistoryModal";
import { CommandPaletteModal, type Command } from "./features/modals/CommandPaletteModal";
import { DependencyGraphModal } from "./features/modals/DependencyGraphModal";
import { PromptsGraphModal } from "./features/modals/PromptsGraphModal";
import { SectionMapModal } from "./features/modals/SectionMapModal";
import { CoachModal } from "./features/modals/CoachModal";
import { ProjectFileModal } from "./features/modals/ProjectFileModal";
import { ConfirmModal } from "./features/modals/ConfirmModal";
import { Tutorial } from "./features/tutorial/Tutorial";
import { RevisionWorkspace } from "./features/revision/RevisionWorkspace";
import { RevisionSettingsModal } from "./features/modals/RevisionSettingsModal";
import { CompareWorkspace } from "./features/compare/CompareWorkspace";
import { ClimateWorkspace } from "./features/climate/ClimateWorkspace";
import { InterpolateWorkspace } from "./features/interpolate/InterpolateWorkspace";
import { DashboardWorkspace } from "./features/dashboard/DashboardWorkspace";
import { ParallelWorkspace } from "./features/parallel/ParallelWorkspace";
import { ParallelSettingsModal } from "./features/modals/ParallelSettingsModal";
import { GistWorkspace } from "./features/gist/GistWorkspace";
import { GistSettingsModal } from "./features/modals/GistSettingsModal";
import { SessionModal } from "./features/modals/SessionModal";
import { MigrationModal } from "./features/migration/MigrationModal";
import { SyncConfigModal } from "./features/modals/SyncConfigModal";
import { ConflictResolutionModal } from "./features/modals/ConflictResolutionModal";
import { ExternalChangeModal } from "./features/modals/ExternalChangeModal";
import { RemoteProjectModal } from "./features/modals/RemoteProjectModal";
import { AgentTraceModal } from "./features/modals/AgentTraceModal";
import { useLegacyMigration } from "./features/migration/use-legacy-migration";
import { parseMarkdown, flattenSectionsForIndex } from "./lib/utils";
import { repository } from "./services/repository-registry";
import { selectSpecMap } from "./lib/spec-map";
import { createMarkdownExport } from "./lib/markdownExport";
import { buildProjectExport } from "./lib/projectExport";
import { normalizePromptsConfig } from "./lib/constants";
import type { ModelChoice } from "./services/ai/model-types";
import defaultProjectData from "./lib/defaultProject.json";
import { Section, TestSuite, ProjectMeta, Snapshot,
  Dependency, PromptsConfig,
  SectionSpec, DiagnosticResult, ReadingMode
} from "./types";
import { repository as repo } from './services/repository-registry';
import { hasSeenTutorial, markTutorialSeen } from './services/preferences';
import { DEFAULT_PERSONAS } from './lib/defaultPersonas';
import { aiProvider } from './services/ai-provider-registry';
import { guardContextFit } from './features/shared/context-guard';
import { notifyAiError } from './features/shared/ai-error';
import { diagnosticToStatus, specFromLegacyGoals } from './lib/diagnostic-helpers';
import { initSyncPolicy, teardownSyncPolicy } from './services/sync-policy';
import { isTauri } from './services/tauri-environment';
import { useStore } from './store';
import { useShallow } from 'zustand/react/shallow';

const DEFAULT_INTERPOLATION_PROMPT = `Act as a Logician. Analyze this document structure. Define rigorous specifications and goals for every section. Ensure logical coherence and argumentative depth.`;

const findSection = (nodes: Section[], id: string): Section | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findSection(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findSectionByLine = (nodes: Section[], line: number): Section | null => {
  for (const node of nodes) {
    if (node.startLine === line) return node;
    if (node.children) {
      const found = findSectionByLine(node.children, line);
      if (found) return found;
    }
  }
  return null;
};

export const App = () => {
  const {
    projectList, activeProjectId, hasOpenProject, markdown, projectName, testSuite, hiddenSectionIds,
    localContent, lastAutoSave, revisions, sections, sidebarWidth, testsPanelWidth,
    focusMode, selectedId, activeLineIndex, runTutorial, showProjectModal,
    showRunModal, showPersonaModal, showSpecModal,
    showPromptsGraphModal, showSectionMapModal, showProjectFileModal,
    showHistoryModal, showGraphModal, showCoachModal, isProcessing,
    activePersonaId, customPersonas, promptsConfig, cachedCoachAdvice,
    
    setLocalContent, setSections, setMarkdown, setProjectName, setTestSuite, setHiddenSectionIds,
    setSelectedId, setActiveLineIndex, setRunTutorial, setSidebarWidth,
    setTestsPanelWidth, setFocusMode, setShowProjectModal, setShowRunModal, setShowPersonaModal,
    setShowSpecModal, setShowPromptsGraphModal,
    setShowSectionMapModal, setShowProjectFileModal,
    setShowHistoryModal, setShowGraphModal, setShowCoachModal, setIsProcessing,
    setActivePersonaId, setCustomPersonas, setPromptsConfig, setCachedCoachAdvice,
    
    loadInitialState, createDemoProject, createNewProject, openExistingProject, loadProject, switchProject, deleteProject,
    saveCurrentState, createSnapshot, setRevisions, updateSectionGoals
  } = useStore(useShallow(state => ({
    projectList: state.projectList,
    activeProjectId: state.activeProjectId,
    hasOpenProject: state.hasOpenProject,
    markdown: state.markdown,
    projectName: state.projectName,
    testSuite: state.testSuite,
    hiddenSectionIds: state.hiddenSectionIds,
    localContent: state.localContent,
    lastAutoSave: state.lastAutoSave,
    revisions: state.revisions,
    sections: state.sections,
    sidebarWidth: state.sidebarWidth,
    testsPanelWidth: state.testsPanelWidth,
    focusMode: state.focusMode,
    selectedId: state.selectedId,
    activeLineIndex: state.activeLineIndex,
    runTutorial: state.runTutorial,
    showProjectModal: state.showProjectModal,
    showRunModal: state.showRunModal,
    showPersonaModal: state.showPersonaModal,
    showSpecModal: state.showSpecModal,
    showPromptsGraphModal: state.showPromptsGraphModal,
    showSectionMapModal: state.showSectionMapModal,
    showProjectFileModal: state.showProjectFileModal,
    showHistoryModal: state.showHistoryModal,
    showGraphModal: state.showGraphModal,
    showCoachModal: state.showCoachModal,
    isProcessing: state.isProcessing,
    activePersonaId: state.activePersonaId,
    customPersonas: state.customPersonas,
    promptsConfig: state.promptsConfig,
    cachedCoachAdvice: state.cachedCoachAdvice,
    
    setLocalContent: state.setLocalContent,
    setSections: state.setSections,
    setMarkdown: state.setMarkdown,
    setProjectName: state.setProjectName,
    setTestSuite: state.setTestSuite,
    setHiddenSectionIds: state.setHiddenSectionIds,
    setRevisions: state.setRevisions,
    setSelectedId: state.setSelectedId,
    setActiveLineIndex: state.setActiveLineIndex,
    setRunTutorial: state.setRunTutorial,
    setSidebarWidth: state.setSidebarWidth,
    setTestsPanelWidth: state.setTestsPanelWidth,
    setFocusMode: state.setFocusMode,
    setShowProjectModal: state.setShowProjectModal,
    setShowRunModal: state.setShowRunModal,
    setShowPersonaModal: state.setShowPersonaModal,
    setShowSpecModal: state.setShowSpecModal,
    setShowPromptsGraphModal: state.setShowPromptsGraphModal,
    setShowSectionMapModal: state.setShowSectionMapModal,
    setShowProjectFileModal: state.setShowProjectFileModal,
    setShowHistoryModal: state.setShowHistoryModal,
    setShowGraphModal: state.setShowGraphModal,
    setShowCoachModal: state.setShowCoachModal,
    setIsProcessing: state.setIsProcessing,
    setActivePersonaId: state.setActivePersonaId,
    setCustomPersonas: state.setCustomPersonas,
    setPromptsConfig: state.setPromptsConfig,
    setCachedCoachAdvice: state.setCachedCoachAdvice,
    
    loadInitialState: state.loadInitialState,
    createDemoProject: state.createDemoProject,
    createNewProject: state.createNewProject,
    openExistingProject: state.openExistingProject,
    loadProject: state.loadProject,
    switchProject: state.switchProject,
    deleteProject: state.deleteProject,
    saveCurrentState: state.saveCurrentState,
    createSnapshot: state.createSnapshot,
    // Domain mutator lives in document-state; modals/panels share this one
    // codepath (snapshot-on-ai-write + history) rather than a component-local copy.
    updateSectionGoals: state.updateSectionGoals
  })));

  const activeLineIndexRef = useRef<number | null>(activeLineIndex);
  
  useEffect(() => {
    activeLineIndexRef.current = activeLineIndex;
  }, [activeLineIndex]);

  useEffect(() => {
    hasSeenTutorial().then(seen => {
      if (!seen) {
        setTimeout(() => setRunTutorial(true), 1000);
      }
    });
  }, []);

  const handleTutorialFinish = () => {
    setRunTutorial(false);
    markTutorialSeen();
  };
  
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});

  const requestConfirm = (message: string, onConfirmAction: () => void) => {
    setConfirmState({
      isOpen: true,
      message,
      onConfirm: () => {
         onConfirmAction();
         setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const isFirstRender = useRef(true);
  // Guards the 60s autosave against overlapping itself: a save that runs long
  // (slow disk, git commit, network) must not let the next tick fire a second
  // concurrent write to the same project file and clobber the first.
  const isAutoSavingRef = useRef(false);

  // Auto-open the migration modal on first Tauri launch when there are
  // legacy projects to import. The hook does the detection; we just react
  // to its `shouldPrompt` flag.
  const legacyDetection = useLegacyMigration();
  const setShowMigrationModal = useStore(s => s.setShowMigrationModal);
  useEffect(() => {
    if (legacyDetection.shouldPrompt) setShowMigrationModal(true);
  }, [legacyDetection.shouldPrompt, setShowMigrationModal]);

  // Phase 4e — bootstrap sync-policy when a project becomes active; tear
  // down on switch/close so timers and event listeners don't leak.
  useEffect(() => {
    // Desktop demo preview has no on-disk handle; sync_state would error.
    if (!activeProjectId || (isTauri() && !hasOpenProject)) {
      teardownSyncPolicy();
      return;
    }
    void initSyncPolicy().catch((e) => {
      console.error('Sync initialization failed', e);
      const ui = useStore.getState();
      ui.setSyncStatus('error');
      ui.setSyncError('Sync failed to start — check the remote connection.');
    });
    return () => {
      teardownSyncPolicy();
    };
  }, [activeProjectId, hasOpenProject]);

  // --- INITIALIZATION & MIGRATION ---
  useEffect(() => {
    // Hydrate global AI prefs (default model, editable catalog, Ollama URL) and
    // refresh the Ollama catalog. Non-blocking; independent of project load.
    void useStore.getState().hydrateAIPreferences();
    loadInitialState()
      .catch((e) => {
        console.error('Initial project load failed', e);
        toast.error('Could not load your projects. Restart the app, or check the console.');
      })
      .finally(() => {
        isFirstRender.current = false;
      });
  }, []);

  const autoSaveRefs = useRef({
    saveCurrentState,
    createSnapshot,
    activeProjectId,
    projectName,
    localContent
  });
  
  useEffect(() => {
    autoSaveRefs.current = {
      saveCurrentState,
      createSnapshot,
      activeProjectId,
      projectName,
      localContent
    };
  });

  // Auto-Save Interval (Periodic saves and snapshots, ignoring keystrokes)
  useEffect(() => {
    const intervalId = setInterval(() => {
       const refs = autoSaveRefs.current;
       if (!refs.activeProjectId) return;
       // Skip this tick if the previous save is still in flight — overlapping
       // writes to the same project file can clobber each other.
       if (isAutoSavingRef.current) return;
       isAutoSavingRef.current = true;
       void (async () => {
         try {
           await refs.saveCurrentState();
           await refs.createSnapshot('autosave');
         } catch (e) {
           console.error('Autosave failed', e);
         } finally {
           isAutoSavingRef.current = false;
         }
       })();
    }, 60 * 1000); // Save every 60 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Manual trigger wrapper for save button. createSnapshot -> saveCurrentState
  // now persists the live draft (localContent) and converges the committed
  // copy, so an explicit setMarkdown is no longer needed (and the old ordering
  // — commit before setMarkdown — silently committed the stale copy).
  const handleManualSave = () => {
    if (activeProjectId) {
      void createSnapshot('manual');
    }
  };

  // The one global key handler. ⌘/Ctrl+K toggles the command palette (the
  // keyboard door to every action); ⌘/Ctrl+S commits a snapshot; ⌘/Ctrl+Enter
  // runs the diagnostic. Modified chords don't insert text, so no input guard is
  // needed; the latter two are suppressed while the palette is open so they
  // don't fire underneath it. Modal Escape/Enter live in ModalShell, untouched.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const s = useStore.getState();
      if (key === 'k') {
        e.preventDefault();
        s.setShowCommandPalette(!s.showCommandPalette);
      } else if (s.showCommandPalette) {
        return;
      } else if (key === 's') {
        e.preventDefault();
        if (s.activeProjectId) void s.createSnapshot('manual');
      } else if (key === 'enter') {
        e.preventDefault();
        s.setShowRunModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // --- HELPERS ---

  // Sync sections with content
  useEffect(() => {
    const handler = setTimeout(() => {
        const tree = parseMarkdown(localContent, sections);
        
        // Selection retention logic
        setSelectedId(prev => {
           if (prev) {
              const exists = findSection(tree, prev);
              if (!exists && activeLineIndexRef.current !== null) {
                 const candidate = findSectionByLine(tree, activeLineIndexRef.current);
                 return candidate ? candidate.id : null;
              }
              return prev;
           } else if (tree.length > 0) {
              return tree[0].id;
           }
           return null;
        });

        setSections(tree);
    }, 300);
    return () => clearTimeout(handler);
  }, [localContent]);

  // Keep the desktop search index in sync with the LIVE section tree. Indexing
  // the same `sections` the treemap renders guarantees indexed ids == rendered
  // ids, so every search hit maps back to a real, clickable section (a separate
  // re-parse would mint divergent ids and the hits would be silently dropped).
  // Debounced and fully decoupled from the save path — the Rust command rebuilds
  // off the AppState lock, so reindexing can never delay a save.
  useEffect(() => {
    if (!isTauri() || !hasOpenProject) return;
    const handler = setTimeout(() => {
      void repository.indexSections(flattenSectionsForIndex(sections));
    }, 600);
    return () => clearTimeout(handler);
  }, [sections, hasOpenProject]);

  // Bound orphaned testSuite growth without the old data-loss bug. The previous
  // version deleted any entry whose id wasn't in `sections` — which wiped real
  // work the moment a title (and thus its derived id) changed, so it was
  // disabled. `pruneOrphanEntries` removes only orphans that hold NO authored
  // content, so renames/reorders keep their specs/goals/history untouched.
  useEffect(() => {
    if (sections.length === 0) return;
    const liveIds: string[] = [];
    const traverse = (nodes: Section[]) => {
      nodes.forEach(node => {
        liveIds.push(node.id);
        traverse(node.children);
      });
    };
    traverse(sections);
    useStore.getState().pruneOrphanEntries(liveIds);
  }, [sections]);

  const currentSection = useMemo(() => 
    selectedId ? findSection(sections, selectedId) : null
  , [selectedId, sections]);

  const allPersonas = useMemo(() => [...DEFAULT_PERSONAS, ...customPersonas], [customPersonas]);
  const activePersona = useMemo(() => allPersonas.find(p => p.id === activePersonaId) || DEFAULT_PERSONAS[0], [allPersonas, activePersonaId]);

  const documentStats = useMemo(() => {
    let sectionCount = 0;
    let maxLevel = 0;
    const traverse = (nodes: Section[]) => {
      nodes.forEach(n => {
        sectionCount++;
        maxLevel = Math.max(maxLevel, n.level);
        traverse(n.children);
      });
    };
    traverse(sections);
    const wordCount = localContent.trim() === '' ? 0 : localContent.trim().split(/\s+/).length;
    return {
      wordCount,
      sectionCount,
      depth: maxLevel
    };
  }, [sections, localContent]);

  // --- ACTIONS ---

  const handleImportMarkdown = async (content: string) => {
    requestConfirm("Importing Markdown will overwrite the current content of this project. Continue?", async () => {
        const importParser = await import('./lib/markdownImport');
        const { markdown, projectName: importedName, rawBlocks, titleToIdMap } = importParser.parseMarkdownImport(content);
        
        // We set the name if it's there
        const targetName = importedName || projectName;
        setProjectName(targetName);
        
        // The parser will run soon after because we change localContent, but wait!
        // We need to parse immediately to get the matching sections, so we can build the actual TestSuite!
        const parsedUtils = await import('./lib/utils');
        const newSections = parsedUtils.parseMarkdown(markdown, sections, titleToIdMap);
        
        // Build the test suite
        const newTestSuite: TestSuite = {};
        
        // Find every section and see if its ID exists in rawBlocks
        const mapSectionToBlock = (s: import('./types').Section[]) => {
           for (const sec of s) {
              if (rawBlocks[sec.id]) {
                 newTestSuite[sec.id] = rawBlocks[sec.id];
              }
              mapSectionToBlock(sec.children);
           }
        };
        mapSectionToBlock(newSections);

        setMarkdown(markdown);
        setLocalContent(markdown);
        setTestSuite(newTestSuite);
        setHiddenSectionIds([]);
        activeLineIndexRef.current = null;
        if (activeProjectId) saveCurrentState();
        toast.success(`Imported "${targetName}".`);
    });
  };

  const handleLoadFile = async (jsonString: string) => {
    requestConfirm("Load this file as a NEW project?", async () => {
       try {
         const data = JSON.parse(jsonString);
         if (typeof data.markdown !== 'string') throw new Error("Invalid project");
         
         const newId = `proj_${Date.now()}`;
         const newName = data.projectName || "Imported Project";
         
         // Fix format
         const projectData = {
           ...data,
           projectName: newName,
           lastModified: Date.now()
         };
         
         // 1. Save directly to preserve all imported fields exactly as they were
         await repo.setProject(newId, projectData);
         
         // 2. Update Meta
         const contentForWordCount = projectData.localDraft || projectData.markdown || "";
         const wordCount = contentForWordCount.trim() === '' ? 0 : contentForWordCount.trim().split(/\s+/).length;
         
         const metaEntry: ProjectMeta = {
            id: newId,
            name: newName,
            lastModified: Date.now(),
            wordCount
         };
         
         {
            const s = useStore.getState();
            const others = s.projectList.filter(p => p.id !== newId);
            const updated = [metaEntry, ...others];
            s.setProjectList(updated);
            repo.setMeta(updated).catch(console.error);
         }
         
         // 3. Load via `loadProject` to ensure all fields and UI are correctly hydrated sequentially
         await loadProject(newId);
         toast.success(`Loaded "${newName}".`);

       } catch(e) {
         toast.error("Invalid file.");
       }
    });
  };

  const handleExportProject = () => {
    const data = buildProjectExport(useStore.getState());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.socratic`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const mdExport = createMarkdownExport(projectName, localContent, sections, testSuite);
    const blob = new Blob([mdExport], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSpecs = () => {
    const specsData: Record<string, SectionSpec> = {};
    for (const [id, entry] of Object.entries(testSuite)) {
      if (entry.spec) specsData[id] = entry.spec;
    }
    const blob = new Blob([JSON.stringify(specsData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-specs.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunTests = async (
  scope: 'segment' | 'parent' | 'full',
  choice: ModelChoice,
  instruction: string,
  mode: ReadingMode
) => {
  setShowRunModal(false);
  if (!currentSection) return;
  
  const testId = currentSection.id;

  // Whole-document evaluation forces full scope. The diagnostic sends the scoped
  // content whole (no per-section cap), so pre-flight the exact text the provider
  // will assemble and abort on overflow — never silently truncate.
  let effectiveScope: 'segment' | 'parent' | 'full' = scope;
  if (testId === 'root') effectiveScope = 'full';

  let diagContent = currentSection.fullContent;
  if (effectiveScope === 'full') {
    diagContent = markdown;
  } else if (effectiveScope === 'parent' && currentSection.parentId) {
    const parent = findSection(sections, currentSection.parentId);
    if (parent) diagContent = parent.fullContent;
  }
  if (
    !guardContextFit({
      catalog: useStore.getState().modelCatalog,
      choice,
      text: diagContent,
      what: testId === 'root' ? 'The whole document' : 'This section',
      setting: 'Run diagnostic',
    })
  ) {
    return;
  }
  
  try {
    // Create snapshot before destructive AI action
    await createSnapshot('pre-ai-write', { sectionIds: [testId] });
    
    const entry = testSuite[testId];
    
    // Build or retrieve the spec for this section
    let spec = entry?.spec;
    if (!spec) {
      // Fallback: create a minimal spec from legacy goals
      const goals = entry?.goals || "Is this section written clearly and does it advance the argument?";
      spec = specFromLegacyGoals(goals, entry?.mainClaim);
    }
   
    // If spec has no required moves, we can't run a useful diagnostic
    if (spec.requiredMoves.length === 0) {
      toast.error("This section has no required moves defined. Run 'Interpolate Tasks' first, or add moves manually.");
      return;
    }
   
    setTestSuite(prev => ({
      ...prev,
      [testId]: { ...prev[testId], goals: prev[testId]?.goals || '', status: 'running' }
    }));
    setIsProcessing(true);
   
    // Spec map (sectionId → spec, incl. 'root') so the diagnostic can judge this
    // section as a part inside its live structural surround, not as an isolated piece.
    const specs = selectSpecMap(testSuite);

    const diagnostic = await aiProvider.runDiagnostic({
      section: currentSection,
      spec,
      scope: effectiveScope,
      modelChoice: choice,
      persona: activePersona,
      customInstruction: instruction,
      fullDocument: markdown,
      sections,
      config: promptsConfig,
      findSection,
      specs,
      mode,
    });
   
    const derivedStatus = diagnosticToStatus(diagnostic);
   
    setTestSuite(prev => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        status: derivedStatus,
        lastDiagnostic: diagnostic,
        // Also set legacy lastResult for backward compat
        lastResult: {
          passed: derivedStatus === 'success',
          critique: diagnostic.nextPriority,
          suggestions: diagnostic.coherenceNotes,
        }
      }
    }));
  } catch (e: any) {
    console.error("Diagnostic evaluation failed:", e);
    notifyAiError(e, `Analysis failed: ${e?.message || 'Try again.'}`);
    setTestSuite(prev => ({
      ...prev,
      [testId]: { ...prev[testId], status: 'fail' }
    }));
  } finally {
    setIsProcessing(false);
  }
};

  // updateSpec, updateGoals, updateSectionGoals — moved to document-state slice.
  // Modals/panels call them via useStore directly (the App.tsx-local copy of
  // updateSectionGoals was a stale-closure duplicate and is gone).

  const updateDependencies = useCallback((id: string, deps: Dependency[]) => {
    setTestSuite(prev => {
      const entry = prev[id] || { goals: '', status: 'idle', history: [] };
      return {
        ...prev,
        [id]: {
          ...entry,
          dependencies: deps
        }
      };
    });
  }, []);

  const handleEstimateDependencies = useCallback(async () => {
    try {
      toast.info("Estimating dependencies...", { id: "est-deps" });
      const depsMap = await aiProvider.estimateDependencies({
        sections,
        testSuite,
        config: promptsConfig,
      });
      
      setTestSuite(prev => {
        const next = { ...prev };
        let hasChanges = false;
        
        for (const [id, deps] of Object.entries(depsMap)) {
          const entry = next[id] || { goals: '', status: 'idle', history: [] };
          const existingDeps = entry.dependencies || [];
          
          // Add new distinct elements
          const newDeps = deps.filter(d => !existingDeps.some(ed => ed.id === d.id));
          if (newDeps.length > 0) {
            next[id] = {
              ...entry,
              dependencies: [...existingDeps, ...newDeps]
            };
            hasChanges = true;
          }
        }
        return hasChanges ? next : prev;
      });
      toast.success("Dependencies estimated and updated.", { id: "est-deps" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to estimate dependencies.", { id: "est-deps" });
    }
  }, [sections, testSuite]);

  // updateMainClaim — moved to document-state slice in Phase 1e.

  const getParentGoals = () => {
    if (!currentSection || !currentSection.parentId) return undefined;
    return testSuite[currentSection.parentId]?.goals;
  };

  // toggleSectionVisibility — moved to document-state slice in Phase 1e.

  const handleSaveContent = (sectionId: string, newContent: string) => {
    // Read the live buffer fresh (not a possibly-stale closure) so the line math
    // matches what is actually on screen.
    const prev = useStore.getState().localContent;
    const currSections = parseMarkdown(prev);
    const flattenSections = (nodes: Section[]): Section[] => {
      const result: Section[] = [];
      const tr = (nx: Section[]) => {
        nx.forEach(n => { result.push(n); tr(n.children); });
      };
      tr(nodes);
      return result;
    };

    const sec = flattenSections(currSections).find(s => s.id === sectionId);
    if (!sec) {
      toast.error("Couldn't locate that section to save — it may have been renamed.");
      return;
    }

    const lines = prev.split('\n');
    // `newContent` includes the section's own heading line (matching node.content),
    // so we replace from this section's start up to its first child (or its end).
    const childStartIndex = sec.children.length > 0 ? sec.children[0].startLine : sec.endLine;
    const before = lines.slice(0, sec.startLine);
    const after = lines.slice(childStartIndex);
    const next = [...before, newContent, ...after].join('\n');

    setLocalContent(next);
    // Persist immediately rather than waiting up to 60s for the next autosave —
    // a sprint edit must survive a crash/close in that window.
    if (activeProjectId) void saveCurrentState();
  };

  const handleLineFocus = useCallback((index: number | null) => {
    activeLineIndexRef.current = index;
  }, []);

  // Command palette entries — the named, searchable door to every primary action
  // (the consolidation of the Coach/Generate-specs/Revise glyphs). Built each
  // render so the App-level handlers stay current; store openers are reached via
  // getState() to avoid widening the selector.
  const paletteCommands: Command[] = [
    { id: 'sprint', label: 'Sprint', hint: 'Goal or draft · timed', glyph: '»', run: () => useStore.getState().setShowSprintModal(true) },
    { id: 'coach', label: 'Coach', hint: 'Stuck? Find the bottleneck', glyph: '◉', run: () => useStore.getState().setShowCoachModal(true) },
    { id: 'generate-specs', label: 'Generate specs', hint: 'Structural analysis, top-down', glyph: '✦', run: () => useStore.getState().openInterpolate() },
    { id: 'revise', label: 'Revise', hint: 'Glass Box revision workspace', glyph: '⟐', run: () => useStore.getState().openRevisionWorkspace() },
    { id: 'parallel', label: 'Parallel', hint: 'Reverse-outline revision', glyph: '▥', run: () => useStore.getState().openParallel(false) },
    { id: 'gist', label: 'Gist', hint: 'Whole-at-once re-entry surface', glyph: '◊', run: () => useStore.getState().openGist() },
    { id: 'run-diagnostic', label: 'Run diagnostic', hint: 'Evaluate current section', glyph: '▶', shortcut: '⌘⏎', run: () => useStore.getState().setShowRunModal(true) },
    { id: 'goal-map', label: 'Goal map', hint: 'Section goal editor', glyph: '▦', run: () => useStore.getState().setShowSectionMapModal(true) },
    { id: 'dependencies', label: 'Dependencies', hint: 'Section graph', glyph: '◈', run: () => useStore.getState().setShowGraphModal(true) },
    { id: 'prompts', label: 'Prompts', hint: 'AI routing', glyph: '❝', run: () => useStore.getState().setShowPromptsGraphModal(true) },
    { id: 'raw-data', label: 'Raw data', hint: 'JSON editor', glyph: '{}', run: () => useStore.getState().setShowProjectFileModal(true) },
    { id: 'compare', label: 'Compare versions', hint: 'A/B evaluation', glyph: '≈', run: () => useStore.getState().openCompare() },
    { id: 'climate', label: 'Climate', hint: 'Atmospheric report', glyph: '≋', run: () => useStore.getState().openClimate() },
    { id: 'history', label: 'Version history', hint: 'Snapshots & restore', glyph: '◷', run: () => useStore.getState().setShowHistoryModal(true) },
    { id: 'snapshot', label: 'Snapshot now', hint: 'Commit a labeled version', glyph: '◆', shortcut: '⌘S', run: handleManualSave },
    { id: 'new-project', label: 'New project', glyph: '＋', run: () => createNewProject() },
    { id: 'open-projects', label: 'Open projects', glyph: '◇', run: () => useStore.getState().setShowProjectModal(true) },
    { id: 'export-markdown', label: 'Export markdown', glyph: '↧', run: handleExportMarkdown },
    { id: 'export-project', label: 'Export project', hint: '.socratic', glyph: '↧', run: handleExportProject },
    { id: 'export-specs', label: 'Export specs', hint: '.json', glyph: '↧', run: handleExportSpecs },
  ];

  return (
    <div className="dark">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
      <Tutorial run={runTutorial} onFinish={handleTutorialFinish} />
      <div className="flex h-screen w-full bg-hld-bg text-hld-text overflow-hidden transition-colors duration-200 font-sans">
        <Sidebar
          onSelect={setSelectedId}
          onContinue={() => {
            const targetId = selectedId ?? sections[0]?.id ?? null;
            if (targetId) setSelectedId(targetId);
            editorRef.current?.focus();
          }}
          onImportMarkdown={handleImportMarkdown}
          onLoadProject={handleLoadFile}
          onSaveProject={handleExportProject}
          onExportMarkdown={handleExportMarkdown}
          onExportSpecs={handleExportSpecs}
          onResetProject={() => createNewProject()}
          onLoadDefaultProject={() => createDemoProject()}
          onStartTutorial={() => setRunTutorial(true)}
        />

        <div className="flex-1 min-w-0 flex flex-col h-full bg-hld-bg relative hld-scanline">
          <EditorPanel
            handleSave={handleManualSave}
            editorRef={editorRef}
            onImportMarkdown={handleImportMarkdown}
            onLoadProject={handleLoadFile}
          />
        </div>

        <TestsPanel />

        {/* Modals */}
        <TestRunnerModal
          onRun={handleRunTests}
          sectionTitle={currentSection?.title || 'Unknown'}
          currentSection={currentSection}
          currentSpec={currentSection ? testSuite[currentSection.id]?.spec : undefined}
          documentStats={documentStats}
          activePersona={activePersona}
          allSections={sections}
          fullDocument={markdown}
        />

        <VersionHistoryModal
          revisions={revisions}
          currentContent={localContent}
          onRestore={(snapshot) => {
            setLocalContent(snapshot.markdown);
            setMarkdown(snapshot.markdown);
            setTestSuite(snapshot.testSuite || {});
            if (snapshot.interpolationConfig) {
              // Normalized: old snapshots predate newer prompt fields.
              setPromptsConfig(normalizePromptsConfig(snapshot.interpolationConfig));
            }
            if (activeProjectId) {
              saveCurrentState();
            }
          }}
        />

        <PersonaSettingsModal
          activePersonaId={activePersonaId}
          personas={allPersonas}
          onSelectPersona={setActivePersonaId}
          onAddPersona={(p) => setCustomPersonas(prev => [...prev, p])}
          onDeletePersona={(id) => {
            setCustomPersonas(prev => prev.filter(p => p.id !== id));
            if (activePersonaId === id) setActivePersonaId('default');
          }}
          documentContext={markdown}
          promptsConfig={promptsConfig}
        />

        <GrimoireModal />

        <SpecGeneratorModal
          sectionTitle={currentSection?.title || ""}
          currentGoals={currentSection ? (testSuite[currentSection.id]?.goals || "") : ""}
          fullSectionContent={currentSection?.fullContent || ""}
          parentGoals={getParentGoals()}
          onAccept={(newGoals, instruction) => {
             if (currentSection) {
               updateSectionGoals(currentSection.id, newGoals, 'ai-refine', instruction);
             }
             setShowSpecModal(false);
          }}
        />

        <SprintModal
          sections={sections}
          testSuite={testSuite}
          onSaveGoal={updateSectionGoals}
          onSaveContent={handleSaveContent}
          promptsConfig={promptsConfig}
        />

        <ProjectManagerModal
          projects={projectList}
          activeProjectId={activeProjectId || ''}
          onLoadProject={async (id) => {
            // switchProject flushes the current project before loading the next,
            // so the last <60s of edits aren't lost on switch.
            const success = await switchProject(id);
            if (!success) {
               toast.error("Could not load project data.");
            }
          }}
          onCreateProject={() => createNewProject()}
          onLoadDefaultProject={() => createDemoProject()}
          onOpenProject={isTauri() ? () => openExistingProject() : undefined}
          onDeleteProject={(id) => {
            // Project delete is the one destructive action that confirms (per the
            // "undo, not confirm — except delete" rule). Copy is runtime-specific:
            // desktop only forgets the recent entry; browser delete is permanent.
            const name = projectList.find((p) => p.id === id)?.name ?? 'this project';
            const message = isTauri()
              ? `Delete "${name}"? This removes it from your recent projects — the folder on disk is kept.`
              : `Delete "${name}"? This permanently deletes the project and can't be undone.`;
            requestConfirm(message, () => { void deleteProject(id); });
          }}
        />

        <DependencyGraphModal
          sections={sections}
          testSuite={testSuite}
          updateDependencies={updateDependencies}
          onEstimateDependencies={handleEstimateDependencies}
        />

        <ProjectFileModal
          sections={sections}
          testSuite={testSuite}
          projectName={projectName}
          markdown={markdown}
          promptsConfig={promptsConfig}
          customPersonas={customPersonas}
          onSaveData={({ testSuite: newTestSuite, projectName: newProjectName, promptsConfig: newPrompts, customPersonas: newPersonas }) => {
            if (newTestSuite) setTestSuite(newTestSuite);
            if (newProjectName) setProjectName(newProjectName);
            // Raw-JSON prompt edits land as a per-project override (same path as
            // the Prompts map's project scope).
            if (newPrompts) setPromptsConfig(newPrompts);
            if (newPersonas) setCustomPersonas(newPersonas);
            void saveCurrentState();
          }}
        />

        <CoachModal
          markdown={markdown}
          sections={sections}
          testSuite={testSuite}
          cachedAdvice={cachedCoachAdvice}
          onSaveCache={(inputHash, advice) => {
            setCachedCoachAdvice({ inputHash, advice });
          }}
          promptsConfig={promptsConfig}
        />

        <PromptsGraphModal />

        <SectionMapModal
          sections={sections}
          testSuite={testSuite}
          onUpdateGoals={(id, goals) => updateSectionGoals(id, goals, 'manual')}
        />

        <MigrationModal />

        <SyncConfigModal />

        <RemoteProjectModal />

        <ConflictResolutionModal />

        <ExternalChangeModal />

        <RevisionWorkspace />

        <RevisionSettingsModal />

        <AgentTraceModal />

        <CompareWorkspace />

        <ClimateWorkspace />

        <InterpolateWorkspace />

        <DashboardWorkspace />

        <ParallelWorkspace />

        <ParallelSettingsModal />

        <GistWorkspace />

        <GistSettingsModal />

        <SessionModal />

        <CommandPaletteModal commands={paletteCommands} />

        <Toaster position="bottom-right" richColors />
      </div>
    </div>
  );
};