import { describe, expect, it } from 'vitest';
import {
  acceptEdge,
  computeCenterDivergence,
  edgeArrow,
  edgeId,
  isDirected,
  mergeDiscoveredEdges,
  seedRealizations,
  summarizeGraph,
  tagRealization,
} from '../structural-graph-helpers';
import { parseMarkdown } from '../utils';
import type { Centering } from '../../features/modals/topo/topo-centering';
import type { Realization, Section, StructuralEdge, StructuralPart } from '../../types';

const md = ['# A', '', 'Body of A.', '', '# B', '', 'Body of B.', '', '# C', '', 'Body of C.'].join('\n');
const sections = parseMarkdown(md);

const idOf = (title: string): string => {
  let found = '';
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      if (n.title === title) found = n.id;
      walk(n.children);
    }
  };
  walk(sections);
  if (!found) throw new Error(`no section titled ${title}`);
  return found;
};

const part = (id: string, sectionIds: string[], over?: Partial<StructuralPart>): StructuralPart => ({
  id,
  kind: 'k',
  claim: `claim ${id}`,
  startAnchor: 'x',
  endAnchor: 'x',
  sectionIds,
  confidence: 1,
  rationale: '',
  ...over,
});

const centering = (radix: string[]): Centering => ({
  byId: {},
  maxRank: 0,
  radix,
  telos: [],
  cycles: [],
  backwardArcs: new Set(),
  backwardCount: 0,
  miscentering: 0,
});

// --- isDirected / edgeArrow / edgeId ---------------------------------------

describe('isDirected / edgeArrow', () => {
  it('marks requires/opposes symmetric and the rest directed', () => {
    expect(isDirected('requires')).toBe(false);
    expect(isDirected('opposes')).toBe(false);
    expect(isDirected('grounds')).toBe(true);
    expect(isDirected('answers')).toBe(true);
    expect(edgeArrow('requires')).toBe('↔');
    expect(edgeArrow('grounds')).toBe('→');
  });
});

describe('edgeId', () => {
  it('collides for a symmetric edge regardless of endpoint order', () => {
    expect(edgeId('requires', 'a', 'b')).toBe(edgeId('requires', 'b', 'a'));
  });
  it('distinguishes the two directions of a directed edge', () => {
    expect(edgeId('grounds', 'a', 'b')).not.toBe(edgeId('grounds', 'b', 'a'));
  });
  it('distinguishes edges of different kind over the same endpoints', () => {
    expect(edgeId('grounds', 'a', 'b')).not.toBe(edgeId('qualifies', 'a', 'b'));
  });
});

// --- mergeDiscoveredEdges / acceptEdge -------------------------------------

const proposed = (kind: StructuralEdge['kind'], from: string, to: string): StructuralEdge => ({
  id: edgeId(kind, from, to),
  kind,
  fromPartId: from,
  toPartId: to,
  origin: 'discovered',
  status: 'proposed',
});

describe('mergeDiscoveredEdges', () => {
  it('lands a genuinely new proposal as discovered/proposed', () => {
    const merged = mergeDiscoveredEdges([], [proposed('grounds', 'a', 'b')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].origin).toBe('discovered');
    expect(merged[0].status).toBe('proposed');
  });

  it('keeps an existing authored edge untouched when a duplicate is proposed', () => {
    const authored: StructuralEdge = {
      id: edgeId('grounds', 'a', 'b'),
      kind: 'grounds',
      fromPartId: 'a',
      toPartId: 'b',
      origin: 'authored',
      status: 'accepted',
      note: 'mine',
    };
    const merged = mergeDiscoveredEdges([authored], [proposed('grounds', 'a', 'b')]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(authored); // not downgraded to proposed, note preserved
  });

  it('dedups within a proposal batch and across an accepted edge', () => {
    const accepted = { ...proposed('grounds', 'a', 'b'), status: 'accepted' as const };
    const merged = mergeDiscoveredEdges(
      [accepted],
      [proposed('grounds', 'a', 'b'), proposed('requires', 'b', 'c')],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.id === accepted.id)?.status).toBe('accepted');
  });

  it('acceptEdge flips only the targeted proposal to accepted', () => {
    const edges = mergeDiscoveredEdges([], [proposed('grounds', 'a', 'b'), proposed('requires', 'b', 'c')]);
    const after = acceptEdge(edges, edgeId('grounds', 'a', 'b'));
    expect(after.find((e) => e.id === edgeId('grounds', 'a', 'b'))?.status).toBe('accepted');
    expect(after.find((e) => e.id === edgeId('requires', 'b', 'c'))?.status).toBe('proposed');
  });
});

