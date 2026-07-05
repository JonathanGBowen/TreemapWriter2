import { describe, expect, it } from 'vitest';
import { applyMove, type MoveSpec } from '../segment-helpers';
import { sectionAnchor } from '../section-ids';
import { parseMarkdown } from '../utils';
import { segmentParagraphs } from '../paragraph-helpers';
import type { Section } from '../../types';

// --- fixtures + helpers ----------------------------------------------------

const flattenSecs = (secs: Section[]): Section[] => {
  const out: Section[] = [];
  const walk = (ns: Section[]) => ns.forEach((n) => { out.push(n); walk(n.children); });
  walk(secs);
  return out;
};

/** Build a MoveSpec addressing sections by title (the store action does this by id). */
const specFor = (source: string, srcTitle: string, destTitle: string, position: 'before' | 'after'): MoveSpec => {
  const flat = flattenSecs(parseMarkdown(source));
  const src = flat.find((n) => n.title === srcTitle)!;
  const dst = flat.find((n) => n.title === destTitle)!;
  return {
    sourceHeadingAnchor: `${'#'.repeat(src.level)} ${src.title}`,
    sourceBodyAnchor: sectionAnchor(src),
    sourceOrdinal: flat.indexOf(src),
    destHeadingAnchor: `${'#'.repeat(dst.level)} ${dst.title}`,
    destBodyAnchor: sectionAnchor(dst),
    destOrdinal: flat.indexOf(dst),
    position,
  };
};

/** Every parsed block stays an exact substring of the source (byte-fidelity). */
const assertSubstringFidelity = (source: string) => {
  for (const b of segmentParagraphs(source)) expect(source.slice(b.startOffset, b.endOffset)).toBe(b.text);
};

const topTitles = (source: string): string[] => parseMarkdown(source).map((s) => s.title);

const D1 = ['# Alpha', '', 'Alpha body paragraph one.', '', '# Beta', '', 'Beta body paragraph one.', '', '# Gamma', '', 'Gamma body paragraph one.'].join('\n');

// --- tests -----------------------------------------------------------------

describe('applyMove', () => {
  it('reorders a top-level section (Alpha → after Gamma)', () => {
    const out = applyMove(D1, specFor(D1, 'Alpha', 'Gamma', 'after'));
    expect(topTitles(out)).toEqual(['Beta', 'Gamma', 'Alpha']);
    assertSubstringFidelity(out);
  });

  it('is byte-stable: move-then-move-back equals the canonical original', () => {
    const moved = applyMove(D1, specFor(D1, 'Alpha', 'Gamma', 'after')); // [Beta, Gamma, Alpha]
    const back = applyMove(moved, specFor(moved, 'Alpha', 'Beta', 'before')); // [Alpha, Beta, Gamma]
    expect(back).toBe(D1);
  });

  it('preserves CRLF line endings on content lines and reparses correctly', () => {
    const crlf = D1.replace(/\n/g, '\r\n');
    const out = applyMove(crlf, specFor(crlf, 'Alpha', 'Gamma', 'after'));
    // Content lines that had a CR keep it (like the existing insert/split appliers,
    // the seam-blank the move inserts is a lone LF — harmless; parseMarkdown splits on \n).
    // The applier never fabricates a CR (the source's last line had none).
    expect(out).toContain('# Alpha\r');
    expect(out).toContain('# Beta\r');
    expect(topTitles(out.replace(/\r/g, ''))).toEqual(['Beta', 'Gamma', 'Alpha']);
    assertSubstringFidelity(out);
  });

  it('moves a whole subtree (heading + body + descendants) together', () => {
    const doc = ['# One', '', 'One body.', '', '# Two', '', 'Two body.', '', '## Two-A', '', 'Two-A body.', '', '# Three', '', 'Three body.'].join('\n');
    const out = applyMove(doc, specFor(doc, 'Two', 'Three', 'after'));
    expect(topTitles(out)).toEqual(['One', 'Three', 'Two']);
    // Two-A is still nested under Two in its new home.
    const two = parseMarkdown(out).find((s) => s.title === 'Two')!;
    expect(two.children.map((c) => c.title)).toEqual(['Two-A']);
    assertSubstringFidelity(out);
  });

  it('moves to the very start (before the first section) with no leading blank', () => {
    const out = applyMove(D1, specFor(D1, 'Gamma', 'Alpha', 'before'));
    expect(topTitles(out)).toEqual(['Gamma', 'Alpha', 'Beta']);
    expect(out.startsWith('# Gamma')).toBe(true);
  });

  it('moves to the very end with no trailing blank pileup', () => {
    const out = applyMove(D1, specFor(D1, 'Alpha', 'Gamma', 'after'));
    expect(out.endsWith('Alpha body paragraph one.')).toBe(true);
    expect(out.includes('\n\n\n')).toBe(false);
  });

  it('is a no-op when dropping into the current slot', () => {
    expect(applyMove(D1, specFor(D1, 'Alpha', 'Beta', 'before'))).toBe(D1); // Alpha is already before Beta
    expect(applyMove(D1, specFor(D1, 'Gamma', 'Beta', 'after'))).toBe(D1); // Gamma is already after Beta
  });

  it('refuses to move a section into its own subtree (returns source)', () => {
    const doc = ['# Parent', '', 'Parent body.', '', '## Child', '', 'Child body.'].join('\n');
    // Move Parent to after Child (Child is inside Parent) → self-nest → no-op.
    expect(applyMove(doc, specFor(doc, 'Parent', 'Child', 'after'))).toBe(doc);
  });

  it('is a no-op on an orphaned anchor', () => {
    const spec: MoveSpec = { sourceHeadingAnchor: '# Nonexistent', destHeadingAnchor: '# Beta', position: 'before' };
    expect(applyMove(D1, spec)).toBe(D1);
  });

  it('disambiguates duplicate headings by body anchor', () => {
    const doc = ['# Dup', '', 'First dup body about apples.', '', '# Keep', '', 'Keep body.', '', '# Dup', '', 'Second dup body about oranges.'].join('\n');
    const flat = flattenSecs(parseMarkdown(doc));
    const second = flat.filter((s) => s.title === 'Dup')[1];
    const keep = flat.find((s) => s.title === 'Keep')!;
    const spec: MoveSpec = {
      sourceHeadingAnchor: '# Dup',
      sourceBodyAnchor: sectionAnchor(second), // "Second dup body about oranges."
      sourceOrdinal: flat.indexOf(second),
      destHeadingAnchor: '# Keep',
      destBodyAnchor: sectionAnchor(keep),
      destOrdinal: flat.indexOf(keep),
      position: 'before',
    };
    const out = applyMove(doc, spec);
    // The SECOND Dup (oranges) moved up before Keep; the first (apples) stayed.
    expect(out).toContain('oranges.\n\n# Keep');
    expect(out.indexOf('apples')).toBeLessThan(out.indexOf('# Keep'));
    assertSubstringFidelity(out);
  });

  it('keeps blank-line hygiene at both seams (no triple newline)', () => {
    const out = applyMove(D1, specFor(D1, 'Beta', 'Alpha', 'before')); // [Beta, Alpha, Gamma]
    expect(out.includes('\n\n\n')).toBe(false);
    expect(topTitles(out)).toEqual(['Beta', 'Alpha', 'Gamma']);
    assertSubstringFidelity(out);
  });

  it('a reparent (## before a #) yields a valid tree', () => {
    const doc = ['# One', '', 'One body.', '', '# Two', '', 'Two body.', '', '## Two-A', '', 'Two-A body.'].join('\n');
    // Move Two-A (a ## under Two) before One → it becomes a leading block.
    const out = applyMove(doc, specFor(doc, 'Two-A', 'One', 'before'));
    const tree = parseMarkdown(out);
    // parseMarkdown always yields a valid tree; Two-A now leads and One/Two follow.
    expect(tree.map((s) => s.title)).toEqual(['Two-A', 'One', 'Two']);
    assertSubstringFidelity(out);
  });

  it('moves a germ (empty-body) heading', () => {
    const doc = ['# Real', '', 'Real body.', '', '# Germ', '', '# Tail', '', 'Tail body.'].join('\n');
    const out = applyMove(doc, specFor(doc, 'Germ', 'Real', 'before'));
    expect(topTitles(out)).toEqual(['Germ', 'Real', 'Tail']);
    expect(out.includes('\n\n\n')).toBe(false);
    assertSubstringFidelity(out);
  });
});

