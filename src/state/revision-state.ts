import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type {
  AssemblySubMode,
  ProposalStatus,
  RevisionMode,
  RevisionProposal,
} from '../types';
import {
  initAuditQueue,
  patchAuditQueue,
  settleRemaining,
  type AuditItem,
  type AuditItemStatus,
} from '../lib/audit-helpers';

/**
 * The Glass Box revision workflow, as an ephemeral slice. The source *documents*
 * themselves are persisted domain state (they live in document-state, saved to the
 * `.twriter/sources.json` sidecar). What lives HERE is transient per-pass workflow
 * state: which sources are *selected* for this pass, the directive, and the proposals
 * under review. The workspace-open flag lives here — not in ui-state alongside
 * `focusMode` — because it is inseparable from (and resets with) the workflow data it
 * gates.
 *
 * Pure state only: async orchestration (the AI call, accept→write+snapshot) lives
 * in features/revision/use-revision-actions.ts, mirroring use-analysis-actions.
 */
export type RevisionPhase = 'config' | 'generating' | 'auditing' | 'review';

/** How the batch audit paces itself between sources. */
export type AuditPacing = 'continuous' | 'stepped';

/** A proposal plus its review status within the session. */
export type SessionProposal = RevisionProposal & { _status: ProposalStatus };

export interface RevisionSlice {
  revisionWorkspaceOpen: boolean;
  revisionPhase: RevisionPhase;
  revisionMode: RevisionMode;
  revisionSubMode: AssemblySubMode;
  selectedSourceIds: string[];
  directive: string;
  proposals: SessionProposal[];
  activeProposalId: string | null;
  /** Pending proposals currently shown inline in the master document. */
  previewIds: string[];
  previewAll: boolean;
  /** The per-source batch audit's queue; empty = no audit this pass. */
  auditQueue: AuditItem[];
  /**
   * The section id the audit was launched against ('root' for whole document),
   * pinned at start so the run's target never drifts with rail navigation —
   * while its TEXT is re-read live each iteration (a mid-run accept rewrites
   * the document, and later sources must be audited against what it says now).
   */
  auditTargetId: string | null;
  /** Continuous by default; 'stepped' pauses for review after each source. */
  auditPacing: AuditPacing;
  /** True while a stepped run waits for "continue" between sources. */
  auditAwaiting: boolean;
  /** Stop requested — takes effect at the next source boundary. */
  auditCancelled: boolean;
  /**
   * Monotonic pass identity. Incremented whenever the pass data is cleared or
   * replaced (close / new pass / new audit), so a detached async loop or an
   * in-flight call can tell that its results belong to a dead pass and drop
   * them — the reopenable `revisionWorkspaceOpen` boolean cannot carry that.
   */
  revisionPassEpoch: number;

  openRevisionWorkspace: () => void;
  closeRevisionWorkspace: () => void;
  /** Select/deselect one source for this pass (chip click). */
  toggleRevisionSource: (id: string) => void;
  /** Mark one source selected (used when a freshly added source should be active). */
  selectSource: (id: string) => void;
  /** Drop one source from the selection (used when a source is removed). */
  deselectSource: (id: string) => void;
  /** Replace the whole selection (used on project load to default-select persisted sources). */
  setSelectedSourceIds: (ids: string[]) => void;
  setRevisionDirective: (directive: string) => void;
  setRevisionMode: (mode: RevisionMode) => void;
  setRevisionSubMode: (subMode: AssemblySubMode) => void;
  setRevisionPhase: (phase: RevisionPhase) => void;
  setProposals: (proposals: SessionProposal[]) => void;
  /** Accumulate proposals mid-audit (statuses of earlier ones are preserved). */
  appendProposals: (proposals: SessionProposal[]) => void;
  /** Begin a batch audit: fresh queue in selection order, cleared review state, pinned target. */
  startAudit: (sourceIds: string[], targetId: string) => void;
  /** Patch one audit item's status/count/note by source id. */
  patchAuditItem: (sourceId: string, patch: Partial<Omit<AuditItem, 'sourceId'>>) => void;
  /** Settle every still-queued item (the cancel path). */
  settleAuditRemaining: (status: AuditItemStatus, note?: string) => void;
  setAuditPacing: (pacing: AuditPacing) => void;
  setAuditAwaiting: (awaiting: boolean) => void;
  /** Request a stop; honored at the next source boundary. */
  requestAuditCancel: () => void;
  setActiveProposal: (id: string | null) => void;
  resolveProposal: (id: string, status: ProposalStatus) => void;
  toggleProposalPreview: (id: string) => void;
  setPreviewAll: (on: boolean) => void;
  resetRevision: () => void;
}

