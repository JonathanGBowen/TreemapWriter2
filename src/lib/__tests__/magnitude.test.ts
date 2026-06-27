import { describe, it, expect } from 'vitest';
import { magnitudeBand, roundedCount, CHAPTER_WORDS } from '../magnitude';

describe('magnitudeBand', () => {
  it('maps zero / blank to "empty"', () => {
    expect(magnitudeBand(0).label).toBe('empty');
    expect(magnitudeBand(-5).label).toBe('empty');
    expect(magnitudeBand(NaN).label).toBe('empty');
  });

  it('maps each privileged relevance-level', () => {
    expect(magnitudeBand(40).label).toBe('a line or two');
    expect(magnitudeBand(150).label).toBe('a paragraph');
    expect(magnitudeBand(400).label).toBe('a few paragraphs');
    expect(magnitudeBand(900).label).toBe('a short section');
    expect(magnitudeBand(2000).label).toBe('a section');
    expect(magnitudeBand(4500).label).toBe('a long section');
    expect(magnitudeBand(9000).label).toBe('about a chapter');
    expect(magnitudeBand(20000).label).toBe('a long chapter');
  });

  it('is stable across a band (a zone of indifference does not flip-flop)', () => {
    // The whole [3000, 6000) band reads as one label.
    expect(magnitudeBand(3000).label).toBe('a long section');
    expect(magnitudeBand(4000).label).toBe('a long section');
    expect(magnitudeBand(5999).label).toBe('a long section');
    // The boundary moves cleanly to the next band, once.
    expect(magnitudeBand(6000).label).toBe('about a chapter');
  });

  it('CHAPTER_WORDS marks the start of the "about a chapter" band', () => {
    expect(magnitudeBand(CHAPTER_WORDS - 1).label).toBe('a long section');
    expect(magnitudeBand(CHAPTER_WORDS).label).toBe('about a chapter');
  });
});

describe('roundedCount', () => {
  it('keeps zero exact', () => {
    expect(roundedCount(0)).toBe('0');
  });

  it('rounds small counts to a round number', () => {
    expect(roundedCount(44)).toBe('~40');
    expect(roundedCount(5)).toBe('~10'); // floor at 10 for any nonzero < 15
    expect(roundedCount(350)).toBe('~400');
    expect(roundedCount(940)).toBe('~900');
  });

  it('renders thousands compactly', () => {
    expect(roundedCount(1873)).toBe('~1.9k');
    expect(roundedCount(2000)).toBe('~2k');
    expect(roundedCount(12300)).toBe('~12k');
  });
});
