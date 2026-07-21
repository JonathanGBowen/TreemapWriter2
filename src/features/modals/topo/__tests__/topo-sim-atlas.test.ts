import { describe, expect, it } from 'vitest';
import type { Section, TestSuite, TestSuiteEntry, Dependency } from '../../../../types';
import { deriveTopo } from '../topo-derive';
import {
  buildInitial,
  canvasFor,
  fitNodes,
  metrics,
  optimizeTarget,
  radiusOf,
  segInt,
} from '../topo-sim-atlas';

let idc = 0;
function sec(partial: Partial<Section> & { id: string; title: string }): Section {
  return {
    level: 1,
    content: '',
    fullContent: '',
    startLine: idc,
    endLine: idc,
    startOffset: idc++,
    wordCount: 300,
    children: [],
    parentId: null,
    ...partial,
  };
}
function entry(deps?: Dependency[]): TestSuiteEntry {
  return { goals: '', status: 'success', dependencies: deps };
}

// Three Parts in columns; two cross-Part prerequisites arranged to cross in the
// chapter-ordered initial layout (low-left → high-right and high-left → low-right).
function crossingModel() {
  const sections: Section[] = [];
  const suite: TestSuite = {};
  ['0', '1', '2'].forEach((p) => {
    const child = sec({ id: `p${p}b`, title: `Part ${p} · b`, level: 2, parentId: `p${p}a` });
    const parent = sec({ id: `p${p}a`, title: `Part ${p}`, level: 1, parentId: 'root', children: [child] });
    sections.push(parent);
  });
  // p0.b → p2.a  and  p0.a → p2.b  (these segments cross)
  suite['p2a'] = entry([{ id: 'p0b', type: 'prerequisite' }]);
  suite['p2b'] = entry([{ id: 'p0a', type: 'prerequisite' }]);
  return deriveTopo(sections, suite);
}

describe('topo-sim-atlas — geometry helpers', () => {
  it('segInt detects a real crossing', () => {
    expect(segInt({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
  });
  it('segInt rejects non-crossing / parallel segments', () => {
    expect(segInt({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 })).toBe(false);
    expect(segInt({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBe(false);
  });
  it('radiusOf is floored and monotonic above the floor', () => {
    expect(radiusOf(0)).toBe(radiusOf(120)); // floor at 120 words
    expect(radiusOf(2000)).toBeGreaterThan(radiusOf(400));
    expect(radiusOf(400)).toBeGreaterThan(radiusOf(120));
  });
  it('canvasFor returns sane minimum extents', () => {
    const c = canvasFor(crossingModel());
    expect(c.w).toBeGreaterThanOrEqual(900);
    expect(c.h).toBeGreaterThanOrEqual(560);
  });
  it('fitNodes returns finite transforms for empty and non-empty inputs', () => {
    const empty = fitNodes([], 1100, 660);
    expect(Number.isFinite(empty.k) && Number.isFinite(empty.x) && Number.isFinite(empty.y)).toBe(true);
    expect(empty.k).toBeGreaterThanOrEqual(0.4);
    expect(empty.k).toBeLessThanOrEqual(2.2);
  });
});

describe('topo-sim-atlas — optimisation improves the layout', () => {
  it('shortens total route length and does not add crossings', () => {
    const model = crossingModel();
    const canvas = canvasFor(model);
    const initial = buildInitial(model, canvas);
    const before = metrics(initial, model.arcs);
    const target = optimizeTarget(initial, model.arcs, canvas);
    const after = metrics(target, model.arcs);

    expect(before.cross).toBeGreaterThanOrEqual(1); // the scenario really does cross
    expect(after.len).toBeLessThan(before.len); // springs shorten routes
    expect(after.cross).toBeLessThanOrEqual(before.cross); // never worse
  });
});

describe('topo-sim-atlas — robustness', () => {
  it('handles a single Part without dividing by zero', () => {
    const child = sec({ id: 'only-b', title: 'b', level: 2, parentId: 'only-a' });
    const model = deriveTopo([sec({ id: 'only-a', title: 'Only', parentId: 'root', children: [child] })], {});
    const canvas = canvasFor(model);
    const nodes = buildInitial(model, canvas);
    expect(nodes).toHaveLength(2);
    nodes.forEach((n) => expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true));
  });

  it('handles an empty document', () => {
    const model = deriveTopo([], {});
    const canvas = canvasFor(model);
    expect(buildInitial(model, canvas)).toHaveLength(0);
    expect(metrics([], model.arcs)).toEqual({ len: 0, cross: 0 });
  });
});
