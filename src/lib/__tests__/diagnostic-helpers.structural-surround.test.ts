import { describe, expect, it } from 'vitest';
import { buildStructuralSurround, formatStructuralSurround } from '../diagnostic-helpers';
import type { Section, SectionSpec } from '../../types';

// A minimal 2-level tree: one chapter ("c1") with three subsections (a, b, c).
const sub = (id: string, title: string): Section => ({
  id,
  title,
  level: 2,
  content: '',
  fullContent: '',
  startLine: 0,
  endLine: 0,
  startOffset: 0,
  wordCount: 1,
  children: [],
  parentId: 'c1',
});

const sections: Section[] = [
  {
    id: 'c1',
    title: 'Chapter One',
    level: 1,
    content: '',
    fullContent: '',
    startLine: 0,
    endLine: 0,
    startOffset: 0,
    wordCount: 3,
    children: [sub('a', 'Alpha'), sub('b', 'Beta'), sub('c', 'Gamma')],
    parentId: 'root',
  },
];

const spec = (over: Partial<SectionSpec>): SectionSpec => ({
  function: 'argue',
  mainClaim: '',
  requiredMoves: [],
  incomingContext: [],
  outgoingCommitments: [],
  ...over,
});

const specs: Record<string, SectionSpec | undefined> = {
  root: spec({ mainClaim: 'The whole argues X.' }),
  c1: spec({ mainClaim: 'Chapter One establishes the frame.' }),
  a: spec({ outgoingCommitments: ['has defined the key term'] }),
  b: spec({
    incomingContext: ['the key term is defined'],
    outgoingCommitments: ['b-out'],
  }),
  c: spec({ incomingContext: ['needs the lemma from B'] }),
};

describe('buildStructuralSurround', () => {
  it('reads a middle section as a part: parent claim, upstream commitments, downstream needs', () => {
    const s = buildStructuralSurround('b', sections, specs);
    expect(s.documentClaim).toBe('The whole argues X.');
    expect(s.parentTitle).toBe('Chapter One');
    expect(s.parentClaim).toBe('Chapter One establishes the frame.');
    // upstream = preceding sibling (A) outgoing commitments
    expect(s.upstreamCommitments).toEqual(['has defined the key term']);
    // downstream = following sibling (C) incoming context
    expect(s.downstreamNeeds).toEqual(['needs the lemma from B']);
  });

  it('omits upstream for the first sibling and downstream for the last', () => {
    const first = buildStructuralSurround('a', sections, specs);
    expect(first.upstreamCommitments).toBeUndefined();
    expect(first.downstreamNeeds).toEqual(['the key term is defined']); // B's incoming

    const last = buildStructuralSurround('c', sections, specs);
    expect(last.downstreamNeeds).toBeUndefined();
    expect(last.upstreamCommitments).toEqual(['b-out']); // B's outgoing
  });

  it('returns an empty surround for an unknown id', () => {
    expect(buildStructuralSurround('nope', sections, specs)).toEqual({});
  });

  it('carries only role-reconstructions, never raw prose slices', () => {
    const rendered = formatStructuralSurround(buildStructuralSurround('b', sections, specs));
    expect(rendered).toContain('STRUCTURAL SURROUND');
    expect(rendered).toContain('The whole argues X.');
    expect(rendered).toContain('has defined the key term');
    // The section's own prose never appears — fullContent is empty here, and the
    // surround is built purely from neighbours' specs.
    expect(rendered).not.toContain('fullContent');
  });
});

describe('formatStructuralSurround', () => {
  it('renders the empty surround as an empty string', () => {
    expect(formatStructuralSurround({})).toBe('');
  });
});
