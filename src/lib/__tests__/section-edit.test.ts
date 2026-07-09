import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../utils';
import {
  flattenSections,
  sectionRangeInDoc,
  replaceSectionContent,
  findInRange,
  findInRangeInsensitive,
} from '../section-edit';

// A corpus exercising the boundary cases the write-back math has historically
// broken on: childless final/middle sections, nested children, blank-line
// edges, only-a-heading sections, and a doc with no trailing newline.
const CORPUS: Record<string, string> = {
  simple: '# A\nbody1\nbody2\n# B\nbody3',
  'leaf-final': '# A\nalpha\n## A1\nchild prose\nlast line of the doc',
  'blank-separated': '# A\nalpha\n\n# B\nbeta\n\n# C\ngamma',
  'leading-blank': '\n# First\nprose after a blank first line\n# Second\nmore',
  'heading-only': '# Solo\n# Next\ntext',
  nested: [
    '# Chapter',
    'chapter intro',
    '',
    '## Section One',
    'one prose',
    '### Deep',
    'deep prose',
    '## Section Two',
    'two prose',
    '',
  ].join('\n'),
  'trailing-blank-section': '# A\nprose\n\n\n# B\nend',
};

const allDocs = Object.entries(CORPUS);

describe('sectionRangeInDoc', () => {
  it('slices byte-identically to parseMarkdown fullContent for every section of every doc', () => {
    for (const [name, doc] of allDocs) {
      for (const sec of flattenSections(parseMarkdown(doc))) {
        const range = sectionRangeInDoc(doc, sec.id);
        expect(range, `${name}/${sec.id}`).not.toBeNull();
        expect(doc.slice(range!.from, range!.to), `${name}/${sec.id}`).toBe(sec.fullContent);
      }
    }
  });

  it("resolves 'root' to the whole document", () => {
    const doc = CORPUS.simple;
    expect(sectionRangeInDoc(doc, 'root')).toEqual({
      from: 0,
      to: doc.length,
      startLine: 0,
      endLine: doc.split('\n').length - 1,
    });
  });

  it('returns null for an unknown id', () => {
    expect(sectionRangeInDoc(CORPUS.simple, 'no-such-section-9')).toBeNull();
  });

  it('resolves a store id across line shifts when oldSections are threaded', () => {
    // Derived ids embed the heading's line index; inserting lines above a
    // section makes a fresh no-context parse mint a DIFFERENT id. Threading
    // the store's sections keeps the id chain (reuse-by-title) intact.
    const doc = CORPUS.simple;
    const storeSections = parseMarkdown(doc);
    const b = flattenSections(storeSections).find((s) => s.title === 'B')!;
    const shifted = `intro line one\nintro line two\n${doc}`;
    expect(sectionRangeInDoc(shifted, b.id)).toBeNull(); // no context: id drifted
    const range = sectionRangeInDoc(shifted, b.id, storeSections)!;
    expect(range).not.toBeNull();
    expect(shifted.slice(range.from, range.to)).toBe(b.fullContent);
  });
});

