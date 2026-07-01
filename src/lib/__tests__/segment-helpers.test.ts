import { describe, expect, it } from 'vitest';
import {
  applySegmentEdits,
  applyAndReparse,
  resolveEdits,
  stripHeadings,
  hasNoHeadings,
} from '../segment-helpers';
import { anchorFor, segmentParagraphs } from '../paragraph-helpers';
import { parseMarkdown } from '../utils';
import type { SegmentEdit } from '../../types';

const insert = (anchor: string, level: number, title: string): SegmentEdit => ({
  kind: 'insert',
  anchor,
  level,
  title,
  confidence: 1,
  rationale: 'test',
});

/** A flat, heading-less draft: four prose paragraphs, two natural topics. */
const FLAT = [
  'The opening paragraph sets up the problem at hand.',
  '',
  'A second paragraph develops the first idea further.',
  '',
  'Here begins a clearly different topic about method.',
  '',
  'And the method discussion continues in this paragraph.',
].join('\n');

/** A partially-headed draft. */
const HEADED = [
  '# Intro',
  '',
  'Body text of the introduction here.',
  '',
  '## vague',
  '',
  'Some method content goes here in this part.',
].join('\n');

const A_METHOD = anchorFor('Here begins a clearly different topic about method.');
const A_CONT = anchorFor('And the method discussion continues in this paragraph.');

/** Every block stays an exact substring of the source after an edit. */
const assertSubstringFidelity = (source: string) => {
  for (const b of segmentParagraphs(source)) {
    expect(source.slice(b.startOffset, b.endOffset)).toBe(b.text);
  }
};

describe('applySegmentEdits — insert', () => {
  it('inserts a heading at the paragraph boundary, blank-line padded', () => {
    const out = applySegmentEdits(FLAT, [insert(A_METHOD, 2, 'Method')]);
    expect(out).toContain('further.\n\n## Method\n\nHere begins');
    // the surrounding paragraphs are unbroken
    expect(out).toContain('A second paragraph develops the first idea further.');
    expect(out).toContain('Here begins a clearly different topic about method.');
    assertSubstringFidelity(out);
  });

  it('never inserts mid-paragraph (heading line is its own block)', () => {
    const out = applySegmentEdits(FLAT, [insert(A_METHOD, 2, 'Method')]);
    const headingBlocks = segmentParagraphs(out).filter((b) => b.kind === 'heading');
    expect(headingBlocks).toHaveLength(1);
    expect(headingBlocks[0].text.trim()).toBe('## Method');
  });

  it('inserts at the very start with no leading blank', () => {
    const out = applySegmentEdits(FLAT, [insert(anchorFor('The opening paragraph'), 1, 'Opening')]);
    expect(out.startsWith('# Opening\n\nThe opening paragraph')).toBe(true);
  });

  it('reparses into the expected section tree', () => {
    const { sections } = applyAndReparse(FLAT, [insert(A_METHOD, 2, 'Method')]);
    expect(sections.map((s) => s.title)).toContain('Method');
  });

  it('is idempotent — re-applying the same insert is a no-op', () => {
    const edits = [insert(A_METHOD, 2, 'Method')];
    const once = applySegmentEdits(FLAT, edits);
    const twice = applySegmentEdits(once, edits);
    expect(twice).toBe(once);
  });
});

describe('applySegmentEdits — retitle / relevel / merge', () => {
  it('retitle rewrites the existing heading line in place, keeping its level', () => {
    const out = applySegmentEdits(HEADED, [
      { kind: 'retitle', anchor: '## vague', title: 'Method', confidence: 1, rationale: 't' },
    ]);
    expect(out).toContain('## Method');
    expect(out).not.toContain('## vague');
    expect(out).toContain('# Intro'); // untouched
  });

  it('relevel changes the heading depth, keeping its title', () => {
    const out = applySegmentEdits(HEADED, [
      { kind: 'relevel', anchor: '## vague', level: 3, confidence: 1, rationale: 't' },
    ]);
    expect(out).toMatch(/^### vague$/m);
    expect(out).not.toMatch(/^## vague$/m);
  });

  it('merge removes the shard heading; its body rejoins the part above', () => {
    const out = applySegmentEdits(HEADED, [
      { kind: 'merge', anchor: '## vague', confidence: 1, rationale: 't' },
    ]);
    expect(out).not.toContain('## vague');
    expect(out).toContain('Some method content goes here in this part.');
    const { sections } = applyAndReparse(HEADED, [
      { kind: 'merge', anchor: '## vague', confidence: 1, rationale: 't' },
    ]);
    expect(sections.map((s) => s.title)).toEqual(['Intro']);
  });

  it('retitle/relevel/merge are idempotent (the old anchor is gone after)', () => {
    const e: SegmentEdit[] = [{ kind: 'retitle', anchor: '## vague', title: 'Method', confidence: 1, rationale: 't' }];
    const once = applySegmentEdits(HEADED, e);
    expect(applySegmentEdits(once, e)).toBe(once);
  });
});

describe('applySegmentEdits — robustness', () => {
  it('returns the source unchanged for no edits', () => {
    expect(applySegmentEdits(FLAT, [])).toBe(FLAT);
  });

  it('drops orphaned anchors and still applies the others', () => {
    const out = applySegmentEdits(FLAT, [
      insert('this anchor does not exist anywhere', 2, 'Ghost'),
      insert(A_METHOD, 2, 'Method'),
    ]);
    expect(out).not.toContain('Ghost');
    expect(out).toContain('## Method');
  });

  it('applies multiple inserts right-to-left, preserving order and offsets', () => {
    const out = applySegmentEdits(FLAT, [
      insert(A_METHOD, 2, 'Method'),
      insert(A_CONT, 3, 'Details'),
    ]);
    expect(out).toContain('## Method');
    expect(out).toContain('### Details');
    expect(out.indexOf('## Method')).toBeLessThan(out.indexOf('### Details'));
    assertSubstringFidelity(out);
  });

  it('resolveEdits reports orphans as op: null', () => {
    const resolved = resolveEdits(FLAT, [insert('nope nope nope', 2, 'X')]);
    expect(resolved[0].op).toBeNull();
  });
});

describe('stripHeadings / hasNoHeadings', () => {
  it('stripHeadings removes every heading line, keeping prose', () => {
    const stripped = stripHeadings(HEADED);
    expect(stripped).not.toMatch(/^#/m);
    expect(stripped).toContain('Body text of the introduction here.');
    expect(stripped).toContain('Some method content goes here in this part.');
  });

  it('hasNoHeadings is true for a flat draft, false once a heading exists', () => {
    expect(hasNoHeadings(parseMarkdown(FLAT))).toBe(true);
    expect(hasNoHeadings(parseMarkdown(HEADED))).toBe(false);
  });
});
