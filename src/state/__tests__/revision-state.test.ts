import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createRevisionSlice, type RevisionSlice, type SessionProposal } from '../revision-state';

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

  it('toggles the per-pass source selection on and off', () => {
    store.getState().toggleRevisionSource('x');
    expect(store.getState().selectedSourceIds).toContain('x');
    store.getState().toggleRevisionSource('x');
    expect(store.getState().selectedSourceIds).not.toContain('x');
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
