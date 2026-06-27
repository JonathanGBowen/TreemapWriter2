import { describe, it, expect } from 'vitest';
import { deriveTopo } from '../topo-derive';
import { computeCentering, upstreamClosure, quasiLocalLabel } from '../topo-centering';
import type { Section, TestSuite, TestSuiteEntry } from '../../../../types';

// --- tiny builders -------------------------------------------------------
// startOffset doubles as a unique seed; docIndex is derived from array order.
let counter = 0;
const sec = (id: string): Section => ({
  id,
  title: id.toUpperCase(),
  level: 1,
  content: '',
  fullContent: '',
  startLine: 0,
  endLine: 0,
  startOffset: counter++,
  wordCount: 100,
  children: [],
  parentId: null,
});

// `deps` maps a section id → the prerequisite ids it depends on. In topo-derive
// the OWNER of the dependency is the target; the prerequisite is the arc source.
// So deps = { b: ['a'] } yields the arc a → b ("A feeds B", "B depends on A").
function build(ids: string[], deps: Record<string, string[]> = {}) {
  const sections: Section[] = ids.map(sec);
  const testSuite: TestSuite = {};
  for (const id of ids) {
    const entry: TestSuiteEntry = { goals: '', status: 'idle' };
    if (deps[id]?.length) {
      entry.dependencies = deps[id].map((d) => ({ id: d, type: 'prerequisite' as const }));
    }
    testSuite[id] = entry;
  }
  return deriveTopo(sections, testSuite);
}

describe('computeCentering — rank / radix / telos / centrality', () => {
  it('linear chain A→B→C ranks 0/1/2 with the source as radix and sink as telos', () => {
    const c = computeCentering(build(['a', 'b', 'c'], { b: ['a'], c: ['b'] }));
    expect(c.byId.a.rank).toBe(0);
    expect(c.byId.b.rank).toBe(1);
    expect(c.byId.c.rank).toBe(2);
    expect(c.maxRank).toBe(2);
    expect(c.byId.a.centrality).toBe(2); // b and c rest on a
    expect(c.byId.b.centrality).toBe(1);
    expect(c.byId.c.centrality).toBe(0);
    expect(c.radix).toEqual(['a']);
    expect(c.telos).toEqual(['c']);
    expect(c.byId.a.isRadix).toBe(true);
    expect(c.byId.c.isTelos).toBe(true);
    expect(c.miscentering).toBe(0);
  });

  it('diamond A→{B,C}→D gives the apex centrality 3 and two mid-rank nodes', () => {
    const c = computeCentering(build(['a', 'b', 'c', 'd'], { b: ['a'], c: ['a'], d: ['b', 'c'] }));
    expect(c.byId.a.centrality).toBe(3); // b, c, d all rest on a
    expect(c.byId.a.rank).toBe(0);
    expect(c.byId.b.rank).toBe(1);
    expect(c.byId.c.rank).toBe(1);
    expect(c.byId.d.rank).toBe(2);
    expect(c.radix).toEqual(['a']);
    expect(c.telos).toEqual(['d']);
  });
});

describe('computeCentering — cycles (must not hang)', () => {
  it('A↔B is one strongly-connected component, both marked in-cycle', () => {
    const c = computeCentering(build(['a', 'b'], { b: ['a'], a: ['b'] }));
    expect(c.cycles).toHaveLength(1);
    expect(c.cycles[0].sort()).toEqual(['a', 'b']);
    expect(c.byId.a.inCycle).toBe(true);
    expect(c.byId.b.inCycle).toBe(true);
    // ranks stay finite; neither is a radix (both have an inbound arc)
    expect(Number.isFinite(c.byId.a.rank)).toBe(true);
    expect(c.byId.a.isRadix).toBe(false);
    expect(c.radix).toEqual([]);
  });
});

describe('computeCentering — backward arcs (the two-wings distortion)', () => {
  it('flags a prerequisite that sits after its dependent in reading order', () => {
    // A (docIndex 0) depends on B (docIndex 1): arc source=b → target=a, b is later.
    const model = build(['a', 'b'], { a: ['b'] });
    const c = computeCentering(model);
    expect(c.backwardCount).toBe(1);
    expect(c.backwardArcs.has('b->a')).toBe(true);
    expect(c.miscentering).toBe(1); // 1 backward of 1 arc
    expect(c.byId.b.isRadix).toBe(true); // b is the source the doc rests on
    expect(c.byId.a.isTelos).toBe(true);
  });
});

describe('computeCentering — degenerate inputs', () => {
  it('an isolated node has zero everything and is neither radix nor telos', () => {
    const c = computeCentering(build(['a']));
    expect(c.byId.a).toMatchObject({ rank: 0, centrality: 0, isRadix: false, isTelos: false, inCycle: false });
    expect(c.maxRank).toBe(0);
    expect(c.radix).toEqual([]);
    expect(c.telos).toEqual([]);
    expect(c.cycles).toEqual([]);
    expect(c.miscentering).toBe(0);
  });

  it('the empty document throws nothing and reports an empty field', () => {
    const c = computeCentering(build([]));
    expect(c.byId).toEqual({});
    expect(c.maxRank).toBe(0);
    expect(c.backwardCount).toBe(0);
  });
});

describe('computeCentering — quasi-local position (§17, the second centering)', () => {
  it('spreads position 0..1 over authored order, with concrete place-words', () => {
    const c = computeCentering(build(['a', 'b', 'c', 'd', 'e']));
    expect(c.byId.a.position).toBe(0); // first section
    expect(c.byId.e.position).toBe(1); // last section
    expect(c.byId.c.position).toBeCloseTo(0.5); // middle of five
    expect(c.byId.a.quasiLocal).toBe('near the beginning');
    expect(c.byId.c.quasiLocal).toBe('around the middle');
    expect(c.byId.e.quasiLocal).toBe('near the end');
  });

  it('a single-section document sits at the beginning, not divide-by-zero', () => {
    const c = computeCentering(build(['solo']));
    expect(c.byId.solo.position).toBe(0);
    expect(c.byId.solo.quasiLocal).toBe('near the beginning');
  });
});

describe('quasiLocalLabel — band thresholds', () => {
  it('maps each band', () => {
    expect(quasiLocalLabel(0)).toBe('near the beginning');
    expect(quasiLocalLabel(0.3)).toBe('in the first half');
    expect(quasiLocalLabel(0.5)).toBe('around the middle');
    expect(quasiLocalLabel(0.75)).toBe('in the second half');
    expect(quasiLocalLabel(1)).toBe('near the end');
  });
});

describe('upstreamClosure — what a node rests on', () => {
  it('returns the transitive prerequisites, excluding the node itself', () => {
    const model = build(['a', 'b', 'c'], { b: ['a'], c: ['b'] });
    expect([...upstreamClosure(model, 'c')].sort()).toEqual(['a', 'b']);
    expect([...upstreamClosure(model, 'a')]).toEqual([]);
  });
});
