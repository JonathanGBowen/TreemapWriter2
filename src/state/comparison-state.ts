import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { VersionComparison } from '../types';

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

/** A comparison operand: a snapshot id, or the live unsaved draft. */
export type VersionRef = string | 'current';

export interface ComparisonSlice {
  comparisonOpen: boolean;
  /** Selected operands. null means "unset" — the workspace resolves a default on open. */
  versionAId: VersionRef | null;
  versionBId: VersionRef | null;
  /** Active lens id (a compare lens, a Grimoire spell, or a custom one); null = plain. */
  activeCompareLensId: string | null;
  comparison: VersionComparison | null;
  comparisonStatus: ComparisonStatus;

  openCompare: () => void;
  closeCompare: () => void;
  setVersionA: (ref: VersionRef) => void;
  setVersionB: (ref: VersionRef) => void;
  setCompareLens: (id: string | null) => void;
  setComparison: (c: VersionComparison | null) => void;
  setComparisonStatus: (s: ComparisonStatus) => void;
}

export const createComparisonSlice: StateCreator<AppState, [], [], ComparisonSlice> = (set) => ({
  comparisonOpen: false,
  versionAId: null,
  versionBId: null,
  activeCompareLensId: null,
  comparison: null,
  comparisonStatus: 'idle',

  openCompare: () => set({ comparisonOpen: true }),
  // Closing keeps the selections + last report (regenerable, cheap to keep) but
  // drops any in-flight status, so reopening lands in a settled state.
  closeCompare: () => set({ comparisonOpen: false, comparisonStatus: 'idle' }),
  setVersionA: (ref) => set({ versionAId: ref }),
  setVersionB: (ref) => set({ versionBId: ref }),
  setCompareLens: (id) => set({ activeCompareLensId: id }),
  setComparison: (c) => set({ comparison: c }),
  setComparisonStatus: (s) => set({ comparisonStatus: s }),
});
