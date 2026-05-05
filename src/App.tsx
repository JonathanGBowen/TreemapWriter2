import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";
import { Toaster, toast } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { EditorPanel } from "./components/panels/EditorPanel";
import { TestsPanel } from "./components/panels/TestsPanel";
import { TestRunnerModal } from "./components/modals/TestRunnerModal";
import { PersonaSettingsModal } from "./components/modals/PersonaSettingsModal";
import { SpecGeneratorModal } from "./components/modals/SpecGeneratorModal";
import { InterpolationModal } from "./components/modals/InterpolationModal";
import { SprintModal } from "./components/modals/BaseSprintModal";
import { ProjectManagerModal } from "./components/modals/ProjectManagerModal";
import { VersionHistoryModal } from "./components/modals/VersionHistoryModal";
import { ContentSuggestionsModal } from "./components/modals/ContentSuggestionsModal";
import { DependencyGraphModal } from "./components/modals/DependencyGraphModal";
import { PromptsGraphModal } from "./components/modals/PromptsGraphModal";
import { SectionMapModal } from "./components/modals/SectionMapModal";
import { CoachModal } from "./components/modals/CoachModal";
import { ProjectFileModal } from "./components/modals/ProjectFileModal";
import { ConfirmModal } from "./components/modals/ConfirmModal";
import { Tutorial } from "./components/Tutorial";
import { parseMarkdown } from "./lib/utils";
import { createMarkdownExport } from "./lib/markdownExport";
import { DEFAULT_PROMPTS_CONFIG } from "./lib/constants";
import defaultProjectData from "./lib/defaultProject.json";
import { Section, TestSuite, Persona, ProjectMeta, Snapshot, 
  Dependency, PromptsConfig,
  SectionSpec, DiagnosticResult 
} from "./types";
import { get, set, del } from 'idb-keyval';
// Add new import:
import { 
  generateStructuredSpecs, 
  runDiagnosticEvaluation, 
  diagnosticToStatus,
  specFromLegacyGoals,
  generateDependenciesEstimation
} from "./lib/ai-pipeline";
import { buildDiagnosticPrompt } from "./lib/constants"; // if not already


const STORAGE_PREFIX = 'socratic_p_';
const META_KEY = 'socratic_meta_v1';
const LEGACY_KEY = 'socratic_project_v1';

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

const DEFAULT_PERSONAS: Persona[] = [
  {
    id: 'default',
    name: 'Socratic Co-Writer',
    role: 'Academic Editor',
    instruction: 'You are Socratic Co-Writer, a rigorous academic editor. You value clarity, logical flow, and intellectual honesty. Your feedback should be constructive, specific, and aimed at elevating the argumentation.'
  },
  {
    id: 'skeptic',
    name: 'The Skeptic',
    role: 'Devil\'s Advocate',
    instruction: 'You are a highly skeptical reader who questions every premise. You actively look for logical fallacies, unsupported claims, and weak evidence. Be ruthless but fair in your critique.'
  },
  {
    id: 'simplifier',
    name: 'The Explainer',
    role: 'Science Communicator',
    instruction: 'You are an expert science communicator. Your goal is to ensure the text is accessible to a general educated audience without losing accuracy. Flag jargon, convoluted sentences, and unnecessary complexity.'
  }
];

