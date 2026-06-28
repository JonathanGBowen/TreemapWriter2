import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { PendingMerge, Section } from '../types';
import { repository } from '../services/repository-registry';

/** Workspaces a running AI op can belong to — used by the activity pill to jump back. */
export type OpWorkspace =
  | 'interpolate'
  | 'revision'
  | 'parallel'
  | 'gist'
  | 'compare'
  | 'spec-test'
  | 'climate';

/** One in-flight AI operation, surfaced by the global activity pill. */
export interface ActiveOp {
  id: string;
  /** Short present-tense label, e.g. "Generating specs…". */
  label: string;
  /** Origin workspace, if any — enables the pill's non-destructive jump-back. */
  workspace?: OpWorkspace;
}

/** The store flag that brings each workspace forward (set true, never cleared here). */
const WORKSPACE_OPEN_FLAG: Record<OpWorkspace, keyof AppState> = {
  interpolate: 'interpolateOpen',
  revision: 'revisionWorkspaceOpen',
  parallel: 'parallelOpen',
  gist: 'gistOpen',
  compare: 'comparisonOpen',
  'spec-test': 'specTestOpen',
  climate: 'climateOpen',
};

/** Monotonic op id source. Module-level: the slice is created once per session. */
let opSeq = 0;

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
  /**
   * Section id whose ambient cue the user soft-dismissed this visit. Cleared on
   * section change so a re-entered section cues again — undo, not a persisted off.
   */
  cueDismissedForId: string | null;
  /**
   * Section ids whose structural-tension finding the user soft-dismissed this session
   * (the strain register). Ephemeral by design — never in the persisted uiState whitelist,
   * so a false alarm costs one click and is gone, but returns on reload (undo, not a
   * persisted off — mirrors cueDismissedForId).
   */
  dismissedStrainIds: string[];
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

  /**
   * Live registry of in-flight AI operations, for the global activity pill — so a
   * running call is visible from ANY view, not just the workspace that started it.
   * Deliberately SEPARATE from `isProcessing` (the mutual-exclusion lock that many
   * `if (isProcessing) return;` guards read): `activeOps` includes streaming and
   * throttle-queued calls and never gates anything. Ephemeral; lost on reload.
   */
  activeOps: ActiveOp[];
  /** True while the per-minute throttle is making a call wait (shown as "queued"). */
  throttleWaiting: boolean;

  /**
   * Set when a persist (`saveCurrentState` / autosave) fails — i.e. the latest
   * edits are NOT on disk and exist only in volatile memory. A failed SAVE is
   * more dangerous than a failed sync (a sync failure leaves work safely on
   * disk; a save failure does not), so it is surfaced loudly and persistently
   * and only cleared by the next SUCCESSFUL save. Guards against the class of
   * silent total-loss bug that froze desktop persistence in 2026-06 (the strict
   * promptsConfig mirror — see migration-log 2026-06-24).
   */
  saveError: string | null;

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
  /** Parallel Editor settings (voice · model · token preview · prompts). */
  showParallelSettingsModal: boolean;
  /** Gist Editor settings (model depth · prompts). */
  showGistSettingsModal: boolean;
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
  setCueDismissedForId: (id: string | null) => void;
  dismissStrain: (id: string) => void;
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
  /** Register an in-flight AI op; returns an id to pass to endOp when it settles. */
  beginOp: (op: { label: string; workspace?: OpWorkspace }) => string;
  /** Deregister an op (call in a finally so it clears on every path). */
  endOp: (id: string) => void;
  setThrottleWaiting: (waiting: boolean) => void;
  /**
   * Bring a workspace forward (the activity pill's jump-back). Non-destructive: it
   * only sets the open flag, never clears in-flight working state — so returning to
   * a workspace mid-call can't discard a regenerable pass.
   */
  focusWorkspace: (workspace: OpWorkspace) => void;
  setSaveError: (err: string | null) => void;
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
  setShowParallelSettingsModal: (show: boolean) => void;
  setShowGistSettingsModal: (show: boolean) => void;
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
  cueDismissedForId: null,
  dismissedStrainIds: [],
  activeTab: 'editor',
  testsPanelTab: 'spec',

  searchQuery: '',
  searchMatchedIds: [],

  isProcessing: false,
  activeOps: [],
  throttleWaiting: false,
  saveError: null,

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
  showParallelSettingsModal: false,
  showGistSettingsModal: false,
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
  setCueDismissedForId: (id) => set({ cueDismissedForId: id }),
  dismissStrain: (id) =>
    set((s) => (s.dismissedStrainIds.includes(id) ? s : { dismissedStrainIds: [...s.dismissedStrainIds, id] })),
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
  beginOp: (op) => {
    const id = `op-${++opSeq}`;
    set((s) => ({ activeOps: [...s.activeOps, { id, ...op }] }));
    return id;
  },
  endOp: (id) => set((s) => ({ activeOps: s.activeOps.filter((o) => o.id !== id) })),
  setThrottleWaiting: (throttleWaiting) => set({ throttleWaiting }),
  focusWorkspace: (workspace) =>
    set({ [WORKSPACE_OPEN_FLAG[workspace]]: true } as unknown as Partial<AppState>),
  setSaveError: (err) => set({ saveError: err }),
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
  setShowParallelSettingsModal: (show) => set({ showParallelSettingsModal: show }),
  setShowGistSettingsModal: (show) => set({ showGistSettingsModal: show }),
  setShowAgentTraceModal: (show) => set({ showAgentTraceModal: show }),
  setShowExternalChangeModal: (show) => set({ showExternalChangeModal: show }),
  setShowSessionModal: (show) => set({ showSessionModal: show }),
});
