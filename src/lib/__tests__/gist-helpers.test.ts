import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../utils';
import {
  buildSegmentation,
  chooseGrain,
  computeBudgets,
  describeG0,
  flattenGistSegments,
  gistOmittedIds,
  grainSegmentIds,
  normalizeForHash,
  perSegmentBudgets,
  recomputeStale,
  scanBannedFrames,
  spansOmitted,
  synthesizeDescribeSpans,
  validateGist,
} from '../gist-helpers';
import type { GistSpan, StoredGist } from '../../types';

const DOC = [
  '# Chapter One',
  'Intro to chapter one.',
  '## Section A',
  'Body of A with the crate as a step.',
  '## Section B',
  'Body of B.',
  '# Chapter Two',
  'Only a lead.',
].join('\n');

const sections = parseMarkdown(DOC);
const idOf = (title: string) => flattenGistSegments(sections).find((s) => s.title === title)!.id;

describe('flattenGistSegments / grainSegmentIds', () => {
  it('walks the tree in document order, every node a segment', () => {
    expect(flattenGistSegments(sections).map((s) => s.title)).toEqual([
      'Chapter One', 'Section A', 'Section B', 'Chapter Two',
    ]);
  });

  it('coarse = top-level sections; fine = every segment', () => {
    const { fine, coarse } = grainSegmentIds(sections);
    expect(fine).toHaveLength(4);
    expect(coarse).toEqual([idOf('Chapter One'), idOf('Chapter Two')]);
  });

  it('carries the full heading path for aria-labels', () => {
    const a = flattenGistSegments(sections).find((s) => s.title === 'Section A')!;
    expect(a.headingPath).toEqual(['Chapter One', 'Section A']);
  });
});

describe('normalizeForHash', () => {
  it('ignores formatting (emphasis, headings) but not content', () => {
    expect(normalizeForHash('## Body of **B**.')).toBe(normalizeForHash('Body of B.'));
    expect(normalizeForHash('Body of B.')).not.toBe(normalizeForHash('Body of C.'));
  });
});

describe('recomputeStale', () => {
  const seg = buildSegmentation(sections);

  it('a content edit marks exactly that segment stale', () => {
    const edited = parseMarkdown(DOC.replace('Body of A with the crate as a step.', 'Body of A, rewritten.'), sections);
    const { staleIds, orphanIds } = recomputeStale(seg, edited);
    expect(staleIds).toEqual([idOf('Section A')]);
    expect(orphanIds).toEqual([]);
  });

  it('a formatting-only edit does NOT mark anything stale', () => {
    const edited = parseMarkdown(DOC.replace('Body of B.', 'Body of *B*.'), sections);
    expect(recomputeStale(seg, edited).staleIds).toEqual([]);
  });

  it('a deleted section is orphaned, not mis-targeted', () => {
    const edited = parseMarkdown(DOC.replace('# Chapter Two\nOnly a lead.', ''), sections);
    const { orphanIds } = recomputeStale(seg, edited);
    expect(orphanIds).toContain(idOf('Chapter Two'));
  });
});

describe('computeBudgets / perSegmentBudgets', () => {
  it('orders the grains fine ≥ coarse ≥ g0 and stays positive', () => {
    const b = computeBudgets({ contentW: 300, contentH: 800, lineHeightPx: 22.5, avgGlyphPx: 7.2 });
    expect(b.fine).toBeGreaterThanOrEqual(b.coarse);
    expect(b.coarse).toBeGreaterThanOrEqual(b.g0);
    expect(b.target).toBeLessThanOrEqual(b.total);
  });

  it('distributes per-segment budgets by weight, floored at 8, summing within target', () => {
    const w = [{ id: 'a', weight: 5 }, { id: 'b', weight: 1 }, { id: 'c', weight: 1 }];
    const out = perSegmentBudgets(w, 100);
    expect(out.a).toBeGreaterThan(out.b);
    expect(Math.min(out.a, out.b, out.c)).toBeGreaterThanOrEqual(8);
    expect(out.a + out.b + out.c).toBeLessThanOrEqual(100);
  });
});

describe('chooseGrain', () => {
  const gist = {
    g0: 'short',
    coarse: [{ id: 's', text: 'a medium length coarse grain' }],
    fine: [{ id: 's', text: 'a much much longer fine grain that overflows the panel height' }],
  } as unknown as StoredGist;

  it('returns the finest grain that fits, falling back fine → coarse → g0', () => {
    // measure = word count as a proxy for rendered height
    const measure = (t: string) => t.split(/\s+/).length;
    expect(chooseGrain(gist, measure, 100)).toBe('fine');
    expect(chooseGrain(gist, measure, 6)).toBe('coarse');
    expect(chooseGrain(gist, measure, 1)).toBe('g0');
  });
});

