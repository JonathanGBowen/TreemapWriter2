import type { StateCreator } from 'zustand';
import type {
  AnalysisVersion,
  Dependency,
  DialogueMessage,
  ProvenanceMark,
  Recenterings,
  ReverseOutlineDoc,
  Section,
  SectionSpec,
  Snapshot,
  StoredGist,
  StructuralPart,
  TestSuite,
  TestSuiteEntry,
  WholeFromPart,
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
  /**
   * Parallel Editor reverse outlines (outlineA), keyed by scope. Persisted domain
   * data — it must survive closing the workspace — so it lives here beside
   * testSuite/revisions, not in the ephemeral parallel slice.
   */
  reverseOutlines: ReverseOutlineDoc[];
  /**
   * The Gist Editor's persisted scale model (one per document). Domain data — it
   * must survive closing the workspace and restarts — so it lives here, not in the
   * ephemeral gist slice. Null until the writer first generates a gist.
   */
  gist: StoredGist | null;
  /**
   * Durable provenance marks for AI-introduced spans (F2). Domain data — it must
   * survive reloads, snapshots, and Version Compare — so it lives here, anchored to
   * the prose, never written into project.md. Empty until the first AI accept.
   */
  provenanceMarks: ProvenanceMark[];
  /**
   * The document's discovered structural-functional parts (the moves the argument
   * makes), mapped many-to-many onto sections. Regenerable domain data — Tier 1 is
   * in-memory only (NOT yet persisted to the sidecar), so it lives here beside the
   * other per-document arrays and resets on project load/switch. Empty until the
   * writer runs "Discover parts".
   */
  structuralParts: StructuralPart[];
  lastAutoSave: Date | null;

  setMarkdown: (markdown: string) => void;
  setSections: (sections: Section[]) => void;
  setTestSuite: (suite: TestSuite | ((prev: TestSuite) => TestSuite)) => void;
  setHiddenSectionIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setRevisions: (revs: Snapshot[] | ((prev: Snapshot[]) => Snapshot[])) => void;
  setReverseOutlines: (docs: ReverseOutlineDoc[]) => void;
  /** Insert or replace (by scopeKey) one persisted reverse outline. */
  upsertReverseOutline: (doc: ReverseOutlineDoc) => void;
  /** Replace the document's persisted gist (null clears it). */
  setGist: (gist: StoredGist | null) => void;
  /** Replace all provenance marks (the load path). */
  setProvenanceMarks: (marks: ProvenanceMark[]) => void;
  /** Record one AI span's provenance at accept-time. */
  addProvenanceMark: (mark: ProvenanceMark) => void;
  /** Replace the document's discovered structural parts (the discovery result). */
  setStructuralParts: (parts: StructuralPart[]) => void;
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
  /**
   * Set a section's one-sentence reverse-outline gloss (the Articulation tool's
   * summaries mode). Creates a blank entry if the section has none. Distinct from
   * `updateMainClaim` — a reverse-outline summary is never the exegetical claim.
   */
  setReverseSummary: (sectionId: string, sentence: string) => void;

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

  /**
   * Gestalt whole/part results (Phase 2). Ephemeral cache — like `lastDiagnostic`,
   * NOT persisted to the YAML sidecar (the Rust `PersistedTestEntry` whitelist
   * drops them). No-op if the section isn't present in the suite.
   */
  setWholeFromPart: (sectionId: string, result: WholeFromPart) => void;
  setRecenterings: (sectionId: string, result: Recenterings) => void;
}

export const createDocumentStateSlice: StateCreator<AppState, [], [], DocumentStateSlice> = (set, get) => ({
  markdown: '',
  sections: [],
  testSuite: {},
  hiddenSectionIds: [],
  revisions: [],
  reverseOutlines: [],
  gist: null,
  provenanceMarks: [],
  structuralParts: [],
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
  setReverseOutlines: (docs) => set({ reverseOutlines: docs }),
  upsertReverseOutline: (doc) =>
    set((state) => ({
      reverseOutlines: [
        ...state.reverseOutlines.filter((d) => d.scopeKey !== doc.scopeKey),
        doc,
      ],
    })),
  setGist: (gist) => set({ gist }),
  setProvenanceMarks: (marks) => set({ provenanceMarks: marks }),
  addProvenanceMark: (mark) =>
    set((state) => ({ provenanceMarks: [...state.provenanceMarks, mark] })),
  setStructuralParts: (parts) => set({ structuralParts: parts }),
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

  setReverseSummary: (sectionId, sentence) =>
    set((state) => {
      const entry = state.testSuite[sectionId] ?? blankEntry();
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: { ...entry, reverseSummary: sentence },
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

  setWholeFromPart: (sectionId, result) =>
    set((state) => {
      if (!state.testSuite[sectionId]) return state;
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: { ...state.testSuite[sectionId], wholeFromPart: result },
        },
      };
    }),

  setRecenterings: (sectionId, result) =>
    set((state) => {
      if (!state.testSuite[sectionId]) return state;
      return {
        testSuite: {
          ...state.testSuite,
          [sectionId]: { ...state.testSuite[sectionId], recenterings: result },
        },
      };
    }),
});
