import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../utils';
import { reconcileSectionIds, sectionAnchor, newSectionId } from '../section-ids';
import type { Section, SectionIdBinding } from '../../types';

/** Flatten a tree to `[id, title]` pairs in document order. */
const flat = (nodes: Section[]): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  const walk = (list: Section[]) => list.forEach((n) => { out.push([n.id, n.title]); walk(n.children); });
  walk(nodes);
  return out;
};
const idOf = (nodes: Section[], title: string): string => flat(nodes).find(([, t]) => t === title)![0];

/** Seed a ledger the way first-load does: reconcile a fresh parse against []. */
const seed = (md: string): { sections: Section[]; ledger: SectionIdBinding[] } => {
  const { sections, ledger } = reconcileSectionIds(parseMarkdown(md), []);
  return { sections, ledger };
};

describe('sectionAnchor', () => {
  it('anchors on the body, not the heading line (so it survives a rename)', () => {
    const [s] = parseMarkdown('## Constitutive Luck\n\nThe distinction survives the objection.');
    expect(sectionAnchor(s)).toBe('The distinction survives the objection.');
  });

  it('is empty for a germ heading with no body', () => {
    const [s] = parseMarkdown('## Just A Title\n');
    expect(sectionAnchor(s)).toBe('');
  });
});

