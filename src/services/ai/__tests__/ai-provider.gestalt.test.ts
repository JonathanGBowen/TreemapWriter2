import { describe, it, expect } from 'vitest';
import { __test } from '../ai-provider.gestalt';

const { normalizeWholeFromPart, normalizeRecenterings } = __test;

describe('normalizeWholeFromPart', () => {
  it('keeps a well-formed result and trims', () => {
    const out = normalizeWholeFromPart(
      { reconstructedClaim: '  the work argues X  ', alignment: 'partial', divergence: '  it over-weights Y  ', note: ' a note ' },
      true,
    );
    expect(out).toEqual({
      reconstructedClaim: 'the work argues X',
      alignment: 'partial',
      divergence: 'it over-weights Y',
      note: 'a note',
    });
  });

  it('drops divergence when aligned', () => {
    const out = normalizeWholeFromPart({ reconstructedClaim: 'X', alignment: 'aligned', divergence: 'should be dropped' }, true);
    expect(out).toEqual({ reconstructedClaim: 'X', alignment: 'aligned', divergence: undefined, note: undefined });
  });

  it('forces no-baseline (and drops divergence) when no baseline was provided', () => {
    const out = normalizeWholeFromPart({ reconstructedClaim: 'X', alignment: 'adrift', divergence: 'x' }, false);
    expect(out).toEqual({ reconstructedClaim: 'X', alignment: 'no-baseline', divergence: undefined, note: undefined });
  });

  it('falls back to partial for an unknown alignment when a baseline exists', () => {
    const out = normalizeWholeFromPart({ reconstructedClaim: 'X', alignment: 'bogus' }, true);
    expect(out?.alignment).toBe('partial');
  });

  it('returns null without a reconstructed claim or for junk', () => {
    expect(normalizeWholeFromPart({ alignment: 'aligned' }, true)).toBeNull();
    expect(normalizeWholeFromPart({ reconstructedClaim: '   ' }, true)).toBeNull();
    expect(normalizeWholeFromPart(null, true)).toBeNull();
    expect(normalizeWholeFromPart('nope', true)).toBeNull();
  });
});

describe('normalizeRecenterings', () => {
  it('keeps complete options and the question, dropping malformed options', () => {
    const out = normalizeRecenterings({
      options: [
        { center: ' A ', rationale: ' r ', whatChanges: ' c ' },
        { center: 'B', rationale: 'r2' }, // missing whatChanges → dropped
        'garbage',
      ],
      questionTheGoal: '  is the goal right?  ',
    });
    expect(out).toEqual({
      options: [{ center: 'A', rationale: 'r', whatChanges: 'c' }],
      questionTheGoal: 'is the goal right?',
    });
  });

  it('keeps a result with no options but a question', () => {
    expect(normalizeRecenterings({ options: [], questionTheGoal: 'q' })).toEqual({ options: [], questionTheGoal: 'q' });
  });

  it('returns null when neither options nor a question survive', () => {
    expect(normalizeRecenterings({ options: [{ center: 'A' }], questionTheGoal: '   ' })).toBeNull();
    expect(normalizeRecenterings({})).toBeNull();
    expect(normalizeRecenterings(null)).toBeNull();
  });
});