describe('scanBannedFrames / validateGist', () => {
  it('catches reporting frames but never first-person "I argue"', () => {
    expect(scanBannedFrames('This section examines the crate.')).not.toHaveLength(0);
    expect(scanBannedFrames('The author argues that insight is real.')).not.toHaveLength(0);
    expect(scanBannedFrames('I argue that the crate has changed.')).toHaveLength(0);
  });

  const ids = { coarse: ['c1'], fine: ['f1', 'f2'] };
  const budgets = { total: 200, target: 176, g0: 40, coarse: 100, fine: 200 };
  const clean = {
    g0: 'I want insight back, naturalized.',
    coarse: [{ id: 'c1', text: 'Something goes wrong; I want insight back.' }] as GistSpan[],
    fine: [{ id: 'f1', text: 'We fare forth, then something goes wrong.' }, { id: 'f2', text: 'The crate has changed.' }] as GistSpan[],
  };

  it('passes a clean composition (no omissions)', () => {
    const v = validateGist(clean, ids, budgets);
    expect(v.ok).toBe(true);
    expect(v.omitted).toEqual({ coarse: [], fine: [] });
  });

  it('an OMITTED section (dropped or empty span) does NOT fail the gate — it is recorded as omission', () => {
    // Dropping f2 entirely: ok stays true, f2 is reported omitted (was: ok === false).
    const dropped = validateGist({ ...clean, fine: [clean.fine[0]] }, ids, budgets);
    expect(dropped.ok).toBe(true);
    expect(dropped.omitted.fine).toEqual(['f2']);

    // A present-but-empty span is the same: omission, not failure.
    const emptied = validateGist({ ...clean, fine: [clean.fine[0], { id: 'f2', text: '' }] }, ids, budgets);
    expect(emptied.ok).toBe(true);
    expect(emptied.omitted.fine).toEqual(['f2']);
  });

  it('still fails on a banned frame and an over-budget grain (genuine fidelity faults)', () => {
    expect(validateGist({ ...clean, g0: 'This chapter discusses insight.' }, ids, budgets).ok).toBe(false);
    expect(validateGist(clean, ids, { ...budgets, fine: 3 }).ok).toBe(false);
  });

  it('fails on an empty g0 thesis, and on TOTAL omission even when g0 survives', () => {
    // The g0 thesis is the irreducible core.
    expect(validateGist({ ...clean, g0: '   ' }, ids, budgets).ok).toBe(false);

    // The degenerate case the retry exists to catch: g0 present but EVERY span empty (a
    // truncated/refused compose). Sparse omission is fine; total omission is not a gist.
    const g0Only = {
      g0: 'I want insight back, naturalized.',
      coarse: [{ id: 'c1', text: '' }],
      fine: [{ id: 'f1', text: '' }, { id: 'f2', text: '' }],
    };
    const v = validateGist(g0Only as never, ids, budgets);
    expect(v.ok).toBe(false);
    expect(v.reasons.some((r) => r.includes('carries no section'))).toBe(true);

    // But a SPARSE gist (some sections carried, some omitted) stays valid.
    const sparse = { ...clean, fine: [clean.fine[0], { id: 'f2', text: '' }] };
    expect(validateGist(sparse, ids, budgets).ok).toBe(true);
  });

  it('still fails on a DUPLICATE span (a malformed grain, not an omission)', () => {
    const dup = validateGist(
      { ...clean, fine: [clean.fine[0], clean.fine[1], { id: 'f2', text: 'again' }] },
      ids,
      budgets,
    );
    expect(dup.ok).toBe(false);
    expect(dup.reasons.some((r) => r.includes('duplicate'))).toBe(true);
  });
});

describe('spansOmitted / gistOmittedIds', () => {
  it('flags present-but-empty and absent expected ids', () => {
    const spans: GistSpan[] = [{ id: 'a', text: 'carried' }, { id: 'b', text: '  ' }];
    expect(spansOmitted(spans, ['a', 'b', 'c'])).toEqual(['b', 'c']); // b empty, c absent
    expect(spansOmitted(spans, ['a'])).toEqual([]);
  });

  it('derives a stored gist\'s uncarried sections from its own empty spans', () => {
    const gist = {
      coarse: [{ id: 'c1', text: 'held' }],
      fine: [{ id: 'f1', text: 'held' }, { id: 'f2', text: '' }],
    } as unknown as StoredGist;
    expect(gistOmittedIds(gist)).toEqual({ coarse: [], fine: ['f2'] });
  });
});

describe('describing anti-pattern (voice chip)', () => {
  it('synthesizes describing spans from move + topic, never the real voice', () => {
    const spans = synthesizeDescribeSpans([
      { id: 'f1', title: 'Achievements of Insight', analysis: { id: 'f1', core_claims: [], move: 'survey', anchor_terms: ['insight'], force: 'asserted', transition: '', weight: 3 } },
    ]);
    expect(spans[0].text.toLowerCase()).toContain('this section');
    expect(describeG0('Insight is not search ending happily')).toContain('This document discusses');
  });
});
