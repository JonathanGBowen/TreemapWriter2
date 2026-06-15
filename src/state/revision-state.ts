import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { AssemblySubMode, ProposalStatus, RevisionMode, RevisionProposal } from '../types';

/**
 * The Glass Box revision workflow, as an ephemeral slice. Unlike the rest of the
 * domain state, NOTHING here is persisted: sources are session-only (the writer
 * pastes them when revising), and proposals are transient review state. The
 * workspace-open flag lives here — not in ui-state alongside `focusMode` — because
 * it is inseparable from (and resets with) the workflow data it gates.
 *
 * Pure state only: async orchestration (the AI call, accept→write+snapshot) lives
 * in features/revision/use-revision-actions.ts, mirroring use-analysis-actions.
 */
export type RevisionPhase = 'config' | 'generating' | 'review';

/** A proposal plus its review status within the session. */
export type SessionProposal = RevisionProposal & { _status: ProposalStatus };

export interface RevisionSlice {
  revisionWorkspaceOpen: boolean;
  revisionPhase: RevisionPhase;
  revisionMode: RevisionMode;
  revisionSubMode: AssemblySubMode;
  /** Per-pass selection into the persisted source library (document-state.sources). */
  selectedSourceIds: string[];
  directive: string;
  proposals: SessionProposal[];
  activeProposalId: string | null;
  /** Pending proposals currently shown inline in the master document. */
  previewIds: string[];
  previewAll: boolean;

  openRevisionWorkspace: () => void;
  closeRevisionWorkspace: () => void;
  toggleRevisionSource: (id: string) => void;
  setRevisionDirective: (directive: string) => void;
  setRevisionMode: (mode: RevisionMode) => void;
  setRevisionSubMode: (subMode: AssemblySubMode) => void;
  setRevisionPhase: (phase: RevisionPhase) => void;
  setProposals: (proposals: SessionProposal[]) => void;
  setActiveProposal: (id: string | null) => void;
  resolveProposal: (id: string, status: ProposalStatus) => void;
  toggleProposalPreview: (id: string) => void;
  setPreviewAll: (on: boolean) => void;
  resetRevision: () => void;
}

/** Cleared review state for a fresh pass (keeps selection/directive/mode). */
const CLEARED_PASS = {
  revisionPhase: 'config' as RevisionPhase,
  proposals: [] as SessionProposal[],
  activeProposalId: null as string | null,
  previewIds: [] as string[],
  previewAll: false,
};

export const createRevisionSlice: StateCreator<AppState, [], [], RevisionSlice> = (set) => ({
  revisionWorkspaceOpen: false,
  revisionMode: 'revision',
  revisionSubMode: 'woven',
  selectedSourceIds: [],
  directive: '',
  ...CLEARED_PASS,

  openRevisionWorkspace: () => set({ revisionWorkspaceOpen: true }),
  // Close keeps the session's selection/directive but drops the in-flight pass,
  // so reopening lands back on a clean config screen.
  closeRevisionWorkspace: () => set({ revisionWorkspaceOpen: false, ...CLEARED_PASS }),

  toggleRevisionSource: (id) =>
    set((s) => ({
      selectedSourceIds: s.selectedSourceIds.includes(id)
        ? s.selectedSourceIds.filter((x) => x !== id)
        : [...s.selectedSourceIds, id],
    })),
  setRevisionDirective: (directive) => set({ directive }),
  setRevisionMode: (revisionMode) => set({ revisionMode }),
  setRevisionSubMode: (revisionSubMode) => set({ revisionSubMode }),
  setRevisionPhase: (revisionPhase) => set({ revisionPhase }),
  setProposals: (proposals) => set({ proposals, activeProposalId: proposals[0]?.id ?? null }),
  setActiveProposal: (activeProposalId) => set({ activeProposalId }),
  resolveProposal: (id, status) =>
    set((s) => ({
      proposals: s.proposals.map((p) => (p.id === id ? { ...p, _status: status } : p)),
      // A resolved proposal leaves the preview set.
      previewIds: s.previewIds.filter((x) => x !== id),
    })),
  toggleProposalPreview: (id) =>
    set((s) => ({
      previewIds: s.previewIds.includes(id)
        ? s.previewIds.filter((x) => x !== id)
        : [...s.previewIds, id],
    })),
  setPreviewAll: (previewAll) => set({ previewAll }),
  resetRevision: () => set({ ...CLEARED_PASS }),
});
