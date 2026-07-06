import { describe, it, expect } from 'vitest';
import { parseAgentProposals, normalizeRevisions } from '../revision-helpers';

const PROPOSAL = {
  original_text: 'old sentence.',
  proposed_text: 'new sentence.',
  rationale: 'grounded in §2',
  confidence_score: 4,
};

describe('parseAgentProposals', () => {
  it('parses a bare JSON array', () => {
    expect(parseAgentProposals(JSON.stringify([PROPOSAL]))).toEqual([PROPOSAL]);
  });

  it('parses a fenced ```json block', () => {
    const answer = '```json\n' + JSON.stringify([PROPOSAL]) + '\n```';
    expect(parseAgentProposals(answer)).toEqual([PROPOSAL]);
  });

  it('extracts an array buried in prose (not the inner object)', () => {
    const answer = `Here are my proposals: ${JSON.stringify([PROPOSAL])} — accept or reject each.`;
    expect(parseAgentProposals(answer)).toEqual([PROPOSAL]);
  });

  it('unwraps the array from an object envelope', () => {
    expect(parseAgentProposals(JSON.stringify({ proposals: [PROPOSAL] }))).toEqual([PROPOSAL]);
  });

  it('returns null for non-JSON prose', () => {
    expect(parseAgentProposals('I could not find anything to change.')).toBeNull();
  });
});

describe('deep-pass agent answer -> normalizeRevisions', () => {
  it('yields a usable proposal from a fenced array (receipt optional)', () => {
    const answer = '```json\n' + JSON.stringify([PROPOSAL]) + '\n```';
    const proposals = normalizeRevisions(parseAgentProposals(answer), {
      sectionLabel: 'Intro',
      receiptRequired: false,
    });
    expect(proposals).toHaveLength(1);
    expect(proposals![0]).toMatchObject({
      original_text: 'old sentence.',
      proposed_text: 'new sentence.',
      section: 'Intro',
      confidence_score: 4,
    });
  });

  it('honours the receipt contract: dropped when required, kept when optional', () => {
    const arr = parseAgentProposals(JSON.stringify([PROPOSAL]));
    expect(normalizeRevisions(arr, { receiptRequired: true })).toHaveLength(0);
    expect(normalizeRevisions(arr, { receiptRequired: false })).toHaveLength(1);
  });

  it('returns [] when the agent reports no edits', () => {
    expect(normalizeRevisions(parseAgentProposals('[]'), { receiptRequired: false }) ?? []).toEqual([]);
  });
});
