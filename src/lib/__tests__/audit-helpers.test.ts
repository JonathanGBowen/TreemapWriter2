import { describe, expect, it } from 'vitest';
import {
  auditBudgetText,
  groupProposalsBySource,
  initAuditQueue,
  nextQueued,
  patchAuditQueue,
  settleRemaining,
} from '../audit-helpers';
import type { RevisionProposal, SourceDocument } from '../../types';

const src: SourceDocument = {
  id: 'a',
  role: 'reference',
  kind: 'Reference',
  label: 'A',
  glyph: '❡',
  content: 'Source text.',
};

const prop = (id: string, source_id: string): RevisionProposal => ({
  id,
  revision_type: 'Citation',
  section: 'Root',
  original_text: 'x',
  proposed_text: 'y',
  rationale: '',
  source_id,
  verbatim_source_quote: 'q',
  confidence_score: 4,
});

describe('audit queue mechanics', () => {
  it('initializes in selection order, all queued', () => {
    expect(initAuditQueue(['a', 'b'])).toEqual([
      { sourceId: 'a', status: 'queued', proposalCount: 0 },
      { sourceId: 'b', status: 'queued', proposalCount: 0 },
    ]);
  });

  it('nextQueued walks the queue in order and exhausts to undefined', () => {
    let q = initAuditQueue(['a', 'b']);
    expect(nextQueued(q)?.sourceId).toBe('a');
    q = patchAuditQueue(q, 'a', { status: 'done', proposalCount: 3 });
    expect(nextQueued(q)?.sourceId).toBe('b');
    q = patchAuditQueue(q, 'b', { status: 'error', note: 'boom' });
    expect(nextQueued(q)).toBeUndefined();
  });

  it('patch is a no-op for an unknown id', () => {
    const q = initAuditQueue(['a']);
    expect(patchAuditQueue(q, 'nope', { status: 'done' })).toEqual(q);
  });

  it('settleRemaining touches only still-queued items (the cancel path)', () => {
    let q = initAuditQueue(['a', 'b', 'c']);
    q = patchAuditQueue(q, 'a', { status: 'done', proposalCount: 1 });
    q = patchAuditQueue(q, 'b', { status: 'auditing' });
    q = settleRemaining(q, 'skipped', 'stopped');
    expect(q.map((i) => i.status)).toEqual(['done', 'auditing', 'skipped']);
    expect(q[2].note).toBe('stopped');
  });
});

describe('auditBudgetText', () => {
  it('joins document + source + directive, dropping an empty directive', () => {
    expect(auditBudgetText('DOC', src, 'FOCUS')).toBe('DOC\n\nSource text.\n\nFOCUS');
    expect(auditBudgetText('DOC', src, '')).toBe('DOC\n\nSource text.');
  });
});

describe('groupProposalsBySource', () => {
  it('groups in first-appearance order', () => {
    const groups = groupProposalsBySource([prop('1', 'b'), prop('2', 'a'), prop('3', 'b')]);
    expect(groups.map((g) => g.sourceId)).toEqual(['b', 'a']);
    expect(groups[0].proposals.map((p) => p.id)).toEqual(['1', '3']);
  });

  it('sorts the unattributed group last, preserving the rest', () => {
    const groups = groupProposalsBySource([prop('1', ''), prop('2', 'a')]);
    expect(groups.map((g) => g.sourceId)).toEqual(['a', '']);
  });

  it('returns no groups for no proposals', () => {
    expect(groupProposalsBySource([])).toEqual([]);
  });
});
