import { describe, expect, it } from 'vitest';
import {
  applyPositions,
  deletePartFrom,
  makeGermPart,
  moveIn,
  patchIn,
  positionSnapshot,
  seedPositions,
} from '../canvas-helpers';
import type { Realization, StructuralEdge, StructuralPart } from '../../../types';

const part = (id: string, over?: Partial<StructuralPart>): StructuralPart => ({
  id,
  kind: 'k',
  claim: `claim ${id}`,
  startAnchor: '',
  endAnchor: '',
  sectionIds: [],
  confidence: 1,
  rationale: '',
  ...over,
});

const edge = (id: string, from: string, to: string): StructuralEdge => ({
  id,
  kind: 'grounds',
  fromPartId: from,
  toPartId: to,
  origin: 'authored',
  status: 'accepted',
});

const realization = (id: string, partId: string): Realization => ({
  id,
  partId,
  sectionId: `s-${id}`,
  origin: 'seeded',
});

describe('canvas-helpers', () => {
  describe('makeGermPart', () => {
    it('mints an authored germ at a position with a fresh id', () => {
      const p = makeGermPart('  hello  ', { x: 10, y: 20 }, new Set(['a', 'b']));
      expect(p.claim).toBe('hello');
      expect(p.kind).toBe('germ');
      expect(p.origin).toBe('authored');
      expect(p.status).toBe('germ');
      expect(p.startAnchor).toBe('');
      expect(p.endAnchor).toBe('');
      expect(p.sectionIds).toEqual([]);
      expect(p.position).toEqual({ x: 10, y: 20 });
      expect(['a', 'b']).not.toContain(p.id);
    });

    it('falls back to "untitled" for an empty claim', () => {
      const p = makeGermPart('   ', { x: 0, y: 0 }, new Set());
      expect(p.claim).toBe('untitled');
    });
  });

  it('moveIn repositions only the target part', () => {
    const parts = [part('a', { position: { x: 0, y: 0 } }), part('b', { position: { x: 5, y: 5 } })];
    const next = moveIn(parts, 'a', { x: 99, y: 88 });
    expect(next.find((p) => p.id === 'a')!.position).toEqual({ x: 99, y: 88 });
    expect(next.find((p) => p.id === 'b')!.position).toEqual({ x: 5, y: 5 });
  });

  it('patchIn patches only the target part', () => {
    const parts = [part('a'), part('b')];
    const next = patchIn(parts, 'a', { status: 'apprehended', body: 'quarry' });
    expect(next.find((p) => p.id === 'a')).toMatchObject({ status: 'apprehended', body: 'quarry' });
    expect(next.find((p) => p.id === 'b')!.status).toBeUndefined();
  });

  it('applyPositions applies a bulk map, leaving unlisted parts alone', () => {
    const parts = [part('a', { position: { x: 1, y: 1 } }), part('b'), part('c')];
    const next = applyPositions(parts, { a: { x: 10, y: 10 }, c: { x: 30, y: 30 } });
    expect(next.find((p) => p.id === 'a')!.position).toEqual({ x: 10, y: 10 });
    expect(next.find((p) => p.id === 'b')!.position).toBeUndefined();
    expect(next.find((p) => p.id === 'c')!.position).toEqual({ x: 30, y: 30 });
  });

  describe('deletePartFrom', () => {
    it('cascades to incident edges and realizations', () => {
      const parts = [part('a'), part('b'), part('c')];
      const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'a')];
      const realizations = [realization('r1', 'a'), realization('r2', 'b')];
      const r = deletePartFrom(parts, edges, realizations, 'a');
      expect(r.parts.map((p) => p.id)).toEqual(['b', 'c']);
      // e1 (a→b) and e3 (c→a) both touch a; only e2 survives.
      expect(r.edges.map((e) => e.id)).toEqual(['e2']);
      expect(r.realizations.map((x) => x.id)).toEqual(['r2']);
    });
  });

  describe('seedPositions', () => {
    it('grids never-placed parts and never moves a placed one', () => {
      const placed = { x: 500, y: 500 };
      const parts = [part('a', { position: placed }), part('b'), part('c')];
      const { parts: next, changed } = seedPositions(parts);
      expect(changed).toBe(true);
      // placed part kept EXACTLY (spatial memory is sacred).
      expect(next.find((p) => p.id === 'a')!.position).toBe(placed);
      expect(next.find((p) => p.id === 'b')!.position).toBeDefined();
      expect(next.find((p) => p.id === 'c')!.position).toBeDefined();
      // the two seeded nodes land at distinct grid cells.
      const bp = next.find((p) => p.id === 'b')!.position!;
      const cp = next.find((p) => p.id === 'c')!.position!;
      expect(bp).not.toEqual(cp);
    });

    it('is a no-op (changed=false) when every part is already placed', () => {
      const parts = [part('a', { position: { x: 0, y: 0 } }), part('b', { position: { x: 1, y: 1 } })];
      const { parts: next, changed } = seedPositions(parts);
      expect(changed).toBe(false);
      expect(next).toBe(parts);
    });
  });

  it('positionSnapshot captures only placed parts', () => {
    const parts = [part('a', { position: { x: 3, y: 4 } }), part('b'), part('c', { position: { x: 7, y: 8 } })];
    expect(positionSnapshot(parts)).toEqual({ a: { x: 3, y: 4 }, c: { x: 7, y: 8 } });
  });
});
