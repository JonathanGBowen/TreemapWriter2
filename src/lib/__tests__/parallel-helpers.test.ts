import { describe, expect, it } from 'vitest';
import { segmentParagraphs } from '../paragraph-helpers';
import {
  normalizeParagraphRewrite,
  normalizeReverseOutline,
  sourceHashOf,
} from '../parallel-helpers';

const blocks = segmentParagraphs('# Heading\n\nProse paragraph one.\n\nProse paragraph two.');

describe('normalizeReverseOutline', () => {
  it('aligns model bullets to blocks 1:1 by index', () => {
    const out = normalizeReverseOutline(
      { bullets: [{ index: 1, sentence: 'Claim one.' }, { index: 2, sentence: 'Claim two.' }] },
      blocks,
    );
    expect(out).toHaveLength(3);
    expect(out.map((b) => b.sentence)).toEqual(['# Heading', 'Claim one.', 'Claim two.']);
    expect(out.map((b) => b.kind)).toEqual(['heading', 'prose', 'prose']);
  });

  it('always echoes non-prose blocks verbatim, ignoring any model output for them', () => {
    const out = normalizeReverseOutline(
      { bullets: [{ index: 0, sentence: 'model tried to restate the heading' }] },
      blocks,
    );
    expect(out[0].sentence).toBe('# Heading');
  });

  it('leaves a missed prose block with an empty sentence (never a dropped row)', () => {
    const out = normalizeReverseOutline({ bullets: [{ index: 1, sentence: 'Only one.' }] }, blocks);
    expect(out).toHaveLength(3);
    expect(out[2].sentence).toBe('');
  });

  it('tolerates a bare array, synonym fields, and an unrecoverable shape', () => {
    expect(normalizeReverseOutline([{ i: 1, text: 'Syn.' }], blocks)[1].sentence).toBe('Syn.');
    expect(normalizeReverseOutline(null, blocks).map((b) => b.sentence)).toEqual(['# Heading', '', '']);
  });
});

describe('normalizeParagraphRewrite', () => {
  it('extracts original/proposed text', () => {
    expect(
      normalizeParagraphRewrite({ original_text: 'a', proposed_text: 'b' }),
    ).toEqual({ original_text: 'a', proposed_text: 'b' });
  });

  it('accepts an insertion (empty original, non-empty proposed)', () => {
    expect(normalizeParagraphRewrite({ original_text: '', proposed_text: 'new para' })).toEqual({
      original_text: '',
      proposed_text: 'new para',
    });
  });

  it('returns null when there is no usable proposed_text', () => {
    expect(normalizeParagraphRewrite({ original_text: 'a', proposed_text: '   ' })).toBeNull();
    expect(normalizeParagraphRewrite(null)).toBeNull();
    expect(normalizeParagraphRewrite(['nope'])).toBeNull();
  });

  it('tolerates synonym field names', () => {
    expect(normalizeParagraphRewrite({ rewrite: 'b' })).toEqual({ original_text: '', proposed_text: 'b' });
  });
});

describe('sourceHashOf', () => {
  it('is stable and content-sensitive', () => {
    expect(sourceHashOf('hello')).toBe(sourceHashOf('hello'));
    expect(sourceHashOf('hello')).not.toBe(sourceHashOf('hello!'));
  });
});
