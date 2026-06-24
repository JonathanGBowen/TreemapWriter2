import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { PendingMerge, Section } from '../types';
import { repository } from '../services/repository-registry';

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
  /** Revision Workspace column widths (left rail, right proposals). */
  revisionRailWidth: number;
  revisionProposalsWidth: number;
  /** Version Compare workspace right report-column width. */
  compareReportWidth: number;
  focusMode: boolean;
  runTutorial: boolean;
  /**
   * Ambient cueing (the non-initiated coach). Default-on: this is the
   * prosthetic that does not wait to be asked, so it must be present without a
   * button press. Never persisted.
   */
  ambientCueEnabled: boolean;
  /** Editor structural-surround rail collapsed (glance vs hidden). */
  surroundCollapsed: boolean;
  /**
   * Section id whose ambient cue the user soft-dismissed this visit. Cleared on
   * section change so a re-entered section cues again — undo, not a persisted off.
   */
  cueDismissedForId: string | null;
  activeTab: 'editor' | 'preview';
  /** Which surface the right panel shows. Ephemeral, like activeTab. */
  testsPanelTab: 'spec' | 'analysis' | 'dialogue';

  // Full-text search (desktop). Ephemeral — never persisted between sessions.
  /** Live query string in the sidebar search box. */
  searchQuery: string;
  /** Section ids matching the current query — drives the treemap highlight. */
  searchMatchedIds: string[];

  // In-flight indicators
  isProcessing: boolean;

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
  /** Cmd/Ctrl+K command palette — the keyboard door to every primary action. */
  showCommandPalette: boolean;
  showRunModal: boolean;
  showPersonaModal: boolean;
  showGrimoireModal: boolean;
  showSpecModal: boolean;
  showPromptsGraphModal: boolean;
  showSectionMapModal: boolean;
  showProjectFileModal: boolean;
  /** One sprint surface; `sprintMode` selects goal-framing vs drafting. */
  showSprintModal: boolean;
  sprintMode: 'goal' | 'content';
  showHistoryModal: boolean;
  showGraphModal: boolean;
  showCoachModal: boolean;
  showMigrationModal: boolean;
  showSyncConfigModal: boolean;
  showConflictModal: boolean;
  showRemoteProjectModal: boolean;
  /** Revision feature settings (instruction · model · token preview · prompts). */
  showRevisionSettingsModal: boolean;
  /** Agent SDK activity-trace audit viewer (opened from AI settings; not front-and-center). */
  showAgentTraceModal: boolean;
  // project.md changed on disk outside the app while the editor had unsaved
  // edits — prompt the user to reload or overwrite (see sync-policy).
  showExternalChangeModal: boolean;
  /** Session ceremony check-in / check-out (the standalone Start/End boundary). */
  showSessionModal: boolean;

  // Setters
  setSidebarWidth: (w: number) => void;
  setTestsPanelWidth: (w: number) => void;
  setRevisionRailWidth: (w: number) => void;
  setRevisionProposalsWidth: (w: number) => void;
  setCompareReportWidth: (w: number) => void;
  setFocusMode: (mode: boolean) => void;
  setRunTutorial: (run: boolean) => void;
  setAmbientCueEnabled: (on: boolean) => void;
  setSurroundCollapsed: (collapsed: boolean) => void;
  setCueDismissedForId: (id: string | null) => void;
  setActiveTab: (tab: 'editor' | 'preview') => void;
  setTestsPanelTab: (tab: 'spec' | 'analysis' | 'dialogue') => void;
  /** Set the search query text (store-driven so it survives a project switch). */
  setSearchQuery: (q: string) => void;
  /** Run a full-text search and update `searchMatchedIds` (validated against
   *  the live, visible section tree, so a stale index or a hidden section can't
   *  highlight or count a tile that isn't on screen). */
  runSectionSearch: (query: string) => Promise<void>;
  /** Clear the query and the highlight. */
  clearSearch: () => void;
  setIsProcessing: (proc: boolean) => void;
  setSyncStatus: (status: 'no-remote' | 'idle' | 'pulling' | 'pushing' | 'error' | 'conflict') => void;
  setSyncError: (err: string | null) => void;
  setSyncCounts: (ahead: number, behind: number) => void;
  setPendingMerge: (merge: PendingMerge | null) => void;
  setShowProjectModal: (show: boolean) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowRunModal: (show: boolean) => void;
  setShowPersonaModal: (show: boolean) => void;
  setShowGrimoireModal: (show: boolean) => void;
  setShowSpecModal: (show: boolean) => void;
  setShowPromptsGraphModal: (show: boolean) => void;
  setShowSectionMapModal: (show: boolean) => void;
  setShowProjectFileModal: (show: boolean) => void;
  setShowSprintModal: (show: boolean) => void;
  setSprintMode: (mode: 'goal' | 'content') => void;
  setShowHistoryModal: (show: boolean) => void;
  setShowGraphModal: (show: boolean) => void;
  setShowCoachModal: (show: boolean) => void;
  setShowMigrationModal: (show: boolean) => void;
  setShowSyncConfigModal: (show: boolean) => void;
  setShowConflictModal: (show: boolean) => void;
  setShowRemoteProjectModal: (show: boolean) => void;
  setShowRevisionSettingsModal: (show: boolean) => void;
  setShowAgentTraceModal: (show: boolean) => void;
  setShowExternalChangeModal: (show: boolean) => void;
  setShowSessionModal: (show: boolean) => void;
}