// --- seedRealizations / tagRealization -------------------------------------

describe('seedRealizations', () => {
  it('seeds one untagged realization per live (part, section) overlap', () => {
    const parts = [part('p1', [idOf('A'), idOf('B')]), part('p2', [idOf('B')])];
    const r = seedRealizations(parts, sections, []);
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.functionTag === undefined)).toBe(true);
    expect(r.every((x) => x.origin === 'seeded')).toBe(true);
  });

  it('is idempotent (re-seeding the same inputs yields identical ids)', () => {
    const parts = [part('p1', [idOf('A')])];
    const first = seedRealizations(parts, sections, []);
    const second = seedRealizations(parts, sections, first);
    expect(second.map((x) => x.id)).toEqual(first.map((x) => x.id));
  });

  it('preserves an existing tag/note by (partId, sectionId) key', () => {
    const parts = [part('p1', [idOf('A')])];
    const seeded = seedRealizations(parts, sections, []);
    const tagged = tagRealization(seeded, seeded[0].id, 'develop');
    const reseeded = seedRealizations(parts, sections, tagged);
    expect(reseeded[0].functionTag).toBe('develop');
    expect(reseeded[0].origin).toBe('authored');
  });

  it('drops a realization when its overlap vanishes', () => {
    const before = seedRealizations([part('p1', [idOf('A'), idOf('B')])], sections, []);
    expect(before).toHaveLength(2);
    const after = seedRealizations([part('p1', [idOf('A')])], sections, before);
    expect(after).toHaveLength(1);
    expect(after[0].sectionId).toBe(idOf('A'));
  });

  it('ignores dead section ids and de-duplicates a repeated section', () => {
    const parts = [part('p1', ['ghost', idOf('A'), idOf('A')])];
    const r = seedRealizations(parts, sections, []);
    expect(r).toHaveLength(1);
    expect(r[0].sectionId).toBe(idOf('A'));
  });
});

// --- computeCenterDivergence -----------------------------------------------

describe('computeCenterDivergence', () => {
  it('does not diverge when there is no declared center', () => {
    const d = computeCenterDivergence([part('p1', [idOf('A')])], centering([idOf('A')]));
    expect(d.diverges).toBe(false);
    expect(d.declaredIds).toEqual([]);
  });

  it('does not diverge when the declared center sits on the computed radix', () => {
    const parts = [part('p1', [idOf('A')], { declaredCenter: true })];
    const d = computeCenterDivergence(parts, centering([idOf('A')]));
    expect(d.diverges).toBe(false);
    expect(d.divergentIds).toEqual([]);
  });

  it('diverges when the declared center is realized off the computed radix', () => {
    const parts = [part('p1', [idOf('C')], { declaredCenter: true })];
    const d = computeCenterDivergence(parts, centering([idOf('A')]));
    expect(d.diverges).toBe(true);
    expect(d.divergentIds).toEqual(['p1']);
  });

  it('does not diverge when the computed radix is empty', () => {
    const parts = [part('p1', [idOf('C')], { declaredCenter: true })];
    const d = computeCenterDivergence(parts, centering([]));
    expect(d.diverges).toBe(false);
  });
});

// --- summarizeGraph --------------------------------------------------------

describe('summarizeGraph', () => {
  it('is empty when there are no edges and no tagged realizations', () => {
    const seeded = seedRealizations([part('p1', [idOf('A')])], sections, []);
    expect(summarizeGraph([], [], seeded)).toBe('');
  });

  it('names the edges and the tagged-realization count', () => {
    const edges = [proposed('grounds', 'a', 'b'), proposed('requires', 'b', 'c')];
    const seeded = seedRealizations([part('a', [idOf('A')])], sections, []);
    const tagged = tagRealization(seeded, seeded[0].id, 'introduce');
    const s = summarizeGraph([], edges, tagged);
    expect(s).toContain('2 part-to-part edges');
    expect(s).toContain('grounds');
    expect(s).toContain('1 function-tagged realization');
  });
});
