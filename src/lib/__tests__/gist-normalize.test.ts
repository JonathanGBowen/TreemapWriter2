import { describe, expect, it } from 'vitest';
import {
  normalizeGistAnalysis,
  normalizeGistComposition,
  normalizeGistRefit,
  normalizeGistSpan,
} from '../gist-normalize';

describe('normalizeGistAnalysis', () => {
  it('aligns segments by id, clamps weight, validates move/force, fills misses', () => {
    const out = normalizeGistAnalysis(
      {
        segments: [
          { id: 's0', core_claims: ['x'], move: 'argue', anchor_terms: ['crate'], force: 'hedged', transition: 'But', weight: 9 },
          { id: 's0-dupe-ignored-no-id-match: false', move: 'nonsense' },
        ],
        thesis: 'Insight is not search.',
        style: { person: 'first', register: 'wry', cadence: 'short', signature_moves: 'rhetorical question' },
      },
      ['s0', 's1'],
    );
    expect(out.segments).toHaveLength(2);
    expect(out.segments[0].weight).toBe(5); // clamped from 9
    expect(out.segments[0].move).toBe('argue');
    expect(out.segments[1]).toMatchObject({ id: 's1', move: 'assert', force: 'asserted', weight: 2 });
    expect(out.thesis).toBe('Insight is not search.');
    expect(out.style.register).toBe('wry');
  });

  it('falls back to a default style and empty thesis on garbage', () => {
    const out = normalizeGistAnalysis(null, ['s0']);
    expect(out.segments).toHaveLength(1);
    expect(out.thesis).toBe('');
    expect(out.style.person).toBeTruthy();
  });
});

describe('normalizeGistComposition', () => {
  it('aligns coarse and fine to their id lists, missing → empty span', () => {
    const out = normalizeGistComposition(
      { g0: 'Thesis.', coarse: [{ id: 'c0', text: 'Coarse zero.' }], fine: [{ id: 'f1', text: 'Fine one.' }] },
      { coarse: ['c0', 'c1'], fine: ['f0', 'f1'] },
    );
    expect(out.g0).toBe('Thesis.');
    expect(out.coarse.map((s) => s.text)).toEqual(['Coarse zero.', '']);
    expect(out.fine.map((s) => [s.id, s.text])).toEqual([['f0', ''], ['f1', 'Fine one.']]);
  });
});

describe('normalizeGistSpan / normalizeGistRefit', () => {
  it('parses a single span, rejecting the unusable', () => {
    expect(normalizeGistSpan({ id: 's0', text: 'Refreshed.' })).toEqual({ id: 's0', text: 'Refreshed.' });
    expect(normalizeGistSpan({ id: 's0' })).toBeNull();
  });

  it('returns null on {fits:false}, else the re-aligned grain', () => {
    expect(normalizeGistRefit({ fits: false }, ['s0'])).toBeNull();
    expect(normalizeGistRefit({ spans: [{ id: 's0', text: 'Tighter.' }] }, ['s0', 's1'])).toEqual([
      { id: 's0', text: 'Tighter.' },
      { id: 's1', text: '' },
    ]);
  });
});