describe('newSectionId', () => {
  it('mints an opaque, unique, sec_-prefixed id', () => {
    const taken = new Set<string>();
    const a = newSectionId(taken); taken.add(a);
    const b = newSectionId(taken);
    expect(a).toMatch(/^sec_[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });
});

describe('reconcileSectionIds — Pass 0 (pinned ids, the Phase-6 move)', () => {
  it('force-binds a pinned node, overriding its body anchor', () => {
    const md = '# A\n\nBody of A.\n\n# B\n\nBody of B.';
    const { ledger } = seed(md);
    const parsed = parseMarkdown(md);
    const idA = ledger.find((b) => b.title === 'A')!.id;
    const idB = ledger.find((b) => b.title === 'B')!.id;
    // Pin A→idB and B→idA (a deliberate swap the anchors would otherwise undo).
    const pinned = new Map<Section, string>([[parsed[0], idB], [parsed[1], idA]]);
    const { sections: out } = reconcileSectionIds(parsed, ledger, pinned);
    expect(idOf(out, 'A')).toBe(idB); // pinned wins over the anchor (which gives idA)
    expect(idOf(out, 'B')).toBe(idA);
  });

  it('consumes the pinned id so a later pass cannot also claim it (germ-swap guard)', () => {
    // Two same-title empty-body germ siblings — the nearest-ordinal swap case.
    const md = '## G\n\n## G';
    const { ledger } = seed(md); // two bindings, empty anchors, ordinals 0 & 1
    const firstId = ledger[0].id;
    const parsed = parseMarkdown(md);
    const pinned = new Map<Section, string>([[parsed[1], firstId]]); // pin the 2nd node → 1st's id
    const { sections: out } = reconcileSectionIds(parsed, ledger, pinned);
    const ids = flat(out).map(([id]) => id);
    expect(ids[1]).toBe(firstId); // the pinned node keeps it
    expect(ids[0]).not.toBe(firstId); // the other cannot reuse the consumed id
    expect(new Set(ids).size).toBe(2); // still unique
  });

  it('leaves non-pinned sections to reconcile normally', () => {
    const md = '# A\n\nBody of A.\n\n# B\n\nBody of B.';
    const { ledger } = seed(md);
    const parsed = parseMarkdown(md);
    const idA = ledger.find((b) => b.title === 'A')!.id;
    const pinned = new Map<Section, string>([[parsed[0], idA]]); // pin only A (to itself)
    const { sections: out, changed } = reconcileSectionIds(parsed, ledger, pinned);
    expect(idOf(out, 'A')).toBe(idA);
    expect(idOf(out, 'B')).toBe(ledger.find((b) => b.title === 'B')!.id); // B by anchor, unchanged
    expect(changed).toBe(false);
  });
});

describe('reconcileSectionIds — seeding (the migration freeze)', () => {
  const md = '# Doc\n\nBody.\n\n## Intro\n\nAlpha.\n\n## Method\n\nBeta.';

  it('adopts the current parse ids verbatim (no remap of existing testSuite keys)', () => {
    const tree = parseMarkdown(md);
    const before = flat(tree).map(([id]) => id);
    const { sections, ledger, changed } = reconcileSectionIds(tree, []);
    expect(flat(sections).map(([id]) => id)).toEqual(before); // frozen, unchanged
    expect(changed).toBe(true); // the ledger went from empty → populated
    expect(ledger.map((b) => b.id)).toEqual(before);
    expect(ledger[1]).toMatchObject({ title: 'Intro', level: 2, anchor: 'Alpha.' });
  });

  it('is idempotent on an unchanged document (no churn)', () => {
    const { sections, ledger } = seed(md);
    const again = reconcileSectionIds(parseMarkdown(md), ledger);
    expect(again.changed).toBe(false);
    expect(flat(again.sections)).toEqual(flat(sections));
  });
});

describe('reconcileSectionIds — the fragilities it fixes', () => {
  it('keeps a section id across a RENAME (anchor match, not title match)', () => {
    const md = '## Constitutive Luck\n\nThe distinction survives.\n\n## Method\n\nHow we proceed.';
    const { ledger } = seed(md);
    const original = idOf(parseMarkdown(md), 'Constitutive Luck');

    // Rename the heading; body untouched. A fresh parse mints a NEW generateId id...
    const renamed = md.replace('## Constitutive Luck', '## Moral Luck, Reconsidered');
    const freshParse = parseMarkdown(renamed);
    expect(idOf(freshParse, 'Moral Luck, Reconsidered')).not.toBe(original);

    // ...but reconcile restores the frozen id by body anchor.
    const { sections } = reconcileSectionIds(freshParse, ledger);
    expect(idOf(sections, 'Moral Luck, Reconsidered')).toBe(original);
  });

  it('moves ids WITH content across a REORDER', () => {
    const md = '## Intro\n\nAlpha body.\n\n## Method\n\nBeta body.';
    const { ledger } = seed(md);
    const introId = idOf(parseMarkdown(md), 'Intro');
    const methodId = idOf(parseMarkdown(md), 'Method');

    const reordered = '## Method\n\nBeta body.\n\n## Intro\n\nAlpha body.';
    const { sections } = reconcileSectionIds(parseMarkdown(reordered), ledger);
    expect(idOf(sections, 'Intro')).toBe(introId);   // id followed its body
    expect(idOf(sections, 'Method')).toBe(methodId);
  });

  it('keeps DUPLICATE-TITLED sections distinct and unswapped across a reorder', () => {
    const md = '## Case\n\nThe alpha case.\n\n## Case\n\nThe beta case.';
    const { sections: seeded, ledger } = seed(md);
    const [alphaId, betaId] = flat(seeded).map(([id]) => id);
    expect(alphaId).not.toBe(betaId);

    const reordered = '## Case\n\nThe beta case.\n\n## Case\n\nThe alpha case.';
    const { sections } = reconcileSectionIds(parseMarkdown(reordered), ledger);
    const ids = flat(sections).map(([id]) => id);
    // The beta case is now first but must keep the beta id (bound by body).
    expect(ids[0]).toBe(betaId);
    expect(ids[1]).toBe(alphaId);
  });

  it('mints an opaque id for a genuinely NEW heading (ledger non-empty)', () => {
    const md = '## Intro\n\nAlpha.';
    const { ledger } = seed(md);
    const grown = md + '\n\n## Objections\n\nA fresh worry.';
    const { sections } = reconcileSectionIds(parseMarkdown(grown), ledger);
    expect(idOf(sections, 'Intro')).toBe(idOf(parseMarkdown(md), 'Intro')); // unchanged
    expect(idOf(sections, 'Objections')).toMatch(/^sec_[a-z0-9]+$/);
  });

  it('gives a DUPLICATED identical section a fresh id (never a collision)', () => {
    const md = '## Case\n\nIdentical text.';
    const { ledger } = seed(md);
    const originalId = idOf(parseMarkdown(md), 'Case');
    // Copy-paste the whole section: two identical title+body sections.
    const dupd = md + '\n\n## Case\n\nIdentical text.';
    const { sections } = reconcileSectionIds(parseMarkdown(dupd), ledger);
    const ids = flat(sections).map(([id]) => id);
    expect(new Set(ids).size).toBe(2);      // no duplicate id
    expect(ids).toContain(originalId);      // one keeps the frozen id
    expect(ids.some((id) => /^sec_/.test(id))).toBe(true); // the other is minted
  });
});

describe('reconcileSectionIds — tree integrity', () => {
  it('rewrites parentId links to the new ids; top level stays "root"', () => {
    const md = '# Doc\n\nRoot body.\n\n## Child\n\nChild body.';
    const { sections } = seed(md);
    const doc = sections[0];
    expect(doc.parentId).toBe('root');
    expect(doc.children[0].parentId).toBe(doc.id);
  });
});
