import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { Sidebar } from "./features/sidebar/Sidebar";
import { EditorPanel } from "./features/editor/EditorPanel";
import { TestsPanel } from "./features/tests-panel/TestsPanel";
import { ModalLayer } from "./features/modals/ModalLayer";
import { type Command } from "./features/modals/CommandPaletteModal";
import { ConfirmModal } from "./features/modals/ConfirmModal";
import { Tutorial } from "./features/tutorial/Tutorial";
import { useLegacyMigration } from "./features/migration/use-legacy-migration";
import { parseMarkdown, flattenSectionsForIndex, buildRootSection } from "./lib/utils";
import { replaceSectionContent } from "./lib/section-edit";
import { repository } from "./services/repository-registry";
import { selectSpecMap } from "./lib/spec-map";
import { createMarkdownExport } from "./lib/markdownExport";
import { buildProjectExport } from "./lib/projectExport";
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
import { useAutosave } from './features/shared/useAutosave';
import { notifyAiError } from './features/shared/ai-error';
import { AiActivityIndicator } from './features/shared/AiActivityIndicator';
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

// Deepest section CONTAINING the line — the selection-retention fallback when a
// derived id dies (heading rename, undo past a structural edit). Containment
// (not exact heading-line match) so the caret's position always names a home.
const findSectionByLine = (nodes: Section[], line: number): Section | null => {
  for (const node of nodes) {
    if (line >= node.startLine && line <= node.endLine) {
      return findSectionByLine(node.children, line) || node;
    }
  }
  return null;
};

