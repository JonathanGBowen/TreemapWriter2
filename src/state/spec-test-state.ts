import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { ReadingMode, SectionSpecTest, Snapshot, SnapshotMeta, SpecTestReport } from '../types';
import type { SpecTestScope } from '../lib/specTestHelpers';
import type { IndexStatus, SessionRefOption, VersionRef } from './comparison-state';

/**
 * The Spec Test workspace, as an ephemeral slice (mirrors comparison-state). The
 * spec-anchored A/B WHOLE-test: hold the rubric fixed, score B vs A as a part AND
 * as a whole. NOTHING here is persisted — operands, scope, mode, and the report are
 * session state, and the report is regenerable on demand. The workspace-open flag
 * lives here (not ui-state) because it is inseparable from the test it gates.
 *
 * Pure state only: the run (resolve operands → build the held rubric → run the
 * engine) lives in features/spec-test/use-spec-test-actions, calling the store-free
 * lib/specTestRun.runSpecTestForOperands — no divergent logic from the Compare fold.
 */
export type SpecTestStatus = 'idle' | 'running' | 'error';

/** Where the held rubric comes from: the live testSuite, or snapshot A's frozen specs. */
export type RubricSource = 'live' | 'snapshot-a';

export interface SpecTestSlice {
  specTestOpen: boolean;
  /** Selected operands. null means "unset" — the workspace resolves a default on open. */
  specTestAId: VersionRef | null;
  specTestBId: VersionRef | null;
  /** Diff-scope: 'changed' (changed sections + mesh neighbours) or 'all'. */
  specTestScope: SpecTestScope;
  /** Reading stance for the test: 'draft' (default) vs 'final'. Session-only. */
  specTestMode: ReadingMode;
  /** Held-rubric source: live testSuite (default) or snapshot A's frozen specs. */
  specTestRubricSource: RubricSource;
  specTestReport: SpecTestReport | null;
  specTestStatus: SpecTestStatus;
  /** Incremental fill: section results pushed as each resolves while a run is live. */
  specTestPartial: SectionSpecTest[];

  /** Deep, blob-free history index (newest first), loaded lazily when the workspace opens. */
  specTestIndex: SnapshotMeta[];
  specTestIndexStatus: IndexStatus;
  /** Full content for the two selected operands, fetched lazily by id. */
  specTestLoadedA: Snapshot | null;
  specTestLoadedB: Snapshot | null;
  /** Picker mode: false folds routine autosaves; true shows every save. */
  specTestShowAllSaves: boolean;
  /** Session start/end tags resolved to commit OIDs, offered as selectable refs. */
  specTestSessionRefs: SessionRefOption[];

  openSpecTest: () => void;
  closeSpecTest: () => void;
  setSpecTestA: (ref: VersionRef) => void;
  setSpecTestB: (ref: VersionRef) => void;
  setSpecTestScope: (s: SpecTestScope) => void;
  setSpecTestMode: (m: ReadingMode) => void;
  setSpecTestRubricSource: (s: RubricSource) => void;
  setSpecTestReport: (r: SpecTestReport | null) => void;
  setSpecTestStatus: (s: SpecTestStatus) => void;
  resetSpecTestPartial: () => void;
  pushSpecTestSection: (r: SectionSpecTest) => void;
  setSpecTestIndex: (metas: SnapshotMeta[]) => void;
  setSpecTestIndexStatus: (s: IndexStatus) => void;
  setSpecTestLoadedA: (snap: Snapshot | null) => void;
  setSpecTestLoadedB: (snap: Snapshot | null) => void;
  setSpecTestShowAllSaves: (on: boolean) => void;
  setSpecTestSessionRefs: (refs: SessionRefOption[]) => void;
}

export const createSpecTestSlice: StateCreator<AppState, [], [], SpecTestSlice> = (set) => ({
  specTestOpen: false,
  specTestAId: null,
  specTestBId: null,
  specTestScope: 'changed',
  specTestMode: 'draft',
  specTestRubricSource: 'live',
  specTestReport: null,
  specTestStatus: 'idle',
  specTestPartial: [],
  specTestIndex: [],
  specTestIndexStatus: 'idle',
  specTestLoadedA: null,
  specTestLoadedB: null,
  specTestShowAllSaves: false,
  specTestSessionRefs: [],

  openSpecTest: () => set({ specTestOpen: true }),
  // Closing keeps the selection + last report (regenerable, cheap to keep) but
  // drops any in-flight status, so reopening lands in a settled state.
  closeSpecTest: () => set({ specTestOpen: false, specTestStatus: 'idle' }),
  setSpecTestA: (ref) => set({ specTestAId: ref }),
  setSpecTestB: (ref) => set({ specTestBId: ref }),
  setSpecTestScope: (s) => set({ specTestScope: s }),
  setSpecTestMode: (m) => set({ specTestMode: m }),
  setSpecTestRubricSource: (s) => set({ specTestRubricSource: s }),
  setSpecTestReport: (r) => set({ specTestReport: r }),
  setSpecTestStatus: (s) => set({ specTestStatus: s }),
  resetSpecTestPartial: () => set({ specTestPartial: [] }),
  pushSpecTestSection: (r) => set((state) => ({ specTestPartial: [...state.specTestPartial, r] })),
  setSpecTestIndex: (metas) => set({ specTestIndex: metas }),
  setSpecTestIndexStatus: (s) => set({ specTestIndexStatus: s }),
  setSpecTestLoadedA: (snap) => set({ specTestLoadedA: snap }),
  setSpecTestLoadedB: (snap) => set({ specTestLoadedB: snap }),
  setSpecTestShowAllSaves: (on) => set({ specTestShowAllSaves: on }),
  setSpecTestSessionRefs: (refs) => set({ specTestSessionRefs: refs }),
});