describe('replaceSectionContent', () => {
  it('is the identity when a section saves its own content back (round-trip)', () => {
    // The regression that failed pre-fix: a childless section's save resumed at
    // endLine instead of endLine+1, duplicating its last line on every save.
    for (const [name, doc] of allDocs) {
      for (const sec of flattenSections(parseMarkdown(doc))) {
        expect(replaceSectionContent(doc, sec.id, sec.content), `${name}/${sec.id}`).toBe(doc);
      }
    }
  });

  it('leaves every byte outside the section untouched when content grows', () => {
    for (const [name, doc] of allDocs) {
      for (const sec of flattenSections(parseMarkdown(doc))) {
        const next = replaceSectionContent(doc, sec.id, `${sec.content}\nX-marker`);
        expect(next, `${name}/${sec.id}`).not.toBeNull();
        const lines = doc.split('\n');
        const resumeAt = sec.children.length > 0 ? sec.children[0].startLine : sec.endLine + 1;
        const prefix = lines.slice(0, sec.startLine).join('\n');
        const suffix = lines.slice(resumeAt).join('\n');
        expect(next!.startsWith(prefix), `${name}/${sec.id} prefix`).toBe(true);
        expect(next!.endsWith(suffix), `${name}/${sec.id} suffix`).toBe(true);
        expect(next).toContain('X-marker');
      }
    }
  });

  it('does not duplicate the last line of a final leaf section (the sprint-save bug)', () => {
    const doc = '# A\nbody\n# B\nfinal line';
    const sections = flattenSections(parseMarkdown(doc));
    const b = sections.find((s) => s.title === 'B')!;
    const next = replaceSectionContent(doc, b.id, '# B\nfinal line edited');
    expect(next).toBe('# A\nbody\n# B\nfinal line edited');
  });

  it('preserves children when replacing only the own-content of a parent', () => {
    const doc = CORPUS.nested;
    const chapter = parseMarkdown(doc)[0];
    const next = replaceSectionContent(doc, chapter.id, '# Chapter\nrewritten intro\n');
    expect(next).toContain('## Section One');
    expect(next).toContain('### Deep');
    expect(next).toContain('rewritten intro');
    expect(next).not.toContain('chapter intro');
  });

  it('returns null for an unknown section', () => {
    expect(replaceSectionContent(CORPUS.simple, 'missing-3', 'x')).toBeNull();
  });
});

describe('findInRange', () => {
  const doc = '# A\nshared phrase here\n# B\nshared phrase here too';
  const sections = flattenSections(parseMarkdown(doc));

  it('finds a needle only within the given range', () => {
    const b = sections.find((s) => s.title === 'B')!;
    const range = sectionRangeInDoc(doc, b.id)!;
    const at = findInRange(doc, 'shared phrase', range);
    expect(at).toBeGreaterThanOrEqual(range.from);
    expect(doc.slice(at, at + 'shared phrase'.length)).toBe('shared phrase');
    // The earlier occurrence (section A) must NOT be chosen.
    expect(at).not.toBe(doc.indexOf('shared phrase'));
  });

  it('rejects a needle that straddles the range end', () => {
    const a = sections.find((s) => s.title === 'A')!;
    const range = sectionRangeInDoc(doc, a.id)!;
    // 'here\n# B' starts inside section A but ends beyond it.
    expect(findInRange(doc, 'here\n# B', range)).toBe(-1);
  });

  it('returns -1 for an empty needle or an absent needle', () => {
    const a = sections.find((s) => s.title === 'A')!;
    const range = sectionRangeInDoc(doc, a.id)!;
    expect(findInRange(doc, '', range)).toBe(-1);
    expect(findInRange(doc, 'nowhere-to-be-found', range)).toBe(-1);
  });
});

describe('findInRangeInsensitive', () => {
  const doc = '# One\nThe Traveler fares forth.\n# Two\nAnother TRAVELER appears.';
  const sections = flattenSections(parseMarkdown(doc));

  it('matches case-insensitively within the range only', () => {
    const two = sections.find((s) => s.title === 'Two')!;
    const range = sectionRangeInDoc(doc, two.id)!;
    const at = findInRangeInsensitive(doc, 'traveler', range);
    expect(at).toBe(doc.indexOf('TRAVELER'));
  });

  it('returns -1 when the phrase only occurs outside the range', () => {
    const two = sections.find((s) => s.title === 'Two')!;
    const range = sectionRangeInDoc(doc, two.id)!;
    expect(findInRangeInsensitive(doc, 'fares forth', range)).toBe(-1);
  });

  it('trims and rejects blank needles', () => {
    const one = sections.find((s) => s.title === 'One')!;
    const range = sectionRangeInDoc(doc, one.id)!;
    expect(findInRangeInsensitive(doc, '   ', range)).toBe(-1);
  });
});
