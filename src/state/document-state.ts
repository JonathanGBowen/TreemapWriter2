import type { StateCreator } from 'zustand';
import type { Section, Snapshot, TestSuite } from '../types';
import type { AppState } from '.';

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
}

export const createDocumentStateSlice: StateCreator<AppState, [], [], DocumentStateSlice> = (set) => ({
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
});