export const App = () => {
  // --- PROJECT MANAGEMENT STATE ---
  const [projectList, setProjectList] = useState<ProjectMeta[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  // --- EDITOR STATE ---
  const [markdown, setMarkdown] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("Untitled Project");
  const [testSuite, setTestSuite] = useState<TestSuite>({});
  const [hiddenSectionIds, setHiddenSectionIds] = useState<string[]>([]);
  const [localContent, setLocalContent] = useState<string>("");
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [revisions, setRevisions] = useState<Snapshot[]>([]);
  
  // UI State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [testsPanelWidth, setTestsPanelWidth] = useState(350);
  const [focusMode, setFocusMode] = useState(true);
  const activeLineIndexRef = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runTutorial, setRunTutorial] = useState(false);

  useEffect(() => {
    get('treemap_writer_tutorial_seen').then(hasSeenTutorial => {
      if (!hasSeenTutorial) {
        setTimeout(() => setRunTutorial(true), 1000);
      }
    });
  }, []);

  const handleTutorialFinish = () => {
    setRunTutorial(false);
    set('treemap_writer_tutorial_seen', true);
  };

  // Advanced State
  const [activePersonaId, setActivePersonaId] = useState<string>('default');
  const [customPersonas, setCustomPersonas] = useState<Persona[]>([]);
  const [promptsConfig, setPromptsConfig] = useState<PromptsConfig>(DEFAULT_PROMPTS_CONFIG);
  const [cachedCoachAdvice, setCachedCoachAdvice] = useState<{inputHash: string, advice: string} | null>(null);

  // Modals & Async
  const [showRunModal, setShowRunModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showInterpolationModal, setShowInterpolationModal] = useState(false);
  const [showPromptsGraphModal, setShowPromptsGraphModal] = useState(false);
  const [showSectionMapModal, setShowSectionMapModal] = useState(false);
  const [showProjectFileModal, setShowProjectFileModal] = useState(false);
  
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
  const [showGoalSprintModal, setShowGoalSprintModal] = useState(false);
  const [showContentSprintModal, setShowContentSprintModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInterpolating, setIsInterpolating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const isFirstRender = useRef(true);

  // --- INITIALIZATION & MIGRATION ---
  useEffect(() => {
    (async () => {
      // 1. Load Meta
      let meta: ProjectMeta[] = [];
      try {
        let savedMeta = await get(META_KEY);
        if (!savedMeta) {
           const lsMeta = localStorage.getItem(META_KEY);
           if (lsMeta) {
              savedMeta = JSON.parse(lsMeta);
              await set(META_KEY, savedMeta);
           }
        }
        if (savedMeta) {
          meta = typeof savedMeta === 'string' ? JSON.parse(savedMeta) : savedMeta;
        }
      } catch (e) { console.warn("Meta load fail", e); }

      // 2. Check for Legacy Migration
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && meta.length === 0) {
         try {
           const legacyData = JSON.parse(legacy);
           const newId = `proj_${Date.now()}`;
           const migratedName = legacyData.projectName || "Migrated Project";
           
           // Save as new format
           await set(STORAGE_PREFIX + newId, legacyData);
           
           const newMeta: ProjectMeta = {
              id: newId,
              name: migratedName,
              lastModified: legacyData.lastModified || Date.now(),
              wordCount: (legacyData.localDraft || "").trim().split(/\s+/).length
           };
           meta.push(newMeta);
           await set(META_KEY, meta);
         } catch (e) { console.error("Migration failed", e); }
      }

      setProjectList(meta);

      // 3. Determine Active Project
      if (meta.length > 0) {
         // Load most recently modified
         const sorted = [...meta].sort((a, b) => b.lastModified - a.lastModified);
         let loaded = false;
         for (const projMeta of sorted) {
             loaded = await loadProject(projMeta.id);
             if (loaded) break;
             
             // If failed to load, remove from meta to avoid repeated failures
             meta = meta.filter(p => p.id !== projMeta.id);
             setProjectList(meta);
             await set(META_KEY, meta);
         }
         if (!loaded) {
             await createDemoProject();
         }
      } else {
         // Create fresh DEMO project for first run
         await createDemoProject();
      }
      
      // Allow UI to settle
      isFirstRender.current = false;
    })();
  }, []);

  // --- PROJECT ACTIONS ---

  const createDemoProject = async () => {
    const newId = `proj_${Date.now()}`;
    const newName = defaultProjectData.projectName || "Socratic Demo";
    
    setProjectName(newName);
    setMarkdown(defaultProjectData.markdown || "");
    setLocalContent(defaultProjectData.localDraft || defaultProjectData.markdown || "");
    setTestSuite(defaultProjectData.testSuite || {});
    setHiddenSectionIds(defaultProjectData.hiddenSectionIds || []);
    setActivePersonaId(defaultProjectData.activePersonaId || 'default');
    setCustomPersonas(defaultProjectData.customPersonas || []);
    setPromptsConfig(defaultProjectData.promptsConfig || DEFAULT_PROMPTS_CONFIG);
    setCachedCoachAdvice(defaultProjectData.cachedCoachAdvice || null);
    setSelectedId(null);
    activeLineIndexRef.current = null;
    setActiveProjectId(newId);
    setLastAutoSave(null);
    setRevisions(defaultProjectData.revisions || []);

    // Load UI State if present
    const uiState: any = (defaultProjectData as any).uiState;
    if (uiState) {
        if (uiState.sidebarWidth) setSidebarWidth(uiState.sidebarWidth);
        if (uiState.testsPanelWidth) setTestsPanelWidth(uiState.testsPanelWidth);
        if (uiState.focusMode !== undefined) setFocusMode(uiState.focusMode);
        if (uiState.selectedSectionId) setSelectedId(uiState.selectedSectionId);
    }

    await saveCurrentState(newId, newName, defaultProjectData.localDraft || defaultProjectData.markdown || "", defaultProjectData.revisions || []);
  };

  const createNewProject = async () => {
    const newId = `proj_${Date.now()}`;
    const newName = "Untitled Project";
    
    // Reset State to EMPTY to trigger splash screen
    setProjectName(newName);
    setMarkdown("");
    setLocalContent("");
    setTestSuite({});
    setHiddenSectionIds([]);
    setActivePersonaId('default');
    setCustomPersonas([]);
    setPromptsConfig(DEFAULT_PROMPTS_CONFIG);
    setCachedCoachAdvice(null);
    setSelectedId(null);
    activeLineIndexRef.current = null;
    setActiveProjectId(newId);
    setLastAutoSave(null);
    setRevisions([]);

    // Add to meta
    await saveCurrentState(newId, newName, "", []);
  };

  const loadProject = async (id: string): Promise<boolean> => {
    try {
      let data: any = await get(STORAGE_PREFIX + id);
      if (!data) {
        // Fallback to LS
        const raw = localStorage.getItem(STORAGE_PREFIX + id);
        if (raw) {
           data = JSON.parse(raw);
           await set(STORAGE_PREFIX + id, data); // Migrate to IDB immediately
        }
      }
      if (!data) throw new Error("Project data not found");
      
      // If data is a string (rare case from weird migrations), parse it
      if (typeof data === 'string') data = JSON.parse(data);

      setActiveProjectId(id);
      setProjectName(data.projectName || "Untitled");
      setMarkdown(data.markdown || "");
      setLocalContent(data.localDraft !== undefined ? data.localDraft : (data.markdown || ""));
      
      const loadedTestSuite = data.testSuite || {};
      // Migrate legacy string[] dependencies to Dependency[]
      Object.keys(loadedTestSuite).forEach(key => {
        const entry = loadedTestSuite[key];
        if (entry.dependencies && entry.dependencies.length > 0 && typeof entry.dependencies[0] === 'string') {
          entry.dependencies = entry.dependencies.map((depId: string) => ({
            id: depId,
            type: 'prerequisite'
          }));
        }
      });
      setTestSuite(loadedTestSuite);
      
      setHiddenSectionIds(data.hiddenSectionIds || []);
      setLastAutoSave(data.lastModified ? new Date(data.lastModified) : null);
      setRevisions((data.revisions || []).map((r: any) => ({
         ...r,
         markdown: r.markdown || r.content || "",
         testSuite: r.testSuite || {},
      })));
      
      if (data.activePersonaId) setActivePersonaId(data.activePersonaId);
      if (data.customPersonas) setCustomPersonas(data.customPersonas);
      if (data.promptsConfig) setPromptsConfig({...DEFAULT_PROMPTS_CONFIG, ...data.promptsConfig});
      else if (data.interpolationConfig) setPromptsConfig({...DEFAULT_PROMPTS_CONFIG, ...data.interpolationConfig});
      
      setCachedCoachAdvice(data.cachedCoachAdvice || null);
      
      if (data.uiState) {
        if (data.uiState.sidebarWidth) setSidebarWidth(data.uiState.sidebarWidth);
        if (data.uiState.testsPanelWidth) setTestsPanelWidth(data.uiState.testsPanelWidth);
        if (data.uiState.focusMode !== undefined) setFocusMode(data.uiState.focusMode);
        if (data.uiState.selectedSectionId) setSelectedId(data.uiState.selectedSectionId);
        if (data.uiState.activeLineIndex !== undefined) activeLineIndexRef.current = data.uiState.activeLineIndex;
      }
      
      return true;
    } catch (e) {
      console.warn("Failed to load project", e);
      // Suppress toast during initialization but can log it.
      return false;
    }
  };

  const deleteProject = async (id: string) => {
    requestConfirm("Are you sure you want to delete this project?", async () => {
      // Remove data
      await del(STORAGE_PREFIX + id);
      localStorage.removeItem(STORAGE_PREFIX + id); // cleanup fallback
      
      // Remove meta
      const updatedMeta = projectList.filter(p => p.id !== id);
      setProjectList(updatedMeta);
      await set(META_KEY, updatedMeta);

      // If active was deleted, switch to another or create new demo
      if (activeProjectId === id) {
         if (updatedMeta.length > 0) {
           let loaded = false;
           for (const p of updatedMeta) {
               loaded = await loadProject(p.id);
               if (loaded) break;
           }
           if (!loaded) await createDemoProject();
         } else {
           await createDemoProject(); // Fallback to demo if all deleted
         }
      }
    });
  };

  // --- DATA PERSISTENCE ---

  const getStorageData = (currentRevisions: Snapshot[] = revisions) => ({
    projectName,
    markdown,
    localDraft: localContent,
    testSuite,
    hiddenSectionIds,
    activePersonaId,
    customPersonas,
    promptsConfig,
    cachedCoachAdvice,
    revisions: currentRevisions,
    lastModified: Date.now(),
    uiState: {
      sidebarWidth,
      testsPanelWidth,
      focusMode,
      selectedSectionId: selectedId,
      activeLineIndex: activeLineIndexRef.current
    }
  });

  const saveCurrentState = async (id: string, name: string, content: string, currentRevisions: Snapshot[] = revisions) => {
     if (!id) return;
     const data = getStorageData(currentRevisions);
     // Override with current args to ensure sync
     data.projectName = name;
     data.localDraft = content;
     
     await set(STORAGE_PREFIX + id, data);
     
     // Update Meta
     const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
     const metaEntry: ProjectMeta = {
       id,
       name,
       lastModified: Date.now(),
       wordCount
     };
     
     setProjectList(prev => {
        const others = prev.filter(p => p.id !== id);
        const updated = [metaEntry, ...others];
        // We shouldn't use await directly inside a state setter
        set(META_KEY, updated).catch(console.error);
        return updated;
     });
     
     setLastAutoSave(new Date());
  };

  // --- SNAPSHOTS (PREVIOUSLY REVISIONS) ---
  const hashString = async (str: string) => {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createSnapshot = async (trigger: Snapshot['trigger'], affectedScope: Snapshot['affectedScope'] = 'all', configOverride?: PromptsConfig) => {
    if (!activeProjectId) return;
    
    // Hash state for deduplication
    const stateString = JSON.stringify({ markdown: localContent, testSuite, interpolationConfig: configOverride || promptsConfig });
    const contentHash = await hashString(stateString);
    
    setRevisions(prev => {
       const last = prev.length > 0 ? prev[0] : null;
       if (last && last.contentHash === contentHash) {
          return prev; // Dedupe
       }
       
       const newSnapshot: Snapshot = {
          id: `snap_${Date.now()}`,
          timestamp: Date.now(),
          trigger,
          affectedScope,
          contentHash,
          markdown: localContent,
          testSuite: JSON.parse(JSON.stringify(testSuite)),
          interpolationConfig: configOverride || promptsConfig
       };
       const newRevisions = [newSnapshot, ...prev].slice(0, 50); // Keep last 50
       saveCurrentState(activeProjectId, projectName, localContent, newRevisions);
       return newRevisions;
    });
  };

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
       // We save state and snapshot "at regular intervals of time" as requested.
       // createSnapshot already hashes and deduplicates identical states so project files won't grow infinitely.
       refs.saveCurrentState(refs.activeProjectId, refs.projectName, refs.localContent);
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

  // --- PARSING & COMPUTED ---

  // Initialize with correct content based on whether we are loading or new
  const [sections, setSections] = useState<Section[]>(() => parseMarkdown(localContent));

  // --- HELPERS ---

  // Sync sections with content
  useEffect(() => {
    const handler = setTimeout(() => {
      setSections(prevSections => {
        const tree = parseMarkdown(localContent, prevSections);
        
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

        return tree;
      });
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
        if (activeProjectId) saveCurrentState(activeProjectId, targetName, markdown);
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
         
         // 1. Save directly to DB to preserve all imported fields exactly as they were
         await set(STORAGE_PREFIX + newId, projectData);
         
         // 2. Update Meta
         const contentForWordCount = projectData.localDraft || projectData.markdown || "";
         const wordCount = contentForWordCount.trim() === '' ? 0 : contentForWordCount.trim().split(/\s+/).length;
         
         const metaEntry: ProjectMeta = {
            id: newId,
            name: newName,
            lastModified: Date.now(),
            wordCount
         };
         
         setProjectList(prev => {
            const others = prev.filter(p => p.id !== newId);
            const updated = [metaEntry, ...others];
            set(META_KEY, updated).catch(console.error);
            return updated;
         });
         
         // 3. Load via `loadProject` to ensure all fields and UI are correctly hydrated sequentially
         await loadProject(newId);
         
       } catch(e) {
         toast.error("Invalid file.");
       }
    });
  };

  const handleExportProject = () => {
    const data = getStorageData();
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

  const handleInterpolateTasks = async (
  modelId: string, 
  thinkingBudget: number, 
  config: PromptsConfig
) => {
  if (!sections || sections.length === 0) return;
  setShowInterpolationModal(false);
  setIsInterpolating(true);
  
  // Create snapshot before destructive AI action
  await createSnapshot('pre-ai-write', 'all', config);
  
  setPromptsConfig(config);

  try {
    await generateStructuredSpecs(
      sections,
      markdown,
      config,
      modelId,
      thinkingBudget,
      {
        onBatchComplete: (specs) => {
          setTestSuite(prev => {
            const next = { ...prev };
            Object.entries(specs).forEach(([id, spec]) => {
              const existing = next[id] || { goals: '', status: 'idle', history: [] };
              next[id] = {
                ...existing,
                spec,
                mainClaim: spec.mainClaim,
                // Serialize moves to goals string for backward compat
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
      }
    );
  } catch (e) {
    console.error("Interpolation failed", e);
    toast.error("Task interpolation failed. Check console/API Key.");
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
 
  try {
    const diagnostic = await runDiagnosticEvaluation({
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
  } catch (e) {
    console.error("Diagnostic evaluation failed:", e);
    setTestSuite(prev => ({
      ...prev,
      [testId]: { ...prev[testId], status: 'fail' }
    }));
  } finally {
    setIsProcessing(false);
  }
};

  const updateSpec = useCallback((id: string, spec: SectionSpec) => {
    setTestSuite(prev => {
      const entry = prev[id] || { goals: '', status: 'idle', history: [] };
      return {
        ...prev,
        [id]: {
          ...entry,
          spec,
          // Keep mainClaim in sync
          mainClaim: spec.mainClaim,
          // Serialize spec to goals for backward compat
          goals: spec.requiredMoves.map(m => m.description).join('\n'),
          status: 'stale',
          history: [
            ...(entry.history || []),
            { timestamp: Date.now(), goals: entry.goals, type: 'manual' as const }
          ]
        }
      };
    });
  }, []);
 

  const updateGoals = useCallback((text: string) => {
    if (!currentSection) return;
    setTestSuite(prev => {
      const entry = prev[currentSection.id] || { goals: '', status: 'idle', history: [] };
      return {
        ...prev,
        [currentSection.id]: {
          ...entry,
          goals: text,
          status: 'stale',
          history: [...(entry.history || []), { timestamp: Date.now(), goals: entry.goals, type: 'manual' }]
        }
      };
    });
  }, [currentSection]);

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
      const depsMap = await generateDependenciesEstimation(sections, testSuite, 'gemini-3.1-pro-preview', 1024, promptsConfig);
      
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

  const updateMainClaim = useCallback((id: string, text: string) => {
    setTestSuite(prev => {
      const entry = prev[id] || { goals: '', status: 'idle', history: [] };
      return {
        ...prev,
        [id]: {
          ...entry,
          mainClaim: text
        }
      };
    });
  }, []);

  const getParentGoals = () => {
    if (!currentSection || !currentSection.parentId) return undefined;
    return testSuite[currentSection.parentId]?.goals;
  };

  const toggleSectionVisibility = (id: string) => {
    setHiddenSectionIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

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
    <div className={isDarkMode ? "dark" : ""}>
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
      <Tutorial isDarkMode={isDarkMode} run={runTutorial} onFinish={handleTutorialFinish} />
      <div className="flex h-screen w-full bg-slate-50 dark:bg-hld-bg text-slate-800 dark:text-hld-text overflow-hidden transition-colors duration-200 font-sans">
        <Sidebar 
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          markdown={markdown}
          sections={sections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onImportMarkdown={handleImportMarkdown}
          onLoadProject={handleLoadFile}
          onSaveProject={handleExportProject}
          onExportMarkdown={handleExportMarkdown}
          onResetProject={() => createNewProject()}
          onLoadDefaultProject={() => createDemoProject()}
          onOpenProjectManager={() => setShowProjectModal(true)}
          projectName={projectName}
          setProjectName={setProjectName}
          width={sidebarWidth}
          setWidth={setSidebarWidth}
          hiddenSectionIds={hiddenSectionIds}
          testSuite={testSuite}
          onInterpolateTasks={() => setShowInterpolationModal(true)}
          onSprintGoals={() => setShowGoalSprintModal(true)}
          onSprintContent={() => setShowContentSprintModal(true)}
          isInterpolating={isInterpolating}
          onOpenDependencyGraph={() => setShowGraphModal(true)}
          onOpenPromptsGraph={() => setShowPromptsGraphModal(true)}
          onOpenSectionMap={() => setShowSectionMapModal(true)}
          onOpenProjectFileEditor={() => setShowProjectFileModal(true)}
          onStartTutorial={() => setRunTutorial(true)}
          onOpenCoach={() => setShowCoachModal(true)}
        />

        <div className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-hld-bg relative">
          <EditorPanel 
            currentSection={currentSection}
            testSuite={testSuite}
            localContent={localContent}
            setLocalContent={setLocalContent}
            handleSave={handleManualSave}
            lastAutoSave={lastAutoSave}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            editorRef={editorRef}
            hiddenSectionIds={hiddenSectionIds}
            toggleSectionVisibility={toggleSectionVisibility}
            onImportMarkdown={handleImportMarkdown}
            onLoadProject={handleLoadFile}
            focusMode={focusMode}
            toggleFocusMode={() => setFocusMode(!focusMode)}
            onLineFocus={handleLineFocus}
            initialLineIndex={activeLineIndexRef.current}
            sections={sections}
            onSectionChange={setSelectedId}
            onOpenHistory={() => setShowHistoryModal(true)}
            projectName={projectName}
          />
        </div>

        <TestsPanel 
          currentSection={currentSection}
          testSuite={testSuite}
          updateGoals={updateGoals}
          updateDependencies={updateDependencies}
          updateMainClaim={updateMainClaim}
          updateSpec={updateSpec}              // <-- ADD THIS
          allSections={sections}
          onRunTests={() => setShowRunModal(true)}
          isProcessing={isProcessing}
          width={testsPanelWidth}
          setWidth={setTestsPanelWidth}
          activePersona={activePersona}
          onOpenSettings={() => setShowPersonaModal(true)}
          onOpenSpecRefinement={() => setShowSpecModal(true)}
          onOpenSuggestions={() => setShowSuggestionsModal(true)}
        />

        {/* Modals */}
        <TestRunnerModal 
          isOpen={showRunModal} 
          onClose={() => setShowRunModal(false)}
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
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
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
              saveCurrentState(activeProjectId, projectName, snapshot.markdown, revisions);
            }
          }}
        />

        <PersonaSettingsModal 
          isOpen={showPersonaModal}
          onClose={() => setShowPersonaModal(false)}
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
          isOpen={showSpecModal}
          onClose={() => setShowSpecModal(false)}
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
          isOpen={showInterpolationModal}
          onClose={() => setShowInterpolationModal(false)}
          onConfirm={handleInterpolateTasks}
          documentStats={documentStats}
          initialConfig={promptsConfig}
        />

        <SprintModal
          isOpen={showGoalSprintModal}
          onClose={() => setShowGoalSprintModal(false)}
          sections={sections}
          testSuite={testSuite}
          mode="goal"
          onSaveGoal={updateSectionGoals}
        />

        <SprintModal
          isOpen={showContentSprintModal}
          onClose={() => setShowContentSprintModal(false)}
          sections={sections}
          testSuite={testSuite}
          mode="content"
          onSaveContent={handleSaveContent}
        />

        <ProjectManagerModal 
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
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
          onDeleteProject={deleteProject}
        />

        <ContentSuggestionsModal
          isOpen={showSuggestionsModal}
          onClose={() => setShowSuggestionsModal(false)}
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
          isOpen={showGraphModal}
          onClose={() => setShowGraphModal(false)}
          sections={sections}
          testSuite={testSuite}
          updateDependencies={updateDependencies}
          onEstimateDependencies={handleEstimateDependencies}
        />

        <ProjectFileModal
          isOpen={showProjectFileModal}
          onClose={() => setShowProjectFileModal(false)}
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
          isOpen={showCoachModal}
          onClose={() => setShowCoachModal(false)}
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
          isOpen={showPromptsGraphModal}
          onClose={() => setShowPromptsGraphModal(false)}
          promptsConfig={promptsConfig}
          setPromptsConfig={setPromptsConfig}
        />

        <SectionMapModal
          isOpen={showSectionMapModal}
          onClose={() => setShowSectionMapModal(false)}
          sections={sections}
          testSuite={testSuite}
          onUpdateGoals={(id, goals) => updateSectionGoals(id, goals, 'manual')}
        />

        <Toaster position="bottom-right" richColors />
      </div>
    </div>
  );
};