export const App = () => {
  // Only what the layout shell itself still touches. The modal/workspace data
  // and most setters now live in ModalLayer, which subscribes to them directly,
  // so App no longer over-subscribes (and no longer re-renders on their churn).
  const {
    activeProjectId, hasOpenProject, markdown, projectName, testSuite,
    localContent, sections, selectedId, runTutorial,
    activePersonaId, customPersonas, promptsConfig,

    setLocalContent, setSections, setMarkdown, setProjectName, setTestSuite,
    setHiddenSectionIds, setSelectedId, setRunTutorial, setShowRunModal, setIsProcessing,

    loadInitialState, createDemoProject, createNewProject, loadProject,
    saveCurrentState, createSnapshot,
  } = useStore(useShallow(state => ({
    activeProjectId: state.activeProjectId,
    hasOpenProject: state.hasOpenProject,
    markdown: state.markdown,
    projectName: state.projectName,
    testSuite: state.testSuite,
    localContent: state.localContent,
    sections: state.sections,
    selectedId: state.selectedId,
    runTutorial: state.runTutorial,
    activePersonaId: state.activePersonaId,
    customPersonas: state.customPersonas,
    promptsConfig: state.promptsConfig,

    setLocalContent: state.setLocalContent,
    setSections: state.setSections,
    setMarkdown: state.setMarkdown,
    setProjectName: state.setProjectName,
    setTestSuite: state.setTestSuite,
    setHiddenSectionIds: state.setHiddenSectionIds,
    setSelectedId: state.setSelectedId,
    setRunTutorial: state.setRunTutorial,
    setShowRunModal: state.setShowRunModal,
    setIsProcessing: state.setIsProcessing,

    loadInitialState: state.loadInitialState,
    createDemoProject: state.createDemoProject,
    createNewProject: state.createNewProject,
    loadProject: state.loadProject,
    saveCurrentState: state.saveCurrentState,
    createSnapshot: state.createSnapshot,
  })));

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

  const isFirstRender = useRef(true);

  // The 60s autosave/snapshot loop (interval, overlap guard, error surfacing)
  // lives in its own hook so the layout shell stays a layout shell.
  useAutosave();

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
        
        // Selection retention logic. When a heading rename kills the derived id,
        // fall back to the caret's live line (reported by the editor), which sits
        // on the renamed heading in exactly that case.
        setSelectedId(prev => {
           if (prev) {
              const exists = findSection(tree, prev);
              if (!exists && prev !== 'root') {
                 const caretLine = useStore.getState().activeLineIndex;
                 const candidate = caretLine !== null ? findSectionByLine(tree, caretLine) : null;
                 return candidate ? candidate.id : tree[0]?.id ?? null;
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
        useStore.getState().setActiveLineIndex(null);
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

  // Clean export: the prose exactly as written — no YAML frontmatter, no spec
  // comments — ready for pandoc or a supervisor. (The annotated round-trip
  // export keeps its own entry.)
  const handleExportCleanMarkdown = () => {
    const blob = new Blob([useStore.getState().localContent], { type: "text/markdown" });
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

  // Read the LIVE buffer at call time and parse it fresh. The closure's
  // `markdown` is the committed copy (up to 60s stale) and `sections` is the
  // 300ms-debounced parse — an expensive AI verdict must never be computed on
  // text that isn't what's on screen. One parse feeds everything below.
  const liveDoc = useStore.getState().localContent;
  const liveSections = parseMarkdown(liveDoc, sections);
  const liveSection =
    testId === 'root'
      ? buildRootSection(liveDoc, liveSections, projectName?.trim() || 'Whole Document')
      : findSection(liveSections, testId);
  if (!liveSection) {
    toast.error("Couldn't locate that section — it may have just been renamed.");
    return;
  }

  // Whole-document evaluation forces full scope. The diagnostic sends the scoped
  // content whole (no per-section cap), so pre-flight the exact text the provider
  // will assemble and abort on overflow — never silently truncate.
  let effectiveScope: 'segment' | 'parent' | 'full' = scope;
  if (testId === 'root') effectiveScope = 'full';

  let diagContent = liveSection.fullContent;
  if (effectiveScope === 'full') {
    diagContent = liveDoc;
  } else if (effectiveScope === 'parent' && liveSection.parentId) {
    const parent = findSection(liveSections, liveSection.parentId);
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
  
  let diagOpId: string | null = null;
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
    diagOpId = useStore.getState().beginOp({ label: 'Running diagnostic…' });

    // Spec map (sectionId → spec, incl. 'root') so the diagnostic can judge this
    // section as a part inside its live structural surround, not as an isolated piece.
    const specs = selectSpecMap(testSuite);

    const diagnostic = await aiProvider.runDiagnostic({
      section: liveSection,
      spec,
      scope: effectiveScope,
      modelChoice: choice,
      persona: activePersona,
      customInstruction: instruction,
      fullDocument: liveDoc,
      sections: liveSections,
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
    if (diagOpId) useStore.getState().endOp(diagOpId);
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
    const opId = useStore.getState().beginOp({ label: 'Estimating dependencies…' });
    try {
      toast.info("Estimating dependencies...", { id: "est-deps" });
      const depsMap = await aiProvider.estimateDependencies({
        sections,
        testSuite,
        structuralParts: useStore.getState().structuralParts,
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
      // Clear the "Estimating…" loading toast, then surface the failure through the
      // shared handler so a missing key / quota exhaustion gets its actionable toast.
      toast.dismiss("est-deps");
      notifyAiError(e, "Failed to estimate dependencies.");
    } finally {
      useStore.getState().endOp(opId);
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
    // matches what is actually on screen. The splice itself lives in
    // lib/section-edit (round-trip tested: saving a section's own content back
    // unchanged is byte-identity, childless sections included).
    const prev = useStore.getState().localContent;
    const next = replaceSectionContent(prev, sectionId, newContent, useStore.getState().sections);
    if (next === null) {
      toast.error("Couldn't locate that section to save — it may have been renamed.");
      return;
    }

    setLocalContent(next);
    // Persist immediately rather than waiting up to 60s for the next autosave —
    // a sprint edit must survive a crash/close in that window.
    if (activeProjectId) void saveCurrentState();
  };

  // Command palette entries — the named, searchable door to every primary action
  // (the consolidation of the Coach/Generate-specs/Revise glyphs). Built each
  // render so the App-level handlers stay current; store openers are reached via
  // getState() to avoid widening the selector.
  const paletteCommands: Command[] = [
    { id: 'sprint', label: 'Sprint', hint: 'Goal or draft · timed', glyph: '»', run: () => useStore.getState().setShowSprintModal(true) },
    { id: 'coach', label: 'Coach', hint: 'Stuck? Find the bottleneck', glyph: '◉', run: () => useStore.getState().setShowCoachModal(true) },
    { id: 'articulate', label: 'Articulate', hint: 'Segment a text into its natural parts', glyph: '⑂', run: () => useStore.getState().openSegment() },
    { id: 'generate-specs', label: 'Generate specs', hint: 'Structural analysis, top-down', glyph: '✦', run: () => useStore.getState().startSpecSweep() },
    { id: 'revise', label: 'Revise', hint: 'Glass Box revision workspace', glyph: '⟐', run: () => useStore.getState().openRevisionWorkspace() },
    { id: 'parallel', label: 'Parallel', hint: 'Reverse-outline revision', glyph: '▥', run: () => useStore.getState().openParallel(false) },
    { id: 'gist', label: 'Gist', hint: 'Whole-at-once re-entry surface', glyph: '◊', run: () => useStore.getState().openGist() },
    { id: 'find-text', label: 'Find in text', hint: 'Search & replace in the manuscript', glyph: '⌕', shortcut: '⌘F', run: () => useStore.getState().requestEditorSearch() },
    { id: 'export-clean-md', label: 'Export clean markdown', hint: 'Prose only — no frontmatter or spec comments', glyph: '↧', run: handleExportCleanMarkdown },
    { id: 'run-diagnostic', label: 'Run diagnostic', hint: 'Evaluate current section', glyph: '▶', shortcut: '⌘⏎', run: () => useStore.getState().setShowRunModal(true) },
    { id: 'goal-map', label: 'Goal map', hint: 'Section goal editor', glyph: '▦', run: () => useStore.getState().setShowSectionMapModal(true) },
    { id: 'dependencies', label: 'Dependencies', hint: 'Section graph', glyph: '◈', run: () => useStore.getState().setShowGraphModal(true) },
    { id: 'prompts', label: 'Prompts', hint: 'AI routing', glyph: '❝', run: () => useStore.getState().setShowPromptsGraphModal(true) },
    { id: 'compare', label: 'Compare versions', hint: 'A/B evaluation', glyph: '≈', run: () => useStore.getState().openCompare() },
    { id: 'spec-test', label: 'Spec test', hint: 'A/B against the rubric · whole + parts', glyph: '▣', run: () => useStore.getState().openSpecTest() },
    { id: 'climate', label: 'Climate', hint: 'Atmospheric report', glyph: '≋', run: () => useStore.getState().openClimate() },
    { id: 'doctor', label: 'Outline Doctor', hint: 'Reverse-outline diagnosis · revision checklist', glyph: '≣', run: () => useStore.getState().openDoctor() },
    { id: 'history', label: 'Version history', hint: 'Snapshots & restore', glyph: '◷', run: () => useStore.getState().setShowHistoryModal(true) },
    { id: 'snapshot', label: 'Snapshot now', hint: 'Commit a labeled version', glyph: '◆', shortcut: '⌘S', run: handleManualSave },
    { id: 'new-project', label: 'New project', glyph: '＋', run: () => createNewProject() },
    { id: 'open-projects', label: 'Open projects', glyph: '◇', run: () => useStore.getState().setShowProjectModal(true) },
    { id: 'sync', label: 'Sync', hint: 'GitHub remote · status & setup', glyph: '⇅', run: () => useStore.getState().setShowSyncConfigModal(true) },
    ...(isTauri()
      ? [{ id: 'new-from-remote', label: 'New from remote', hint: 'Clone, or create & publish', glyph: '↓', run: () => useStore.getState().setShowRemoteProjectModal(true) }]
      : []),
    { id: 'export-markdown', label: 'Export markdown', glyph: '↧', run: handleExportMarkdown },
    { id: 'export-project', label: 'Export project', hint: '.socratic', glyph: '↧', run: handleExportProject },
    { id: 'export-specs', label: 'Export specs', hint: '.json', glyph: '↧', run: handleExportSpecs },
  ];

  const saveError = useStore((s) => s.saveError);

  return (
    <div className="dark">
      {saveError && (
        <div
          role="alert"
          className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3 bg-red-700 px-4 py-1.5 text-center text-sm font-semibold text-white shadow-lg"
        >
          <span aria-hidden>⚠</span>
          <span>{saveError}</span>
        </div>
      )}
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
            // Return to the cursor: select the last section (a no-op when
            // unchanged) and ask the editor to focus + restore its resume
            // caret — the store counter reaches it even when selection is
            // already right, the case the old dead-ref wiring missed.
            const s = useStore.getState();
            const targetId = s.selectedId ?? s.sections[0]?.id ?? null;
            if (targetId) setSelectedId(targetId);
            requestAnimationFrame(() => useStore.getState().requestEditorFocus());
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

        <div className="flex-1 min-w-0 flex flex-col h-full bg-hld-bg relative">
          <EditorPanel
            handleSave={handleManualSave}
            onImportMarkdown={handleImportMarkdown}
            onLoadProject={handleLoadFile}
          />
        </div>

        <TestsPanel />

        {/* All modals/workspaces — each self-mounts on its own store flag. */}
        <ModalLayer
          currentSection={currentSection}
          documentStats={documentStats}
          activePersona={activePersona}
          handleRunTests={handleRunTests}
          getParentGoals={getParentGoals}
          handleSaveContent={handleSaveContent}
          handleEstimateDependencies={handleEstimateDependencies}
          updateDependencies={updateDependencies}
          requestConfirm={requestConfirm}
          paletteCommands={paletteCommands}
        />

        <Toaster position="bottom-right" richColors />
        <AiActivityIndicator />
      </div>
    </div>
  );
};