// The document's outermost blank runs (leading blanks + the trailing final newline)
// are NOT touched seams, so a move must preserve them verbatim — otherwise every move
// produces a spurious 1-byte EOF diff and a genuine no-op drop is misread as a change.
describe('applyMove — document-end byte fidelity', () => {
  // POSIX convention: the file ends with a newline (a trailing empty split element).
  const NL = ['# A', '', 'A body.', '', '# B', '', 'B body.', '', '# C', '', 'C body.', ''].join('\n');

  it('preserves the trailing final newline (exactly one)', () => {
    const out = applyMove(NL, specFor(NL, 'A', 'C', 'after'));
    expect(topTitles(out)).toEqual(['B', 'C', 'A']);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('preserves the trailing newline even when the LAST section is the mover', () => {
    // C's own subtree carries the doc's trailing blank; moving C must not eat the EOF.
    const out = applyMove(NL, specFor(NL, 'C', 'A', 'before'));
    expect(topTitles(out)).toEqual(['C', 'A', 'B']);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('is byte-stable on a newline-terminated doc: move-then-move-back === original', () => {
    const moved = applyMove(NL, specFor(NL, 'A', 'C', 'after')); // [B, C, A]
    const back = applyMove(moved, specFor(moved, 'A', 'B', 'before')); // [A, B, C]
    expect(back).toBe(NL);
  });

  it('reproduces source exactly for an already-in-place drop (the no-op fast-path)', () => {
    // B already directly follows A; dropping B "after A" on a canonical doc changes nothing.
    // This is NOT caught by the internal slot guards (the seam trims to insertBefore<mStart),
    // so it exercises the reconstruction path — which must still return byte-identical source.
    expect(applyMove(NL, specFor(NL, 'B', 'A', 'after'))).toBe(NL);
  });

  it('preserves leading blank lines at the top of the document', () => {
    const doc = ['', '', '# A', '', 'A body.', '', '# B', '', 'B body.', '', '# C', '', 'C body.'].join('\n');
    // Move C before B — nowhere near the top; the doc-top blank run must survive.
    const out = applyMove(doc, specFor(doc, 'C', 'B', 'before'));
    expect(out.startsWith('\n\n# A')).toBe(true);
    expect(topTitles(out)).toEqual(['A', 'C', 'B']);
    assertSubstringFidelity(out);
  });
});
