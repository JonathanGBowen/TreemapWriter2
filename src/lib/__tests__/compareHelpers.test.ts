import { describe, expect, it } from 'vitest';
import {
  alignByTitle,
  extractHeadings,
  normalizeComparison,
  sharedTitles,
} from '../compareHelpers';

const A = `# Intro
Some text.
## Method
More text.
## Results
Findings.`;

const B = `# Intro
Revised text.
## Method
Tighter text.
## Discussion
New section.`;

describe('extractHeadings', () => {
  it('pulls ATX headings with their levels, in order', () => {
    expect(extractHeadings(A)).toEqual([
      { title: 'Intro', level: 1 },
      { title: 'Method', level: 2 },
      { title: 'Results', level: 2 },
    ]);
  });

  it('ignores non-heading lines and trims trailing whitespace', () => {
    expect(extractHeadings('plain line\n##   Spaced   \ntext')).toEqual([
      { title: 'Spaced', level: 2 },
    ]);
  });

  it('returns [] for prose with no headings', () => {
    expect(extractHeadings('just a paragraph')).toEqual([]);
  });
});

describe('alignByTitle', () => {
  it('unions titles (A order first, then B-only) with presence flags', () => {
    expect(alignByTitle(A, B)).toEqual([
      { title: 'Intro', presentInA: true, presentInB: true },
      { title: 'Method', presentInA: true, presentInB: true },
      { title: 'Results', presentInA: true, presentInB: false },
      { title: 'Discussion', presentInA: false, presentInB: true },
    ]);
  });

  it('collapses duplicate titles within a version to one entry', () => {
    const dup = '# Same\n## Same\ntext';
    expect(alignByTitle(dup, dup)).toEqual([
      { title: 'Same', presentInA: true, presentInB: true },
    ]);
  });

  it('handles an empty side', () => {
    expect(alignByTitle('', B)).toEqual([
      { title: 'Intro', presentInA: false, presentInB: true },
      { title: 'Method', presentInA: false, presentInB: true },
      { title: 'Discussion', presentInA: false, presentInB: true },
    ]);
  });
});

describe('sharedTitles', () => {
  it('returns only titles present in both versions', () => {
    expect(sharedTitles(A, B)).toEqual(['Intro', 'Method']);
  });
});

describe('normalizeComparison', () => {
  const wellFormed = {
    direction: 'improved',
    verdict: 'B sharpens the central claim.',
    conceptualDrift: 'The thesis narrowed from two claims to one.',
    improvements: [
      { summary: 'Clearer thesis', aspect: 'mainClaim', receipts: [{ quote: 'B sentence', side: 'b' }] },
    ],
    losses: [],
    moveChanges: [],
    sectionNotes: [
      { sectionTitle: 'Intro', presentInA: true, presentInB: true, direction: 'improved', note: 'tighter' },
    ],
  };

  it('passes a well-formed payload through, attaching the lens name', () => {
    const r = normalizeComparison(wellFormed, 'Developmental Edit');
    expect(r).not.toBeNull();
    expect(r!.direction).toBe('improved');
    expect(r!.improvements[0].receipts[0].side).toBe('b');
    expect(r!.sectionNotes[0].sectionTitle).toBe('Intro');
    expect(r!.lensName).toBe('Developmental Edit');
  });

  it('falls back to a lateral direction when the value is invalid', () => {
    const r = normalizeComparison({ ...wellFormed, direction: 'wat' });
    expect(r!.direction).toBe('lateral');
  });

  it('drops malformed changes and receipts but keeps usable ones', () => {
    const r = normalizeComparison({
      ...wellFormed,
      improvements: [
        { summary: '', receipts: [] }, // dropped: no summary
        { summary: 'kept', receipts: [{ quote: '', side: 'a' }, { quote: 'ok', side: 'b' }] },
      ],
    });
    expect(r!.improvements).toHaveLength(1);
    expect(r!.improvements[0].summary).toBe('kept');
    expect(r!.improvements[0].receipts).toHaveLength(1);
  });

  it('returns null for junk with no findings', () => {
    expect(normalizeComparison({ verdict: '', improvements: [] })).toBeNull();
    expect(normalizeComparison(null)).toBeNull();
    expect(normalizeComparison('nope')).toBeNull();
  });

  it('defaults section presence to true unless explicitly false', () => {
    const r = normalizeComparison({
      ...wellFormed,
      sectionNotes: [{ sectionTitle: 'X', presentInB: false, direction: 'regressed', note: 'cut' }],
    });
    expect(r!.sectionNotes[0].presentInA).toBe(true);
    expect(r!.sectionNotes[0].presentInB).toBe(false);
  });
});
