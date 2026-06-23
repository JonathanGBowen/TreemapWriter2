import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { ReadingMode, Snapshot, SnapshotMeta, VersionComparison } from '../types';

/**
 * The Version Compare workspace, as an ephemeral slice. Like the Glass Box
 * revision slice, NOTHING here is persisted: the selected operands, the active
 * lens, and the AI verdict are all session state, and the report is regenerable
 * on demand. The workspace-open flag lives here — not in ui-state — because it
 * is inseparable from (and resets with) the comparison it gates.
 *
 * Pure state only: the AI call (read both operands → resolve lens →
 * aiProvider.compareVersions) lives in features/compare/use-comparison-actions,
 * mirroring use-analysis-actions / use-revision-actions.
 */
export type ComparisonStatus = 'idle' | 'running' | 'error';

/** Load state of the deep, blob-free snapshot index. */
export type IndexStatus = 'idle' | 'loading' | 'ready' | 'error';

/** A comparison operand: a snapshot id, or the live unsaved draft. */
export type VersionRef = string | 'current';

/** A session boundary as a selectable ref: its resolved commit OID + a label. */
export interface SessionRefOption {
  commitId: string;
  label: string;
}

export interface ComparisonSlice {
  comparisonOpen: boolean;
  /** Selected operands. null means "unset" — the workspace resolves a default on open. */
  versionAId: VersionRef | null;
  versionBId: VersionRef | null;
  /** Active lens id (a compare lens, a Grimoire spell, or a custom one); null = plain. */
  activeCompareLensId: string | null;
  /** Reading stance for the comparison: 'draft' (default) vs 'final'. Session-only. */
  compareMode: ReadingMode;
  comparison: VersionComparison | null;
  comparisonStatus: ComparisonStatus;

  /** Deep, blob-free history index (newest first), loaded lazily when the workspace opens. */
  snapshotIndex: SnapshotMeta[];
  indexStatus: IndexStatus;
  /** Full content for the two selected operands, fetched lazily by id (null = current draft or not-yet-loaded). */
  loadedA: Snapshot | null;
  loadedB: Snapshot | null;
  /** Picker mode: false folds routine autosaves to day-start + checkpoints; true shows every save. */
  showAllSaves: boolean;
  /** Session start/end tags resolved to commit OIDs, offered as selectable refs. */
  sessionRefs: SessionRefOption[];

  openCompare: () => void;
  closeCompare: () => void;
  setVersionA: (ref: VersionRef) => void;
  setVersionB: (ref: VersionRef) => void;
  setCompareLens: (id: string | null) => void;
  setCompareMode: (m: ReadingMode) => void;
  setComparison: (c: VersionComparison | null) => void;
  setComparisonStatus: (s: ComparisonStatus) => void;
  setSnapshotIndex: (metas: SnapshotMeta[]) => void;
  setIndexStatus: (s: IndexStatus) => void;
  setLoadedA: (snap: Snapshot | null) => void;
  setLoadedB: (snap: Snapshot | null) => void;
  setShowAllSaves: (on: boolean) => void;
  setSessionRefs: (refs: SessionRefOption[]) => void;
}

export const createComparisonSlice: StateCreator<AppState, [], [], ComparisonSlice> = (set) => ({
  comparisonOpen: false,
  versionAId: null,
  versionBId: null,
  activeCompareLensId: null,
  compareMode: 'draft',
  comparison: null,
  comparisonStatus: 'idle',
  snapshotIndex: [],
  indexStatus: 'idle',
  loadedA: null,
  loadedB: null,
  showAllSaves: false,
  sessionRefs: [],

  openCompare: () => set({ comparisonOpen: true }),
  // Closing keeps the selections + last report (regenerable, cheap to keep) but
  // drops any in-flight status, so reopening lands in a settled state.
  closeCompare: () => set({ comparisonOpen: false, comparisonStatus: 'idle' }),
  setVersionA: (ref) => set({ versionAId: ref }),
  setVersionB: (ref) => set({ versionBId: ref }),
  setCompareLens: (id) => set({ activeCompareLensId: id }),
  setCompareMode: (m) => set({ compareMode: m }),
  setComparison: (c) => set({ comparison: c }),
  setComparisonStatus: (s) => set({ comparisonStatus: s }),
  setSnapshotIndex: (metas) => set({ snapshotIndex: metas }),
  setIndexStatus: (s) => set({ indexStatus: s }),
  setLoadedA: (snap) => set({ loadedA: snap }),
  setLoadedB: (snap) => set({ loadedB: snap }),
  setShowAllSaves: (on) => set({ showAllSaves: on }),
  setSessionRefs: (refs) => set({ sessionRefs: refs }),
});
