import type { StateCreator } from 'zustand';
import type {
  AnalysisVersion,
  Dependency,
  DialogueMessage,
  Section,
  SectionSpec,
  Snapshot,
  TestSuite,
  TestSuiteEntry,
} from '../types';
import type { AppState } from '.';
import {
  withActiveAnalysisVersion,
  withAnalysisVersion,
  withClearedDialogue,
  withDialogue,
  withDialogueContext,
} from '../lib/analysis-helpers';

const blankEntry = (): TestSuiteEntry => ({
  goals: '',
  status: 'idle',
  history: [],
});

/**
 * True when an entry holds anything the user (or the AI on their behalf) authored.
 * Over-inclusive on purpose: the only consequence of a false positive is keeping
 * a slightly-stale entry, whereas a false negative would delete real work.
 */
const hasAuthoredContent = (e: TestSuiteEntry): boolean =>
  Boolean(
    e.spec ||
    e.lastDiagnostic ||
    e.lastResult ||
    e.mainClaim ||
    (e.goals && e.goals.trim()) ||
    (e.history && e.history.length) ||
    (e.dependencies && e.dependencies.length) ||
    e.analysis ||
    e.cachedSuggestions,
  );

/**
 * The committed dissertation document. This is domain data — what the user
 * actually persists. Pre-Phase-3 it's an IndexedDB blob; post-Phase-3 it's
 * markdown files on disk + SQLite cache + git history.
 *
 * `sections` is the parsed projection of `markdown` and is rebuildable; it
 * lives here because it travels with the document and is read by many UI
 * surfaces.
 */
export interface DocumentStateSlice {
  markdown: string;
  sections: Section[];
  testSuite: TestSuite;
  hiddenSectionIds: string[];
  revisions: Snapshot[];
  lastAutoSave: Date | null;

  setMarkdown: (markdown: string) => void;
  setSections: (sections: Section[]) => void;
  setTestSuite: (suite: TestSuite | ((prev: TestSuite) => TestSuite)) => void;
  setHiddenSectionIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setRevisions: (revs: Snapshot[] | ((prev: Snapshot[]) => Snapshot[])) => void;
  setLastAutoSave: (date: Date | null) => void;

  /**
   * Cache the AI's content suggestions for a given section. No-op if the
   * section isn't present in the suite.
   */
  setCachedSuggestions: (sectionId: string, inputHash: string, suggestions: string) => void;

  /**
   * Domain-level testSuite mutators. These were App.tsx-local helpers in
   * the pre-Phase-1 codebase; they live here so modals can call them
   * without prop drilling. Each preserves the legacy convention of
   * marking the entry `stale` and appending a history record.
   */
  updateSpec: (sectionId: string, spec: SectionSpec) => void;
  updateSectionGoals: (
    sectionId: string,
    newGoals: string,
    changeType: 'manual' | 'ai-generate' | 'ai-refine',
    instruction?: string,
  ) => void;
  updateDependencies: (sectionId: string, deps: Dependency[]) => void;
  updateMainClaim: (sectionId: string, text: string) => void;

  /** Toggle whether a section's text is visible in the focus-mode editor. */
  toggleSectionVisibility: (sectionId: string) => void;

  /**
   * Bound the unbounded growth of orphaned testSuite entries. Section ids are
   * derived from `title.slug + index`, so a rename or reorder creates a *new*
   * id and orphans the old entry. This removes only orphans that hold no
   * authored content — a renamed section keeps its spec/goals/history (so a
   * rename-back restores it), and nothing the user wrote is ever dropped. The
   * complete fix is stable section IDs (see STATUS.md). No-op while `liveIds`
   * is empty (a transient mid-load state).
   */
  pruneOrphanEntries: (liveIds: string[]) => void;

  /**
   * Analysis/Dialogue mutators (Analysis + Dialogue tabs). No pre-ai-write
   * snapshot here: versions only accumulate, nothing is overwritten.
   * `addAnalysisVersion` deliberately does NOT clear the dialogue — only the
   * refactor flow clears it (explicitly), so a plain re-analyze never
   * destroys an in-progress conversation.
   */
  addAnalysisVersion: (sectionId: string, version: AnalysisVersion) => void;
  setActiveAnalysisVersion: (sectionId: string, versionId: string) => void;
  setDialogue: (sectionId: string, messages: DialogueMessage[]) => void;
  /** Re-aim the dialogue at a new context; existing messages are preserved. */
  startDialogue: (sectionId: string, context: string) => void;
  clearDialogue: (sectionId: string) => void;
}

