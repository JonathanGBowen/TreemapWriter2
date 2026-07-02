import { describe, expect, it } from 'vitest';
import { resolvePart, computeDivergences } from '../structural-part-helpers';
import { parseMarkdown } from '../utils';
import { anchorFor } from '../paragraph-helpers';
import type { Section, StructuralPart } from '../../types';

const md = [
  '# A',
  '',
  'Alpha preamble paragraph.',
  '',
  '## A.1',
  '',
  'Body of A one.',
  '',
  '## A.2',
  '',
  'Body of A two.',
  '',
  '# B',
  '',
  'Body of B.',
].join('\n');

const sections = parseMarkdown(md);

/** Find a section id by its heading title (ids are title.slug + index, not stable). */
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

const makePart = (startText: string, endText: string, over?: Partial<StructuralPart>): StructuralPart => ({
  id: 'p',
  kind: 'k',
  claim: 'c',
  startAnchor: anchorFor(startText),
  endAnchor: anchorFor(endText),
  sectionIds: [],
  confidence: 1,
  rationale: '',
  ...over,
});

describe('resolvePart', () => {
  it('maps a part inside one section to that section only (subdivision)', () => {
    const r = resolvePart(makePart('Body of A one.', 'Body of A one.'), md, sections);
    expect(r.orphan).toBe(false);
    expect(r.startOffset).toBeGreaterThanOrEqual(0);
    expect(r.endOffset).toBeGreaterThan(r.startOffset);
    expect(r.sectionIds).toEqual([idOf('A.1')]); // NOT its ancestor A (own-content extents)
  });

  it('maps a part spanning two sections to both, in document order', () => {
    const r = resolvePart(makePart('Body of A one.', 'Body of A two.'), md, sections);
    expect(r.sectionIds).toEqual([idOf('A.1'), idOf('A.2')]);
  });

  it('orphans a part whose anchor cannot be relocated', () => {
    const r = resolvePart(makePart('No such opening text', 'Body of A one.'), md, sections);
    expect(r.orphan).toBe(true);
    expect(r.sectionIds).toEqual([]);
    expect(r.startOffset).toBe(-1);
  });
});

describe('computeDivergences', () => {
  it('flags spansMultiple / subdivides / shared from resolved sectionIds', () => {
    const a1 = idOf('A.1');
    const a2 = idOf('A.2');
    const inner = makePart('Body of A one.', 'Body of A one.', { id: 'inner', sectionIds: [a1] });
    const spanning = makePart('Body of A one.', 'Body of A two.', { id: 'spanning', sectionIds: [a1, a2] });
    const div = computeDivergences([inner, spanning], sections);

    expect(div.inner).toEqual({ spansMultiple: false, subdivides: true, shared: [a1] });
    expect(div.spanning.spansMultiple).toBe(true);
    expect(div.spanning.subdivides).toBe(false);
    expect(div.spanning.shared).toEqual([a1]); // a2 belongs to only one part
  });

  it('treats an orphan (no sectionIds) as neither spanning nor subdividing', () => {
    const orphan = makePart('x', 'y', { id: 'orphan', sectionIds: [] });
    const div = computeDivergences([orphan], sections);
    expect(div.orphan).toEqual({ spansMultiple: false, subdivides: false, shared: [] });
  });

  it('ignores stale section ids not present in the live tree', () => {
    const stale = makePart('x', 'y', { id: 'stale', sectionIds: ['gone-1', 'gone-2'] });
    const div = computeDivergences([stale], sections);
    expect(div.stale).toEqual({ spansMultiple: false, subdivides: false, shared: [] });
  });
});