export const createUIStateSlice: StateCreator<AppState, [], [], UIStateSlice> = (set, get) => ({
  sidebarWidth: 320,
  testsPanelWidth: 350,
  revisionRailWidth: 156,
  revisionProposalsWidth: 440,
  compareReportWidth: 440,
  focusMode: true,
  runTutorial: false,
  ambientCueEnabled: true,
  surroundCollapsed: false,
  cueDismissedForId: null,
  activeTab: 'editor',
  testsPanelTab: 'spec',

  searchQuery: '',
  searchMatchedIds: [],

  isProcessing: false,

  syncStatus: 'no-remote',
  syncError: null,
  syncAhead: 0,
  syncBehind: 0,
  pendingMerge: null,

  showProjectModal: false,
  showCommandPalette: false,
  showRunModal: false,
  showPersonaModal: false,
  showGrimoireModal: false,
  showSpecModal: false,
  showPromptsGraphModal: false,
  showSectionMapModal: false,
  showProjectFileModal: false,
  showSprintModal: false,
  sprintMode: 'content',
  showHistoryModal: false,
  showGraphModal: false,
  showCoachModal: false,
  showMigrationModal: false,
  showSyncConfigModal: false,
  showConflictModal: false,
  showRemoteProjectModal: false,
  showRevisionSettingsModal: false,
  showAgentTraceModal: false,
  showExternalChangeModal: false,
  showSessionModal: false,

  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setTestsPanelWidth: (w) => set({ testsPanelWidth: w }),
  setRevisionRailWidth: (w) => set({ revisionRailWidth: w }),
  setRevisionProposalsWidth: (w) => set({ revisionProposalsWidth: w }),
  setCompareReportWidth: (w) => set({ compareReportWidth: w }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setRunTutorial: (run) => set({ runTutorial: run }),
  setAmbientCueEnabled: (on) => set({ ambientCueEnabled: on }),
  setSurroundCollapsed: (collapsed) => set({ surroundCollapsed: collapsed }),
  setCueDismissedForId: (id) => set({ cueDismissedForId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTestsPanelTab: (tab) => set({ testsPanelTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  runSectionSearch: async (query) => {
    set({ searchQuery: query });
    const trimmed = query.trim();
    if (!trimmed) {
      set({ searchMatchedIds: [] });
      return;
    }
    try {
      const hits = await repository.searchSections(trimmed, 100);
      // Validate hit ids against the live, VISIBLE section tree. Two reasons:
      // (1) a stale index may reference sections renamed/removed since the last
      // reindex — a dead id highlights nothing and dead-clicks on jump; (2) the
      // treemap only renders sections that aren't hidden (a hidden node hides
      // its whole subtree), so counting a hidden hit would overstate the match
      // count with no visible tile to show for it.
      const hidden = new Set(get().hiddenSectionIds ?? []);
      const live = new Set<string>();
      const collect = (nodes: Section[], ancestorHidden: boolean) => {
        for (const n of nodes) {
          const isHidden = ancestorHidden || hidden.has(n.id);
          if (!isHidden) live.add(n.id);
          collect(n.children, isHidden);
        }
      };
      collect(get().sections, false);
      // Ignore a result for a query the user has since changed (race guard).
      if (get().searchQuery.trim() !== trimmed) return;
      set({ searchMatchedIds: hits.map((h) => h.sectionId).filter((id) => live.has(id)) });
    } catch (e) {
      console.warn('section search failed', e);
      set({ searchMatchedIds: [] });
    }
  },
  clearSearch: () => set({ searchQuery: '', searchMatchedIds: [] }),
  setIsProcessing: (proc) => set({ isProcessing: proc }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncError: (err) => set({ syncError: err }),
  setSyncCounts: (ahead, behind) => set({ syncAhead: ahead, syncBehind: behind }),
  setPendingMerge: (merge) => set({ pendingMerge: merge }),
  setShowProjectModal: (show) => set({ showProjectModal: show }),
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
  setShowRunModal: (show) => set({ showRunModal: show }),
  setShowPersonaModal: (show) => set({ showPersonaModal: show }),
  setShowGrimoireModal: (show) => set({ showGrimoireModal: show }),
  setShowSpecModal: (show) => set({ showSpecModal: show }),
  setShowPromptsGraphModal: (show) => set({ showPromptsGraphModal: show }),
  setShowSectionMapModal: (show) => set({ showSectionMapModal: show }),
  setShowProjectFileModal: (show) => set({ showProjectFileModal: show }),
  setShowSprintModal: (show) => set({ showSprintModal: show }),
  setSprintMode: (mode) => set({ sprintMode: mode }),
  setShowHistoryModal: (show) => set({ showHistoryModal: show }),
  setShowGraphModal: (show) => set({ showGraphModal: show }),
  setShowCoachModal: (show) => set({ showCoachModal: show }),
  setShowMigrationModal: (show) => set({ showMigrationModal: show }),
  setShowSyncConfigModal: (show) => set({ showSyncConfigModal: show }),
  setShowConflictModal: (show) => set({ showConflictModal: show }),
  setShowRemoteProjectModal: (show) => set({ showRemoteProjectModal: show }),
  setShowRevisionSettingsModal: (show) => set({ showRevisionSettingsModal: show }),
  setShowAgentTraceModal: (show) => set({ showAgentTraceModal: show }),
  setShowExternalChangeModal: (show) => set({ showExternalChangeModal: show }),
  setShowSessionModal: (show) => set({ showSessionModal: show }),
});
