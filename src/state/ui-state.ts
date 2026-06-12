import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { PendingMerge } from '../types';

/**
 * UI ephemera. Modal openness, panel widths, focus mode, and other state
 * that only exists to drive the view. Lost on reload — and that is fine.
 *
 * Per AGENTS.md: never put domain data here. Per ADHD heuristics: never
 * persist these between sessions; they should not affect a re-entered
 * working state.
 */
export interface UIStateSlice {
  // Layout
  sidebarWidth: number;
  testsPanelWidth: number;
  focusMode: boolean;
  runTutorial: boolean;
  activeTab: 'editor' | 'preview';

  // In-flight indicators
  isProcessing: boolean;
  isInterpolating: boolean;

  // Sync status (Phase 4). 'no-remote' hides the indicator entirely.
  // 'conflict' (Phase 5) latches when a merge needs in-app resolution.
  syncStatus: 'no-remote' | 'idle' | 'pulling' | 'pushing' | 'error' | 'conflict';
  syncError: string | null;
  // Commits the local branch is ahead/behind its upstream. ahead > 0 means
  // unpushed work exists — the indicator must read as such, never "synced".
  syncAhead: number;
  syncBehind: number;
  // Phase 5: latched conflict data while the resolution modal is live. Non-null
  // means sync is paused and autosave commits are suppressed until resolved.
  pendingMerge: PendingMerge | null;

  // Modal openness flags (one boolean per modal, like the original store)
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
  showMigrationModal: boolean;
  showSyncConfigModal: boolean;
  showConflictModal: boolean;

  // Setters
  setSidebarWidth: (w: number) => void;
  setTestsPanelWidth: (w: number) => void;
  setFocusMode: (mode: boolean) => void;
  setRunTutorial: (run: boolean) => void;
  setActiveTab: (tab: 'editor' | 'preview') => void;
  setIsProcessing: (proc: boolean) => void;
  setIsInterpolating: (interp: boolean) => void;
  setSyncStatus: (status: 'no-remote' | 'idle' | 'pulling' | 'pushing' | 'error' | 'conflict') => void;
  setSyncError: (err: string | null) => void;
  setSyncCounts: (ahead: number, behind: number) => void;
  setPendingMerge: (merge: PendingMerge | null) => void;
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
  setShowMigrationModal: (show: boolean) => void;
  setShowSyncConfigModal: (show: boolean) => void;
  setShowConflictModal: (show: boolean) => void;
}

export const createUIStateSlice: StateCreator<AppState, [], [], UIStateSlice> = (set) => ({
  sidebarWidth: 320,
  testsPanelWidth: 350,
  focusMode: true,
  runTutorial: false,
  activeTab: 'editor',

  isProcessing: false,
  isInterpolating: false,

  syncStatus: 'no-remote',
  syncError: null,
  syncAhead: 0,
  syncBehind: 0,
  pendingMerge: null,

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
  showMigrationModal: false,
  showSyncConfigModal: false,
  showConflictModal: false,

  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setTestsPanelWidth: (w) => set({ testsPanelWidth: w }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setRunTutorial: (run) => set({ runTutorial: run }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setIsProcessing: (proc) => set({ isProcessing: proc }),
  setIsInterpolating: (interp) => set({ isInterpolating: interp }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncError: (err) => set({ syncError: err }),
  setSyncCounts: (ahead, behind) => set({ syncAhead: ahead, syncBehind: behind }),
  setPendingMerge: (merge) => set({ pendingMerge: merge }),
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
  setShowMigrationModal: (show) => set({ showMigrationModal: show }),
  setShowSyncConfigModal: (show) => set({ showSyncConfigModal: show }),
  setShowConflictModal: (show) => set({ showConflictModal: show }),
});