/** Cleared review state for a fresh pass (keeps selection/directive/mode/pacing). */
const CLEARED_PASS = {
  revisionPhase: 'config' as RevisionPhase,
  proposals: [] as SessionProposal[],
  activeProposalId: null as string | null,
  previewIds: [] as string[],
  previewAll: false,
  auditQueue: [] as AuditItem[],
  auditTargetId: null as string | null,
  auditAwaiting: false,
  auditCancelled: false,
};

export const createRevisionSlice: StateCreator<AppState, [], [], RevisionSlice> = (set) => ({
  revisionWorkspaceOpen: false,
  revisionMode: 'revision',
  revisionSubMode: 'woven',
  selectedSourceIds: [],
  directive: '',
  auditPacing: 'continuous',
  revisionPassEpoch: 0,
  ...CLEARED_PASS,

  openRevisionWorkspace: () => set({ revisionWorkspaceOpen: true }),
  // Close keeps the session's selection/directive (ephemeral) but drops the in-flight
  // pass, so reopening lands back on a clean config screen. The epoch bump is what
  // actually kills detached work: reopening restores the flag, never the epoch.
  closeRevisionWorkspace: () =>
    set((s) => ({
      revisionWorkspaceOpen: false,
      ...CLEARED_PASS,
      revisionPassEpoch: s.revisionPassEpoch + 1,
    })),

  toggleRevisionSource: (id) =>
    set((s) => ({
      selectedSourceIds: s.selectedSourceIds.includes(id)
        ? s.selectedSourceIds.filter((x) => x !== id)
        : [...s.selectedSourceIds, id],
    })),
  selectSource: (id) =>
    set((s) => ({
      selectedSourceIds: s.selectedSourceIds.includes(id)
        ? s.selectedSourceIds
        : [...s.selectedSourceIds, id],
    })),
  deselectSource: (id) =>
    set((s) => ({ selectedSourceIds: s.selectedSourceIds.filter((x) => x !== id) })),
  setSelectedSourceIds: (ids) => set({ selectedSourceIds: ids }),
  setRevisionDirective: (directive) => set({ directive }),
  setRevisionMode: (revisionMode) => set({ revisionMode }),
  setRevisionSubMode: (revisionSubMode) => set({ revisionSubMode }),
  setRevisionPhase: (revisionPhase) => set({ revisionPhase }),
  setProposals: (proposals) => set({ proposals, activeProposalId: proposals[0]?.id ?? null }),
  appendProposals: (incoming) =>
    set((s) => ({
      proposals: [...s.proposals, ...incoming],
      activeProposalId: s.activeProposalId ?? incoming[0]?.id ?? null,
    })),
  startAudit: (sourceIds, targetId) =>
    set((s) => ({
      ...CLEARED_PASS,
      auditQueue: initAuditQueue(sourceIds),
      auditTargetId: targetId,
      revisionPhase: 'auditing',
      // A new audit replaces whatever pass came before it.
      revisionPassEpoch: s.revisionPassEpoch + 1,
    })),
  patchAuditItem: (sourceId, patch) =>
    set((s) => ({ auditQueue: patchAuditQueue(s.auditQueue, sourceId, patch) })),
  settleAuditRemaining: (status, note) =>
    set((s) => ({ auditQueue: settleRemaining(s.auditQueue, status, note) })),
  setAuditPacing: (auditPacing) => set({ auditPacing }),
  setAuditAwaiting: (auditAwaiting) => set({ auditAwaiting }),
  requestAuditCancel: () => set({ auditCancelled: true }),
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
  resetRevision: () =>
    set((s) => ({ ...CLEARED_PASS, revisionPassEpoch: s.revisionPassEpoch + 1 })),
});
