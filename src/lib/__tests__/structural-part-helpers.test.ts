import { describe, expect, it } from 'vitest';
import {
  resolvePart,
  computeDivergences,
  computeSurroundHash,
  recomputeHomotypy,
  recomputeStructuralStale,
  reanchoredPart,
  computeLiveDivergences,
  summarizeParts,
} from '../structural-part-helpers';
import { computeHash, parseMarkdown } from '../utils';
import { anchorFor } from '../paragraph-helpers';
import { normalizeForHash } from '../gist-helpers';
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

/**
 * Stamp a part's `sourceHash` exactly as discovery does in
 * `use-structural-parts-actions` (resolvePart → computeHash∘normalizeForHash of the
 * span). Reproducing it here pins the population contract: a part stamped this way
 * must read fresh under `recomputeStructuralStale` on the same source.
 */
const stamp = (part: StructuralPart, source: string, secs: Section[]): StructuralPart => {
  const { startOffset, endOffset, orphan } = resolvePart(part, source, secs);
  return {
    ...part,
    sourceHash: orphan ? undefined : computeHash(normalizeForHash(source.slice(startOffset, endOffset))),
  };
};

describe('recomputeStructuralStale', () => {
  // A part spanning A's preamble through A.2, with interior prose (A.1's body) to edit.
  const freshPart = () =>
    stamp(makePart('Alpha preamble paragraph.', 'Body of A two.', { id: 'p1' }), md, sections);

  it('a freshly-stamped part is neither stale nor orphan', () => {
    expect(recomputeStructuralStale([freshPart()], md, sections)).toEqual({ staleIds: [], orphanIds: [] });
  });

  it('an edit to the span text marks exactly that part stale', () => {
    const edited = md.replace('Body of A one.', 'Body of A one, rewritten.');
    const { staleIds, orphanIds } = recomputeStructuralStale([freshPart()], edited, parseMarkdown(edited));
    expect(staleIds).toEqual(['p1']);
    expect(orphanIds).toEqual([]);
  });

  it('a formatting-only edit does NOT mark the part stale', () => {
    const edited = md.replace('Body of A one.', 'Body of A *one*.');
    expect(recomputeStructuralStale([freshPart()], edited, parseMarkdown(edited)).staleIds).toEqual([]);
  });

  it('a part whose start anchor is gone is orphaned, not stale', () => {
    const edited = md.replace('Alpha preamble paragraph.', 'Zeta preamble paragraph.');
    const { staleIds, orphanIds } = recomputeStructuralStale([freshPart()], edited, parseMarkdown(edited));
    expect(orphanIds).toEqual(['p1']);
    expect(staleIds).toEqual([]);
  });

  it('an authored germ part (no anchors yet) is neither stale nor orphan — content-debt (Phase 2)', () => {
    const germ: StructuralPart = {
      id: 'germ',
      kind: 'claim',
      claim: 'a thought not yet on the page',
      startAnchor: '',
      endAnchor: '',
      sectionIds: [],
      confidence: 1,
      rationale: '',
      origin: 'authored',
      status: 'germ',
    };
    expect(recomputeStructuralStale([germ], md, sections)).toEqual({ staleIds: [], orphanIds: [] });
  });

  it('a part with no stored sourceHash (an older sidecar) resolves but is NOT stale', () => {
    // Backward-compat: pre-staleness discovery never stamped a sourceHash. Such a
    // part has no baseline to diff — it must read as "unknown" (neither stale nor
    // orphan), not be flagged stale forever. `makePart` intentionally omits sourceHash.
    const unstamped = makePart('Alpha preamble paragraph.', 'Body of A two.', { id: 'p1' });
    expect(unstamped.sourceHash).toBeUndefined();
    expect(recomputeStructuralStale([unstamped], md, sections)).toEqual({ staleIds: [], orphanIds: [] });
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

describe('reanchoredPart (Mode 1 repair, no AI)', () => {
  const freshPart = () =>
    stamp(makePart('Alpha preamble paragraph.', 'Body of A two.', { id: 'p1' }), md, sections);

  it('re-stamps a stale part so it reads fresh again', () => {
    const edited = md.replace('Body of A one.', 'Body of A one, rewritten.');
    const editedSections = parseMarkdown(edited);
    const stale = freshPart();
    expect(recomputeStructuralStale([stale], edited, editedSections).staleIds).toEqual(['p1']);
    const fixed = reanchoredPart(stale, edited, editedSections);
    expect(fixed).not.toBeNull();
    if (!fixed) throw new Error('expected a re-anchored part');
    expect(recomputeStructuralStale([fixed], edited, editedSections)).toEqual({ staleIds: [], orphanIds: [] });
  });

  it('returns null for an orphan (nothing to relocate)', () => {
    const edited = md.replace('Alpha preamble paragraph.', 'Zeta preamble paragraph.');
    expect(reanchoredPart(freshPart(), edited, parseMarkdown(edited))).toBeNull();
  });
});

describe('computeLiveDivergences', () => {
  it('re-resolves sectionIds from the live markdown before flagging (stored ids ignored)', () => {
    // stored sectionIds deliberately empty — live resolution must find the spanning span
    const spanning = makePart('Body of A one.', 'Body of A two.', { id: 'spanning', sectionIds: [] });
    const div = computeLiveDivergences([spanning], md, sections);
    expect(div.spanning.spansMultiple).toBe(true);
    expect(div.spanning.subdivides).toBe(false);
  });
});

describe('summarizeParts', () => {
  it('returns an empty string when there are no parts', () => {
    expect(summarizeParts([], sections)).toBe('');
  });

  it('summarizes count, kinds, and the spanning/shared divergences', () => {
    const a1 = idOf('A.1');
    const a2 = idOf('A.2');
    const inner = makePart('Body of A one.', 'Body of A one.', { id: 'inner', kind: 'motivation', sectionIds: [a1] });
    const spanning = makePart('Body of A one.', 'Body of A two.', { id: 'spanning', kind: 'objection', sectionIds: [a1, a2] });
    const s = summarizeParts([inner, spanning], sections);
    expect(s).toContain('2 discovered structural parts');
    expect(s).toContain('motivation');
    expect(s).toContain('objection');
    expect(s).toContain('1 span multiple sections');
    expect(s).toContain('2 shared across sections'); // a1 is claimed by both parts
  });
});

describe('computeSurroundHash / recomputeHomotypy (Phase 6 — the staleness inversion)', () => {
  // A part spanning START..END (with MIDDLE interior prose to edit), surrounded by
  // 'Alpha para.' (before) and 'Beta para.' (after).
  const docA = ['# X', '', 'Alpha para.', '', 'START anchor para.', '', 'MIDDLE interior para.', '', 'END anchor para.', '', 'Beta para.'].join('\n');
  const secsA = parseMarkdown(docA);
  const stampFull = (): StructuralPart => {
    const p = makePart('START anchor para.', 'END anchor para.', { id: 'h' });
    const { startOffset, endOffset } = resolvePart(p, docA, secsA);
    return { ...p, sourceHash: computeHash(normalizeForHash(docA.slice(startOffset, endOffset))), surroundHash: computeSurroundHash(p, docA) };
  };

  it('surroundHash holds when neighbours are unchanged and moves when a neighbour changes', () => {
    const p = stampFull();
    expect(computeSurroundHash(p, docA)).toBe(p.surroundHash); // same surround
    const moved = docA.replace('Alpha para.', 'Gamma para.'); // change the block BEFORE
    expect(computeSurroundHash(p, moved)).not.toBe(p.surroundHash);
  });

  it('flags a part whose OWN text held but whose surround moved', () => {
    const p = stampFull();
    const moved = docA.replace('Alpha para.', 'Gamma para.'); // START..END text unchanged
    expect(recomputeHomotypy([p], moved, parseMarkdown(moved)).homotypyIds).toEqual(['h']);
  });

  it('does NOT flag a part whose own text changed (that is staleness, not homotypy)', () => {
    const p = stampFull();
    const edited = docA.replace('MIDDLE interior para.', 'MIDDLE EDITED para.'); // interior span text changes
    expect(recomputeHomotypy([p], edited, parseMarkdown(edited)).homotypyIds).toEqual([]);
    // and it IS stale via the forward check
    expect(recomputeStructuralStale([p], edited, parseMarkdown(edited)).staleIds).toEqual(['h']);
  });

  it('does NOT flag an orphan (the staleness path owns it) or a part with no stored surroundHash', () => {
    const p = stampFull();
    const orphaned = docA.replace('START anchor para.', 'Different opening entirely.');
    expect(recomputeHomotypy([p], orphaned, parseMarkdown(orphaned)).homotypyIds).toEqual([]);
    const noSurround = { ...stampFull(), surroundHash: undefined };
    const moved = docA.replace('Alpha para.', 'Gamma para.');
    expect(recomputeHomotypy([noSurround], moved, parseMarkdown(moved)).homotypyIds).toEqual([]);
  });

  it('exempts an authored germ part (empty anchors)', () => {
    const germ: StructuralPart = { id: 'g', kind: 'germ', claim: 'c', startAnchor: '', endAnchor: '', sectionIds: [], confidence: 1, rationale: '', origin: 'authored' };
    expect(recomputeHomotypy([germ], docA, secsA).homotypyIds).toEqual([]);
  });

  it('re-anchoring re-stamps surroundHash, clearing the homotypy flag', () => {
    const p = stampFull();
    const moved = docA.replace('Alpha para.', 'Gamma para.');
    const movedSecs = parseMarkdown(moved);
    expect(recomputeHomotypy([p], moved, movedSecs).homotypyIds).toEqual(['h']);
    const re = reanchoredPart(p, moved, movedSecs)!;
    expect(recomputeHomotypy([re], moved, movedSecs).homotypyIds).toEqual([]); // fixed
  });
});
