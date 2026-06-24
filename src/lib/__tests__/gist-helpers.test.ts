import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../utils';
import {
  buildSegmentation,
  chooseGrain,
  computeBudgets,
  describeG0,
  flattenGistSegments,
  grainSegmentIds,
  normalizeForHash,
  perSegmentBudgets,
  recomputeStale,
  scanBannedFrames,
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

  it('passes a clean composition', () => {
    expect(validateGist(clean, ids, budgets).ok).toBe(true);
  });

  it('fails on a missing span, a banned frame, and an over-budget grain', () => {
    expect(validateGist({ ...clean, fine: [clean.fine[0]] }, ids, budgets).ok).toBe(false);
    expect(validateGist({ ...clean, g0: 'This chapter discusses insight.' }, ids, budgets).ok).toBe(false);
    expect(validateGist(clean, ids, { ...budgets, fine: 3 }).ok).toBe(false);
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
