import { describe, expect, it } from 'vitest';
import {
  applyProposal,
  extractDirectiveFromTurn,
  findProposalOffset,
  normalizeDirectiveSuggestions,
  normalizeRevisions,
  revisionReady,
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

  it('receipt-optional mode keeps proposals with no receipt (two guarantees, not three)', () => {
    const intrinsicItem = {
      revision_type: 'Addition',
      original_text: '[stub]',
      proposed_text: 'a finished thought.',
      rationale: 'completes the paragraph',
      source_id: '',
      verbatim_source_quote: '',
      confidence_score: 4,
    };
    // The strict default (receiptRequired) drops it for the missing receipt...
    expect(normalizeRevisions([intrinsicItem])).toHaveLength(0);
    // ...but a receipt-optional pass (revision mode) keeps it.
    const out = normalizeRevisions([intrinsicItem], { receiptRequired: false })!;
    expect(out).toHaveLength(1);
    expect(out[0].original_text).toBe('[stub]');
    expect(out[0].verbatim_source_quote).toBe('');
    expect(out[0].source_id).toBe('');
  });

  it('receipt-optional mode still requires the edit spans', () => {
    const out = normalizeRevisions(
      [
        { ...valid, source_id: '', verbatim_source_quote: '' },
        { ...valid, source_id: '', verbatim_source_quote: '', original_text: '' },
        { ...valid, source_id: '', verbatim_source_quote: '', proposed_text: '  ' },
      ],
      { receiptRequired: false },
    )!;
    expect(out).toHaveLength(1);
  });

  it('keeps a source-derived AND an intrinsic proposal in a mixed receipt-optional pass', () => {
    const out = normalizeRevisions(
      [
        valid, // source-derived (has a receipt)
        {
          revision_type: 'Flow Improvement',
          original_text: 'another sentence.',
          proposed_text: 'a smoother sentence.',
          rationale: 'flow',
          source_id: '',
          verbatim_source_quote: '',
          confidence_score: 3,
        },
      ],
      { receiptRequired: false },
    )!;
    expect(out).toHaveLength(2);
    expect(out[0].verbatim_source_quote).toBe('a quote');
    expect(out[1].verbatim_source_quote).toBe('');
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

  it('fills an empty source_id from the fallback ONLY for a receipted proposal', () => {
    // A receipted proposal (has a verbatim quote) missing its source_id gets the
    // single-source fallback.
    const receipted = normalizeRevisions([{ ...valid, source_id: '' }], {
      fallbackSourceId: 'only-src',
    })!;
    expect(receipted[0].source_id).toBe('only-src');

    // An intrinsic proposal (no receipt) must NOT be mis-attributed to that source —
    // the fallback is guarded on the verbatim quote being present.
    const intrinsic = normalizeRevisions(
      [{ ...valid, source_id: '', verbatim_source_quote: '' }],
      { fallbackSourceId: 'only-src', receiptRequired: false },
    )!;
    expect(intrinsic[0].source_id).toBe('');
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

describe('revisionReady', () => {
  it('revision mode is ready iff a directive is present (sources irrelevant)', () => {
    expect(revisionReady('revision', 0, 'do the thing')).toBe(true);
    expect(revisionReady('revision', 3, '   ')).toBe(false);
    expect(revisionReady('revision', 0, '')).toBe(false);
  });

  it('assembly and citations are ready iff a source is selected (directive optional)', () => {
    expect(revisionReady('assembly', 1, '')).toBe(true);
    expect(revisionReady('assembly', 0, 'directive')).toBe(false);
    expect(revisionReady('citations', 2, '')).toBe(true);
    expect(revisionReady('citations', 0, 'directive')).toBe(false);
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

describe('extractDirectiveFromTurn', () => {
  it('pulls the directive out of a fenced json block amid prose', () => {
    const turn = `Good — that's clear now.\n\n\`\`\`json\n{ "directive": "Tighten the opening; preserve the Dewey framing." }\n\`\`\``;
    expect(extractDirectiveFromTurn(turn)).toBe(
      'Tighten the opening; preserve the Dewey framing.',
    );
  });

  it('takes the LAST fenced block when the model shows drafts', () => {
    const turn = `\`\`\`json\n{ "directive": "draft" }\n\`\`\`\nActually, sharper:\n\`\`\`json\n{ "directive": "final" }\n\`\`\``;
    expect(extractDirectiveFromTurn(turn)).toBe('final');
  });

  it('tolerates a bare unfenced JSON object', () => {
    expect(extractDirectiveFromTurn('{ "directive": "Do it." }')).toBe('Do it.');
  });

  it('tolerates key variance', () => {
    expect(extractDirectiveFromTurn('```json\n{ "text": "Via text key." }\n```')).toBe(
      'Via text key.',
    );
  });

  it('returns null for a mid-dialogue prose turn', () => {
    expect(extractDirectiveFromTurn('What feels unfinished about the closing move?')).toBeNull();
  });

  it('returns null for a fenced block with no directive-like key', () => {
    expect(extractDirectiveFromTurn('```json\n{ "goal": 1 }\n```')).toBeNull();
    expect(extractDirectiveFromTurn('```json\n[1,2]\n```')).toBeNull();
  });
});