export const createDocumentStateSlice: StateCreator<AppState, [], [], DocumentStateSlice> = (set, get) => ({
  markdown: '',
  sections: [],
  testSuite: {},
  hiddenSectionIds: [],
  revisions: [],
  lastAutoSave: null,

  setMarkdown: (markdown) => set({ markdown }),
  setSections: (sections) => set({ sections }),
  setTestSuite: (suite) =>
    set((state) => ({
      testSuite: typeof suite === 'function' ? suite(state.testSuite) : suite,
    })),
  setHiddenSectionIds: (ids) =>
    set((state) => ({
      hiddenSectionIds: typeof ids === 'function' ? ids(state.hiddenSectionIds) : ids,
    })),
  setRevisions: (revs) =>
    set((state) => ({
      revisions: typeof revs === 'function' ? revs(state.revisions) : revs,
    })),
  setLastAutoSave: (date) => set({ lastAutoSave: date }),

  setCachedSuggestions: (sectionId, inputHash, suggestions) =>
    set((state) => {
      if (!state.testSuite[sectionId]) return state;
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: {
            ...state.testSuite[sectionId],
            cachedSuggestions: { inputHash, suggestions },
          },
        },
      };
    }),

  updateSpec: (sectionId, spec) =>
    set((state) => {
      const entry = state.testSuite[sectionId] ?? blankEntry();
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: {
            ...entry,
            spec,
            mainClaim: spec.mainClaim,
            goals: spec.requiredMoves.map((m) => m.description).join('\n'),
            status: 'stale',
            history: [
              ...(entry.history || []),
              { timestamp: Date.now(), goals: entry.goals, type: 'manual' as const },
            ],
          },
        },
      };
    }),

  updateSectionGoals: (sectionId, newGoals, changeType, instruction) => {
    if (changeType.startsWith('ai-')) {
      // Cross-slice: snapshot before AI writes.
      void (get() as AppState).createSnapshot('pre-ai-write', { sectionIds: [sectionId] });
    }
    set((state) => {
      const entry = state.testSuite[sectionId] ?? blankEntry();
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: {
            ...entry,
            goals: newGoals,
            status: 'stale',
            history: [
              ...(entry.history || []),
              {
                timestamp: Date.now(),
                goals: entry.goals,
                instruction,
                type: changeType,
              },
            ],
          },
        },
      };
    });
  },

  updateDependencies: (sectionId, deps) =>
    set((state) => {
      const entry = state.testSuite[sectionId] ?? blankEntry();
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: { ...entry, dependencies: deps },
        },
      };
    }),

  updateMainClaim: (sectionId, text) =>
    set((state) => {
      const entry = state.testSuite[sectionId] ?? blankEntry();
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: { ...entry, mainClaim: text },
        },
      };
    }),

  toggleSectionVisibility: (sectionId) =>
    set((state) => ({
      hiddenSectionIds: state.hiddenSectionIds.includes(sectionId)
        ? state.hiddenSectionIds.filter((x) => x !== sectionId)
        : [...state.hiddenSectionIds, sectionId],
    })),

  pruneOrphanEntries: (liveIds) =>
    set((state) => {
      if (liveIds.length === 0) return state;
      const live = new Set(liveIds);
      let changed = false;
      const next: TestSuite = {};
      for (const [id, entry] of Object.entries(state.testSuite)) {
        if (live.has(id) || hasAuthoredContent(entry)) {
          next[id] = entry;
        } else {
          changed = true;
        }
      }
      return changed ? { testSuite: next } : state;
    }),

  addAnalysisVersion: (sectionId, version) =>
    set((state) => ({ testSuite: withAnalysisVersion(state.testSuite, sectionId, version) })),

  setActiveAnalysisVersion: (sectionId, versionId) =>
    set((state) => ({
      testSuite: withActiveAnalysisVersion(state.testSuite, sectionId, versionId),
    })),

  setDialogue: (sectionId, messages) =>
    set((state) => ({ testSuite: withDialogue(state.testSuite, sectionId, messages) })),

  startDialogue: (sectionId, context) =>
    set((state) => ({ testSuite: withDialogueContext(state.testSuite, sectionId, context) })),

  clearDialogue: (sectionId) =>
    set((state) => ({ testSuite: withClearedDialogue(state.testSuite, sectionId) })),
});
