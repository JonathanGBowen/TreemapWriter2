import React, { useState, useEffect, useMemo, useRef } from "react";
import { Toaster, toast } from "sonner";
import { Sidebar } from "./features/sidebar/Sidebar";
import { EditorPanel } from "./features/editor/EditorPanel";
import { TestsPanel } from "./features/tests-panel/TestsPanel";
import { ModalLayer } from "./features/modals/ModalLayer";
import { type Command } from "./features/modals/shared/CommandPaletteModal";
import { ConfirmModal } from "./features/modals/shared/ConfirmModal";
import { Tutorial } from "./features/tutorial/Tutorial";
import { useLegacyMigration } from "./features/migration/use-legacy-migration";
import { replaceSectionContent } from "./lib/section-edit";
import { Section } from "./types";
import { hasSeenTutorial, markTutorialSeen } from './services/preferences';
import { DEFAULT_PERSONAS } from './lib/defaultPersonas';
import { useAutosave } from './features/shared/useAutosave';
import { useSectionSync } from './features/shared/useSectionSync';
import { useGlobalKeybindings } from './features/shared/useGlobalKeybindings';
import { AiActivityIndicator } from './features/shared/AiActivityIndicator';
import { useExportActions } from './features/shared/use-export-actions';
import { useImportActions } from './features/shared/use-import-actions';
import { useDiagnosticRunner } from './features/tests-panel/use-diagnostic-runner';
import { initSyncPolicy, teardownSyncPolicy } from './services/sync-policy';
import { isTauri } from './services/tauri-environment';
import { useStore } from './store';
import { useShallow } from 'zustand/react/shallow';

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

export const App = () => {
  // Only what the layout shell itself still touches. The modal/workspace data
  // and most setters now live in ModalLayer, which subscribes to them directly,
  // so App no longer over-subscribes (and no longer re-renders on their churn).
  const {
    activeProjectId, hasOpenProject,
    localContent, sections, selectedId, runTutorial,
    activePersonaId, customPersonas,

    setLocalContent, setSelectedId, setRunTutorial,

    loadInitialState, createDemoProject, createNewProject,
    saveCurrentState, createSnapshot,
  } = useStore(useShallow(state => ({
    activeProjectId: state.activeProjectId,
    hasOpenProject: state.hasOpenProject,
    localContent: state.localContent,
    sections: state.sections,
    selectedId: state.selectedId,
    runTutorial: state.runTutorial,
    activePersonaId: state.activePersonaId,
    customPersonas: state.customPersonas,

    setLocalContent: state.setLocalContent,
    setSelectedId: state.setSelectedId,
    setRunTutorial: state.setRunTutorial,

    loadInitialState: state.loadInitialState,
    createDemoProject: state.createDemoProject,
    createNewProject: state.createNewProject,
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

  const { exportProject, exportMarkdown, exportCleanMarkdown, exportSpecs } = useExportActions();
  const { importMarkdown, loadFile } = useImportActions(requestConfirm);

  const isFirstRender = useRef(true);

  useAutosave();
  useSectionSync();
  useGlobalKeybindings();

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

  const handleManualSave = () => {
    if (activeProjectId) {
      void createSnapshot('manual');
    }
  };

  // --- HELPERS ---

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

  // Diagnostic runner, dependency estimation, and parent-goal lookup.
  const { runDiagnostic, estimateDependencies, updateDependencies, getParentGoals } =
    useDiagnosticRunner(currentSection, activePersona);

  const handleSaveContent = (sectionId: string, newContent: string) => {
    const prev = useStore.getState().localContent;
    const next = replaceSectionContent(prev, sectionId, newContent, useStore.getState().sections);
    if (next === null) {
      toast.error("Couldn't locate that section to save — it may have been renamed.");
      return;
    }

    setLocalContent(next);
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
    { id: 'export-clean-md', label: 'Export clean markdown', hint: 'Prose only — no frontmatter or spec comments', glyph: '↧', run: exportCleanMarkdown },
    { id: 'run-diagnostic', label: 'Run diagnostic', hint: 'Evaluate current section', glyph: '▶', shortcut: '⌘⏎', run: () => useStore.getState().setShowRunModal(true) },
    { id: 'goal-map', label: 'Goal map', hint: 'Section goal editor', glyph: '▦', run: () => useStore.getState().setShowSectionMapModal(true) },
    { id: 'dependencies', label: 'Dependencies', hint: 'Section graph', glyph: '◈', run: () => useStore.getState().setShowGraphModal(true) },
    { id: 'prompts', label: 'Prompts', hint: 'AI routing', glyph: '❝', run: () => useStore.getState().setShowPromptsGraphModal(true) },
    { id: 'raw-data', label: 'Raw data', hint: 'JSON editor', glyph: '{}', run: () => useStore.getState().setShowProjectFileModal(true) },
    { id: 'compare', label: 'Compare versions', hint: 'A/B evaluation', glyph: '≈', run: () => useStore.getState().openCompare() },
    { id: 'spec-test', label: 'Spec test', hint: 'A/B against the rubric · whole + parts', glyph: '▣', run: () => useStore.getState().openSpecTest() },
    { id: 'climate', label: 'Climate', hint: 'Atmospheric report', glyph: '≋', run: () => useStore.getState().openClimate() },
    { id: 'doctor', label: 'Outline Doctor', hint: 'Reverse-outline diagnosis · revision checklist', glyph: '≣', run: () => useStore.getState().openDoctor() },
    { id: 'history', label: 'Version history', hint: 'Snapshots & restore', glyph: '◷', run: () => useStore.getState().setShowHistoryModal(true) },
    { id: 'snapshot', label: 'Snapshot now', hint: 'Commit a labeled version', glyph: '◆', shortcut: '⌘S', run: handleManualSave },
    { id: 'new-project', label: 'New project', glyph: '＋', run: () => createNewProject() },
    { id: 'open-projects', label: 'Open projects', glyph: '◇', run: () => useStore.getState().setShowProjectModal(true) },
    { id: 'export-markdown', label: 'Export markdown', glyph: '↧', run: exportMarkdown },
    { id: 'export-project', label: 'Export project', hint: '.socratic', glyph: '↧', run: exportProject },
    { id: 'export-specs', label: 'Export specs', hint: '.json', glyph: '↧', run: exportSpecs },
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
          onImportMarkdown={importMarkdown}
          onLoadProject={loadFile}
          onSaveProject={exportProject}
          onExportMarkdown={exportMarkdown}
          onExportSpecs={exportSpecs}
          onResetProject={() => createNewProject()}
          onLoadDefaultProject={() => createDemoProject()}
          onStartTutorial={() => setRunTutorial(true)}
        />

        <div className="flex-1 min-w-0 flex flex-col h-full bg-hld-bg relative">
          <EditorPanel
            handleSave={handleManualSave}
            onImportMarkdown={importMarkdown}
            onLoadProject={loadFile}
          />
        </div>

        <TestsPanel />

        {/* All modals/workspaces — each self-mounts on its own store flag. */}
        <ModalLayer
          currentSection={currentSection}
          documentStats={documentStats}
          activePersona={activePersona}
          handleRunTests={runDiagnostic}
          getParentGoals={getParentGoals}
          handleSaveContent={handleSaveContent}
          handleEstimateDependencies={estimateDependencies}
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