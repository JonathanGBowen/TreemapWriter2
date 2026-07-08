import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import {
  createRevisionSlice,
  type RevisionSlice,
  type SessionProposal,
} from '../revision-state';

// Standalone store: createRevisionSlice only uses `set`, and revision-state's
// non-type imports are minimal, so this never loads the full app store graph
// (which would pull in the AI SDK clients).
const sliceCreator = createRevisionSlice as unknown as StateCreator<RevisionSlice>;
const makeStore = () => create<RevisionSlice>()(sliceCreator);

const proposal = (id: string, status: SessionProposal['_status'] = 'pending'): SessionProposal => ({
  id,
  revision_type: 'Replacement',
  section: '2.2',
  original_text: 'a',
  proposed_text: 'b',
  rationale: '',
  source_id: 's1',
  verbatim_source_quote: 'q',
  confidence_score: 4,
  _status: status,
});

describe('revision slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('toggles source selection on and off', () => {
    const s = store.getState();
    s.selectSource('x');
    expect(store.getState().selectedSourceIds).toContain('x');
    s.toggleRevisionSource('x');
    expect(store.getState().selectedSourceIds).not.toContain('x');
    store.getState().toggleRevisionSource('x');
    expect(store.getState().selectedSourceIds).toContain('x');
  });

  it('selectSource is idempotent; deselectSource drops it', () => {
    const s = store.getState();
    s.selectSource('x');
    s.selectSource('x');
    expect(store.getState().selectedSourceIds).toEqual(['x']);
    store.getState().deselectSource('x');
    expect(store.getState().selectedSourceIds).not.toContain('x');
  });

  it('setSelectedSourceIds replaces the whole selection (project-load default)', () => {
    store.getState().setSelectedSourceIds(['a', 'b', 'c']);
    expect(store.getState().selectedSourceIds).toEqual(['a', 'b', 'c']);
  });

  it('setProposals activates the first proposal', () => {
    store.getState().setProposals([proposal('a'), proposal('b')]);
    expect(store.getState().activeProposalId).toBe('a');
  });

  it('resolving a proposal clears it from the preview set', () => {
    const s = store.getState();
    s.setProposals([proposal('p1'), proposal('p2')]);
    s.toggleProposalPreview('p1');
    expect(store.getState().previewIds).toContain('p1');
    store.getState().resolveProposal('p1', 'accepted');
    expect(store.getState().previewIds).not.toContain('p1');
    expect(store.getState().proposals.find((p) => p.id === 'p1')!._status).toBe('accepted');
  });

  it('closing the workspace drops the in-flight pass', () => {
    const s = store.getState();
    s.openRevisionWorkspace();
    s.setProposals([proposal('p1')]);
    s.setPreviewAll(true);
    s.setRevisionPhase('review');
    store.getState().closeRevisionWorkspace();
    const st = store.getState();
    expect(st.revisionWorkspaceOpen).toBe(false);
    expect(st.proposals).toEqual([]);
    expect(st.previewAll).toBe(false);
    expect(st.revisionPhase).toBe('config');
  });
});

describe('batch audit state', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('startAudit builds the queue in order, clears review state, pins the target, and enters auditing', () => {
    const s = store.getState();
    s.setProposals([proposal('old')]);
    s.startAudit(['a', 'b'], 'root');
    const st = store.getState();
    expect(st.revisionPhase).toBe('auditing');
    expect(st.proposals).toEqual([]);
    expect(st.auditQueue.map((i) => i.sourceId)).toEqual(['a', 'b']);
    expect(st.auditQueue.every((i) => i.status === 'queued')).toBe(true);
    expect(st.auditTargetId).toBe('root');
    expect(st.auditAwaiting).toBe(false);
    expect(st.auditCancelled).toBe(false);
  });

  it('appendProposals accumulates and preserves earlier statuses + active id', () => {
    const s = store.getState();
    s.setProposals([proposal('p1')]);
    store.getState().resolveProposal('p1', 'accepted');
    store.getState().appendProposals([proposal('p2')]);
    const st = store.getState();
    expect(st.proposals.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(st.proposals[0]._status).toBe('accepted');
    expect(st.activeProposalId).toBe('p1');
  });

  it('appendProposals seeds the active id when none is set', () => {
    store.getState().appendProposals([proposal('p1')]);
    expect(store.getState().activeProposalId).toBe('p1');
  });

  it('patchAuditItem + settleAuditRemaining + requestAuditCancel round-trip', () => {
    const s = store.getState();
    s.startAudit(['a', 'b', 'c'], 'root');
    store.getState().patchAuditItem('a', { status: 'done', proposalCount: 2 });
    store.getState().requestAuditCancel();
    store.getState().settleAuditRemaining('skipped', 'stopped');
    const st = store.getState();
    expect(st.auditCancelled).toBe(true);
    expect(st.auditQueue.map((i) => i.status)).toEqual(['done', 'skipped', 'skipped']);
    expect(st.auditQueue[1].note).toBe('stopped');
  });

  it('resetRevision clears the audit run (target included) but keeps the pacing preference', () => {
    const s = store.getState();
    s.setAuditPacing('stepped');
    s.startAudit(['a'], 'root');
    store.getState().setAuditAwaiting(true);
    store.getState().resetRevision();
    const st = store.getState();
    expect(st.auditQueue).toEqual([]);
    expect(st.auditTargetId).toBeNull();
    expect(st.auditAwaiting).toBe(false);
    expect(st.auditCancelled).toBe(false);
    expect(st.auditPacing).toBe('stepped');
  });
});

describe('revision pass epoch', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('moves whenever the pass is cleared or replaced (close / reset / new audit)', () => {
    const e0 = store.getState().revisionPassEpoch;
    store.getState().closeRevisionWorkspace();
    const e1 = store.getState().revisionPassEpoch;
    expect(e1).toBeGreaterThan(e0);
    store.getState().resetRevision();
    const e2 = store.getState().revisionPassEpoch;
    expect(e2).toBeGreaterThan(e1);
    store.getState().startAudit(['a'], 'root');
    expect(store.getState().revisionPassEpoch).toBeGreaterThan(e2);
  });

  it('close + reopen never restores the old epoch (a resolving in-flight call must see a dead pass)', () => {
    store.getState().startAudit(['a'], 'root');
    const inFlightEpoch = store.getState().revisionPassEpoch;
    store.getState().closeRevisionWorkspace();
    store.getState().openRevisionWorkspace();
    const st = store.getState();
    expect(st.revisionWorkspaceOpen).toBe(true);
    expect(st.revisionPassEpoch).not.toBe(inFlightEpoch);
    expect(st.auditQueue).toEqual([]);
    expect(st.proposals).toEqual([]);
  });
});
