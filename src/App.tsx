import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { Sidebar } from "./features/sidebar/Sidebar";
import { EditorPanel } from "./features/editor/EditorPanel";
import { TestsPanel } from "./features/tests-panel/TestsPanel";
import { TestRunnerModal } from "./features/modals/TestRunnerModal";
import { PersonaSettingsModal } from "./features/modals/PersonaSettingsModal";
import { SpecGeneratorModal } from "./features/modals/SpecGeneratorModal";
import { InterpolationModal } from "./features/modals/InterpolationModal";
import { SprintModal } from "./features/modals/BaseSprintModal";
import { ProjectManagerModal } from "./features/modals/ProjectManagerModal";
import { VersionHistoryModal } from "./features/modals/VersionHistoryModal";
import { ContentSuggestionsModal } from "./features/modals/ContentSuggestionsModal";
import { DependencyGraphModal } from "./features/modals/DependencyGraphModal";
import { PromptsGraphModal } from "./features/modals/PromptsGraphModal";
import { SectionMapModal } from "./features/modals/SectionMapModal";
import { CoachModal } from "./features/modals/CoachModal";
import { ProjectFileModal } from "./features/modals/ProjectFileModal";
import { ConfirmModal } from "./features/modals/ConfirmModal";
import { Tutorial } from "./features/tutorial/Tutorial";
import { MigrationModal } from "./features/migration/MigrationModal";
import { SyncConfigModal } from "./features/modals/SyncConfigModal";
import { ConflictResolutionModal } from "./features/modals/ConflictResolutionModal";
import { useLegacyMigration } from "./features/migration/use-legacy-migration";
import { parseMarkdown } from "./lib/utils";
import { createMarkdownExport } from "./lib/markdownExport";
import { DEFAULT_PROMPTS_CONFIG } from "./lib/constants";
import defaultProjectData from "./lib/defaultProject.json";
import { Section, TestSuite, ProjectMeta, Snapshot,
  Dependency, PromptsConfig,
  SectionSpec, DiagnosticResult
} from "./types";
import { repository as repo } from './services/repository-registry';
import { hasSeenTutorial, markTutorialSeen } from './services/preferences';
import { DEFAULT_PERSONAS } from './lib/defaultPersonas';
import { aiProvider } from './services/ai-provider-registry';
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
    showRunModal, showPersonaModal, showSpecModal, showSuggestionsModal, showInterpolationModal,
    showPromptsGraphModal, showSectionMapModal, showProjectFileModal, showGoalSprintModal,
    showContentSprintModal, showHistoryModal, showGraphModal, showCoachModal, isProcessing,
    isInterpolating, activePersonaId, customPersonas, promptsConfig, cachedCoachAdvice,
    
    setLocalContent, setSections, setMarkdown, setProjectName, setTestSuite, setHiddenSectionIds,
    setSelectedId, setActiveLineIndex, setRunTutorial, setSidebarWidth,
    setTestsPanelWidth, setFocusMode, setShowProjectModal, setShowRunModal, setShowPersonaModal,
    setShowSpecModal, setShowSuggestionsModal, setShowInterpolationModal, setShowPromptsGraphModal,
    setShowSectionMapModal, setShowProjectFileModal, setShowGoalSprintModal, setShowContentSprintModal,
    setShowHistoryModal, setShowGraphModal, setShowCoachModal, setIsProcessing, setIsInterpolating,
    setActivePersonaId, setCustomPersonas, setPromptsConfig, setCachedCoachAdvice,
    
    loadInitialState, createDemoProject, createNewProject, openExistingProject, loadProject, deleteProject,
    saveCurrentState, createSnapshot, setRevisions
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
    showSuggestionsModal: state.showSuggestionsModal,
    showInterpolationModal: state.showInterpolationModal,
    showPromptsGraphModal: state.showPromptsGraphModal,
    showSectionMapModal: state.showSectionMapModal,
    showProjectFileModal: state.showProjectFileModal,
    showGoalSprintModal: state.showGoalSprintModal,
    showContentSprintModal: state.showContentSprintModal,
    showHistoryModal: state.showHistoryModal,
    showGraphModal: state.showGraphModal,
    showCoachModal: state.showCoachModal,
    isProcessing: state.isProcessing,
    isInterpolating: state.isInterpolating,
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
    setShowSuggestionsModal: state.setShowSuggestionsModal,
    setShowInterpolationModal: state.setShowInterpolationModal,
    setShowPromptsGraphModal: state.setShowPromptsGraphModal,
    setShowSectionMapModal: state.setShowSectionMapModal,
    setShowProjectFileModal: state.setShowProjectFileModal,
    setShowGoalSprintModal: state.setShowGoalSprintModal,
    setShowContentSprintModal: state.setShowContentSprintModal,
    setShowHistoryModal: state.setShowHistoryModal,
    setShowGraphModal: state.setShowGraphModal,
    setShowCoachModal: state.setShowCoachModal,
    setIsProcessing: state.setIsProcessing,
    setIsInterpolating: state.setIsInterpolating,
    setActivePersonaId: state.setActivePersonaId,
    setCustomPersonas: state.setCustomPersonas,
    setPromptsConfig: state.setPromptsConfig,
    setCachedCoachAdvice: state.setCachedCoachAdvice,
    
    loadInitialState: state.loadInitialState,
    createDemoProject: state.createDemoProject,
    createNewProject: state.createNewProject,
    openExistingProject: state.openExistingProject,
    loadProject: state.loadProject,
    deleteProject: state.deleteProject,
    saveCurrentState: state.saveCurrentState,
    createSnapshot: state.createSnapshot
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
    void initSyncPolicy();
    return () => {
      teardownSyncPolicy();
    };
  }, [activeProjectId, hasOpenProject]);

  // --- INITIALIZATION & MIGRATION ---
  useEffect(() => {
    loadInitialState().then(() => {
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
       refs.saveCurrentState();
       refs.createSnapshot('autosave');
    }, 60 * 1000); // Save every 60 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Manual trigger wrapper for save button
  const handleManualSave = () => {
    if (activeProjectId) {
      createSnapshot('manual');
      setMarkdown(localContent); // Commit draft
    }
  };

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

  // Clean test suite (Disabled to prevent deleting data when section titles change)
  /*
  useEffect(() => {
    if (sections.length === 0) return;
    const currentIds = new Set<string>();
    const traverse = (nodes: Section[]) => {
      nodes.forEach(node => {
        currentIds.add(node.id);
        traverse(node.children);
      });
    };
    traverse(sections);
    setTestSuite(prev => {
      const next = { ...prev };
      let hasChanges = false;
      Object.keys(next).forEach(key => {
        if (!currentIds.has(key)) {
          // delete next[key]; // Do not delete orphaned data
          // hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [sections]);
  */

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
         
       } catch(e) {
         toast.error("Invalid file.");
       }
    });
  };

  const handleExportProject = () => {
    const s = useStore.getState();
    const data = {
      projectName: s.projectName,
      markdown: s.markdown,
      localDraft: s.localContent,
      testSuite: s.testSuite,
      hiddenSectionIds: s.hiddenSectionIds,
      activePersonaId: s.activePersonaId,
      customPersonas: s.customPersonas,
      promptsConfig: s.promptsConfig,
      cachedCoachAdvice: s.cachedCoachAdvice,
      revisions: s.revisions,
      lastModified: Date.now(),
    };
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

  const handleInterpolateTasks = async (
  modelId: string, 
  thinkingBudget: number, 
  config: PromptsConfig
) => {
  if (!sections || sections.length === 0) return;
  setShowInterpolationModal(false);
  setIsInterpolating(true);
  
  try {
    // Create snapshot before destructive AI action
    await createSnapshot('pre-ai-write', 'all', config);
    
    setPromptsConfig(config);

    await aiProvider.generateSpecs({
      sections,
      markdown,
      config,
      modelId,
      thinkingBudget,
      onBatchComplete: (specs) => {
        setTestSuite(prev => {
          const next = { ...prev };
          Object.entries(specs).forEach(([id, spec]) => {
            const existing = next[id] || { goals: '', status: 'idle', history: [] };
            next[id] = {
              ...existing,
              spec,
              mainClaim: spec.mainClaim,
              goals: spec.requiredMoves.map(m => m.description).join('\n'),
              status: 'stale',
              history: [
                ...(existing.history || []),
                {
                  timestamp: Date.now(),
                  goals: existing.goals,
                  instruction: `Structured spec (${modelId})`,
                  type: 'ai-generate' as const
                }
              ]
            };
          });
          return next;
        });
      },
      onError: (error) => {
        console.error("Spec generation batch error:", error);
      }
    });
  } catch (e: any) {
    console.error("Interpolation failed", e);
    toast.error(`Task interpolation failed: ${e?.message || 'Check console/API Key.'}`);
  } finally {
    setIsInterpolating(false);
  }
};

  const handleRunTests = async (
  scope: 'segment' | 'parent' | 'full',
  modelId: string,
  thinkingBudget: number,
  instruction: string
) => {
  setShowRunModal(false);
  if (!currentSection) return;
  
  const testId = currentSection.id;
  
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
   
    const diagnostic = await aiProvider.runDiagnostic({
      section: currentSection,
      spec,
      scope,
      modelId,
      thinkingBudget,
      persona: activePersona,
      customInstruction: instruction,
      fullDocument: markdown,
      sections,
      config: promptsConfig,
      findSection,
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
    toast.error(`Analysis failed: ${e?.message || 'Check API key or try again'}`);
    setTestSuite(prev => ({
      ...prev,
      [testId]: { ...prev[testId], status: 'fail' }
    }));
  } finally {
    setIsProcessing(false);
  }
};

  // updateSpec, updateGoals — moved to document-state slice in Phase 1e.
  // Modals/panels call them via useStore directly.

  const updateSectionGoals = useCallback((id: string, newGoals: string, type: 'manual' | 'ai-generate' | 'ai-refine', instruction?: string) => {
    if (type.startsWith('ai-')) {
       createSnapshot('pre-ai-write', { sectionIds: [id] });
    }
    setTestSuite(prev => {
      const entry = prev[id] || { goals: '', status: 'idle', history: [] };
      return {
        ...prev,
        [id]: {
          ...entry,
          goals: newGoals,
          status: 'stale',
          history: [
            ...(entry.history || []),
            { 
               timestamp: Date.now(), 
               goals: entry.goals, 
               instruction,
               type
            }
          ]
        }
      };
    });
  }, []);

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
        modelId: 'gemini-3.1-pro-preview',
        thinkingBudget: 1024,
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
    setLocalContent(prev => {
      // Re-parse with the literal latest localContent to find line numbers
      const currSections = parseMarkdown(prev);
      const flattenSections = (nodes: Section[]): Section[] => {
        const result: Section[] = [];
        const tr = (nx: Section[]) => {
          nx.forEach(n => { result.push(n); tr(n.children); });
        };
        tr(nodes);
        return result;
      };
      
      const flat = flattenSections(currSections);
      const sec = flat.find(s => s.id === sectionId);
      
      if (!sec) return prev;
      
      const lines = prev.split('\n');
      const childStartIndex = sec.children.length > 0 ? sec.children[0].startLine : sec.endLine;
      
      const before = lines.slice(0, sec.startLine);
      const after = lines.slice(childStartIndex);
      
      // Keep the markdown header exactly as it was, and only replace the rest
      // Actually, wait, `newContent` includes the header line? 
      // Yes, `node.content` includes the header line in the original code. 
      // If the user modified the header, that's fine.
      
      return [...before, newContent, ...after].join('\n');
    });
  };

  const handleLineFocus = useCallback((index: number | null) => {
    activeLineIndexRef.current = index;
  }, []);

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
          onImportMarkdown={handleImportMarkdown}
          onLoadProject={handleLoadFile}
          onSaveProject={handleExportProject}
          onExportMarkdown={handleExportMarkdown}
          onExportSpecs={handleExportSpecs}
          onResetProject={() => createNewProject()}
          onLoadDefaultProject={() => createDemoProject()}
          onStartTutorial={() => setRunTutorial(true)}
        />

        <div className="flex-1 min-w-0 flex flex-col h-full bg-hld-bg relative">
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
              setPromptsConfig(snapshot.interpolationConfig);
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

        <InterpolationModal
          onConfirm={handleInterpolateTasks}
          documentStats={documentStats}
          initialConfig={promptsConfig}
        />

        <SprintModal
          sections={sections}
          testSuite={testSuite}
          mode="goal"
          onSaveGoal={updateSectionGoals}
        />

        <SprintModal
          sections={sections}
          testSuite={testSuite}
          mode="content"
          onSaveContent={handleSaveContent}
        />

        <ProjectManagerModal
          projects={projectList}
          activeProjectId={activeProjectId || ''}
          onLoadProject={async (id) => {
            const success = await loadProject(id);
            if (!success) {
               toast.error("Could not load project data.");
            }
          }}
          onCreateProject={() => createNewProject()}
          onLoadDefaultProject={() => createDemoProject()}
          onOpenProject={isTauri() ? () => openExistingProject() : undefined}
          onDeleteProject={deleteProject}
        />

        <ContentSuggestionsModal
          sectionTitle={currentSection?.title || ""}
          currentGoals={currentSection ? (testSuite[currentSection.id]?.goals || "") : ""}
          fullSectionContent={currentSection?.fullContent || ""}
          parentGoals={getParentGoals()}
          sectionId={currentSection?.id || ""}
          cachedSuggestions={currentSection ? testSuite[currentSection.id]?.cachedSuggestions : undefined}
          onSaveCache={(sectionId, inputHash, suggestions) => {
             setTestSuite(prev => {
                const ts = { ...prev };
                if (!ts[sectionId]) return ts;
                ts[sectionId] = { ...ts[sectionId], cachedSuggestions: { inputHash, suggestions } };
                return ts;
             });
             if (activeProjectId) {
                // Not calling saveCurrentState directly to avoid double render, but ideal is yes.
                // We let next autosave catch it, or if it's critical, we can call it.
             }
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
          onSaveData={({ testSuite: newTestSuite, projectName: newProjectName }) => {
            if (newTestSuite) setTestSuite(newTestSuite);
            if (newProjectName) setProjectName(newProjectName);
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

        <PromptsGraphModal
          promptsConfig={promptsConfig}
          setPromptsConfig={setPromptsConfig}
        />

        <SectionMapModal
          sections={sections}
          testSuite={testSuite}
          onUpdateGoals={(id, goals) => updateSectionGoals(id, goals, 'manual')}
        />

        <MigrationModal />

        <SyncConfigModal />

        <ConflictResolutionModal />

        <Toaster position="bottom-right" richColors />
      </div>
    </div>
  );
};