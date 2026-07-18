import { describe, expect, it } from 'vitest';
import type { Section, TestSuite, TestSuiteEntry } from '../../../../types';
import { deriveTopo, PART_HUES } from '../topo-derive';

// ── fixtures ────────────────────────────────────────────────────────
let idc = 0;
function sec(partial: Partial<Section> & { id: string; title: string }): Section {
  return {
    level: 1,
    content: '',
    fullContent: '',
    startLine: idc,
    endLine: idc,
    startOffset: idc++,
    wordCount: 100,
    children: [],
    parentId: null,
    ...partial,
  };
}
function entry(partial: Partial<TestSuiteEntry>): TestSuiteEntry {
  return { goals: '', status: 'idle', ...partial };
}

// Two top-level Parts: Introduction (with one subsection) + Theory.
function buildTree(): { sections: Section[]; suite: TestSuite } {
  const i1 = sec({ id: 'i1', title: 'Two-World Problem', level: 2, parentId: 'i0', wordCount: 200 });
  const i0 = sec({ id: 'i0', title: 'Introduction', level: 1, parentId: 'root', children: [i1] });
  const g0 = sec({ id: 'g0', title: 'The Theory', level: 1, parentId: 'root', wordCount: 50 });
  const suite: TestSuite = {
    i0: entry({
      status: 'success',
      spec: { function: 'introduce', mainClaim: 'The map integrates three views.', requiredMoves: [], incomingContext: [], outgoingCommitments: [] },
      lastDiagnostic: { moveResults: [], coherenceNotes: ['Clean.'], overallReadiness: 'solid', nextPriority: 'Tighten the intro.' },
    }),
    // i1 depends on g0 (which is failing) → broken
    i1: entry({ status: 'success', dependencies: [{ id: 'g0', type: 'prerequisite' }] }),
    g0: entry({ status: 'fail' }),
  };
  return { sections: [i0, g0], suite };
}

describe('deriveTopo — numbering & lines', () => {
  it('assigns outline § numbers (top-level 0-based, children dotted 1-based)', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    expect(m.stationById['i0'].sym).toBe('§0');
    expect(m.stationById['i1'].sym).toBe('§0.1');
    expect(m.stationById['g0'].sym).toBe('§1');
  });

  it('groups stations into one Line per top-level Part, in document order', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    expect(m.lines).toHaveLength(2);
    expect(m.lines[0].id).toBe('i0');
    expect(m.lines[0].num).toBe('0');
    expect(m.lines[0].stationIds).toEqual(['i0', 'i1']);
    expect(m.lines[1].id).toBe('g0');
    expect(m.lines[1].stationIds).toEqual(['g0']);
  });

  it('resolves partId by climbing parentId to the top-level ancestor', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    expect(m.stationById['i1'].partId).toBe('i0');
  });

  it('assigns deterministic Part hues and never emits cyan', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    expect(m.lines[0].color).toBe(PART_HUES[0]);
    expect(m.lines[1].color).toBe(PART_HUES[1]);
    m.lines.forEach((l) => expect(l.color.toLowerCase()).not.toBe('#00e8f5'));
  });

  it('cycles hues for more than 5 Parts', () => {
    const roots: Section[] = Array.from({ length: 6 }, (_, i) => sec({ id: `p${i}`, title: `Part ${i}`, parentId: 'root' }));
    const m = deriveTopo(roots, {});
    expect(m.lines[5].color).toBe(PART_HUES[0]); // wraps
  });
});

describe('deriveTopo — arcs & health', () => {
  it('builds arcs oriented source(prerequisite) → target(dependent)', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    expect(m.arcs).toHaveLength(1);
    expect(m.arcs[0]).toMatchObject({ source: 'g0', target: 'i1', type: 'prerequisite', id: 'g0->i1' });
  });

  it('marks an arc broken when its source status is fail', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    expect(m.health(m.arcs[0])).toBe('broken');
  });

  it('marks an arc weak when its source status is stale', () => {
    const { sections, suite } = buildTree();
    suite.g0 = entry({ status: 'stale' });
    const m = deriveTopo(sections, suite);
    expect(m.health(m.arcs[0])).toBe('weak');
  });

  it("treats readiness 'draft' as broken health and fog (no 'draft' status exists)", () => {
    const { sections, suite } = buildTree();
    suite.g0 = entry({ status: 'idle', lastDiagnostic: { moveResults: [], coherenceNotes: [], overallReadiness: 'draft', nextPriority: '' } });
    const m = deriveTopo(sections, suite);
    expect(m.health(m.arcs[0])).toBe('broken');
    expect(m.stationById['g0'].fog).toBe(true);
  });

  it('populates the interchange set and inbound/outbound adjacency', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    expect(m.interchange.has('g0')).toBe(true);
    expect(m.interchange.has('i1')).toBe(true);
    expect(m.inbound('i1').map((a) => a.source)).toEqual(['g0']);
    expect(m.outbound('g0').map((a) => a.target)).toEqual(['i1']);
  });

  it('drops dangling dependencies (source no longer exists)', () => {
    const { sections, suite } = buildTree();
    suite.i1 = entry({ dependencies: [{ id: 'ghost', type: 'prerequisite' }, { id: 'g0', type: 'reference' }] });
    const m = deriveTopo(sections, suite);
    expect(m.arcs).toHaveLength(1);
    expect(m.arcs[0].source).toBe('g0');
  });

  it('drops self-dependencies', () => {
    const { sections, suite } = buildTree();
    suite.i1 = entry({ dependencies: [{ id: 'i1', type: 'prerequisite' }] });
    const m = deriveTopo(sections, suite);
    expect(m.arcs).toHaveLength(0);
  });
});

describe('deriveTopo — board & edge cases', () => {
  it('reads board data from spec + lastDiagnostic', () => {
    const { sections, suite } = buildTree();
    const m = deriveTopo(sections, suite);
    const b = m.board('i0');
    expect(b.claim).toBe('The map integrates three views.');
    expect(b.readiness).toBe('solid');
    expect(b.next).toBe('Tighten the intro.');
    expect(b.coherence).toBe('Clean.');
  });

  it('returns nulls for missing testSuite entries', () => {
    const m = deriveTopo([sec({ id: 'x', title: 'Lonely', parentId: 'root' })], {});
    expect(m.stationById['x'].status).toBe('idle');
    expect(m.stationById['x'].fn).toBeNull();
    expect(m.board('x').claim).toBeNull();
  });

  it('handles an empty document without throwing', () => {
    const m = deriveTopo([], {});
    expect(m.stations).toHaveLength(0);
    expect(m.lines).toHaveLength(0);
    expect(m.arcs).toHaveLength(0);
  });
});
