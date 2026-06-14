import { describe, expect, it } from 'vitest';
import {
  applyProposal,
  findProposalOffset,
  normalizeDirectiveSuggestions,
  normalizeRevisions,
} from '../revision-helpers';

const valid = {
  revision_type: 'Replacement',
  original_text: 'old sentence.',
  proposed_text: 'new sentence.',
  rationale: 'because',
  source_id: 'src-1',
  verbatim_source_quote: 'a quote',
  confidence_score: 4.2,
};

describe('normalizeRevisions', () => {
  it('parses a valid array and preserves fields', () => {
    const out = normalizeRevisions([valid]);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(1);
    const p = out![0];
    expect(p.revision_type).toBe('Replacement');
    expect(p.original_text).toBe('old sentence.');
    expect(p.proposed_text).toBe('new sentence.');
    expect(p.verbatim_source_quote).toBe('a quote');
    expect(p.confidence_score).toBe(4.2);
    expect(typeof p.id).toBe('string');
  });

  it('returns null for unrecoverable shapes', () => {
    expect(normalizeRevisions(null)).toBeNull();
    expect(normalizeRevisions('nope')).toBeNull();
    expect(normalizeRevisions({ foo: 1 })).toBeNull();
  });

  it('treats a valid-but-empty array as no proposals (not an error)', () => {
    expect(normalizeRevisions([])).toEqual([]);
  });

  it('extracts from a {proposals:[...]} envelope', () => {
    expect(normalizeRevisions({ proposals: [valid] })).toHaveLength(1);
  });

  it('drops entries missing the receipt or the edit spans', () => {
    const out = normalizeRevisions([
      valid,
      { ...valid, verbatim_source_quote: '' },
      { ...valid, original_text: '' },
      { ...valid, proposed_text: '   ' },
    ]);
    expect(out).toHaveLength(1);
  });

  it('clamps confidence to 0–5 and defaults non-numbers to 3', () => {
    const out = normalizeRevisions([
      { ...valid, confidence_score: 9 },
      { ...valid, confidence_score: -2 },
      { ...valid, confidence_score: 'x' },
    ])!;
    expect(out[0].confidence_score).toBe(5);
    expect(out[1].confidence_score).toBe(0);
    expect(out[2].confidence_score).toBe(3);
  });

  it('coerces an unknown revision_type to Replacement', () => {
    const out = normalizeRevisions([{ ...valid, revision_type: 'Frobnicate' }])!;
    expect(out[0].revision_type).toBe('Replacement');
  });

  it('fills an empty source_id from the fallback', () => {
    const out = normalizeRevisions([{ ...valid, source_id: '' }], { fallbackSourceId: 'only-src' })!;
    expect(out[0].source_id).toBe('only-src');
  });

  it('tolerates field-name variance (camelCase + synonyms)', () => {
    const out = normalizeRevisions([
      {
        type: 'Tone Adjustment',
        original: 'old line.',
        replacement: 'new line.',
        reason: 'because',
        sourceId: 'src-2',
        quote: 'the receipt',
        confidence: 4,
      },
    ]);
    expect(out).toHaveLength(1);
    const p = out![0];
    expect(p.revision_type).toBe('Tone Adjustment');
    expect(p.original_text).toBe('old line.');
    expect(p.proposed_text).toBe('new line.');
    expect(p.source_id).toBe('src-2');
    expect(p.verbatim_source_quote).toBe('the receipt');
    expect(p.confidence_score).toBe(4);
  });
});

describe('findProposalOffset', () => {
  it('returns the first-occurrence index', () => {
    expect(findProposalOffset('abc DEF ghi', 'DEF')).toBe(4);
  });
  it('returns -1 when absent or empty', () => {
    expect(findProposalOffset('abc', 'xyz')).toBe(-1);
    expect(findProposalOffset('abc', '')).toBe(-1);
  });
});

describe('applyProposal', () => {
  it('replaces the first occurrence literally', () => {
    expect(applyProposal('the cat sat', { original_text: 'cat', proposed_text: 'dog' })).toBe(
      'the dog sat',
    );
  });
  it('is a no-op when the span is absent', () => {
    expect(applyProposal('the cat sat', { original_text: 'fox', proposed_text: 'dog' })).toBe(
      'the cat sat',
    );
  });
  it('does not interpret $ in the replacement', () => {
    expect(applyProposal('cost is X', { original_text: 'X', proposed_text: '$5 (a $-amount)' })).toBe(
      'cost is $5 (a $-amount)',
    );
  });
});

describe('normalizeDirectiveSuggestions', () => {
  it('extracts from a {directives:[...]} envelope and titles untitled entries', () => {
    const out = normalizeDirectiveSuggestions({
      directives: [
        { title: 'Tighten', directive: 'Cut the hedging.' },
        { directive: 'Improve flow.' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out![0]).toEqual({ title: 'Tighten', directive: 'Cut the hedging.' });
    expect(out![1].title).toBe('Option 2');
  });

  it('accepts a bare array and synonym fields, dropping empty directives', () => {
    const out = normalizeDirectiveSuggestions([
      { label: 'A', text: 'Do the thing.' },
      { title: 'B', directive: '' },
    ]);
    expect(out).toHaveLength(1);
    expect(out![0]).toEqual({ title: 'A', directive: 'Do the thing.' });
  });

  it('returns null when no array is recoverable', () => {
    expect(normalizeDirectiveSuggestions(null)).toBeNull();
    expect(normalizeDirectiveSuggestions({ nope: 1 })).toBeNull();
  });
});
