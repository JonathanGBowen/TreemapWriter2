import type { StateCreator } from 'zustand';
import type { Dependency, Section, SectionSpec, Snapshot, TestSuite, TestSuiteEntry } from '../types';
import type { AppState } from '.';

const blankEntry = (): TestSuiteEntry => ({
  goals: '',
  status: 'idle',
  history: [],
});

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
});
