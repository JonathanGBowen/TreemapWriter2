import { describe, expect, it } from 'vitest';
import { parseMarkdown, generateId, computeHash } from '../utils';

describe('parseMarkdown', () => {
  it('extracts top-level sections from headings', () => {
    const md = [
      '# Introduction',
      'Some prose.',
      '',
      '# Method',
      'More prose here.',
    ].join('\n');

    const sections = parseMarkdown(md);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Introduction');
    expect(sections[0].level).toBe(1);
    expect(sections[1].title).toBe('Method');
    expect(sections[1].level).toBe(1);
  });

  it('nests subsections under their parents', () => {
    const md = [
      '# Chapter One',
      'Intro paragraph.',
      '',
      '## Section A',
      'Body of A.',
      '',
      '## Section B',
      'Body of B.',
      '',
      '### Subsection B.1',
      'Body of B.1.',
    ].join('\n');

    const sections = parseMarkdown(md);

    expect(sections).toHaveLength(1);
    const chapter = sections[0];
    expect(chapter.title).toBe('Chapter One');
    expect(chapter.children).toHaveLength(2);
    expect(chapter.children[0].title).toBe('Section A');
    expect(chapter.children[1].title).toBe('Section B');
    expect(chapter.children[1].children).toHaveLength(1);
    expect(chapter.children[1].children[0].title).toBe('Subsection B.1');
    expect(chapter.children[1].children[0].level).toBe(3);
  });

  it('counts words per section, including descendants in fullContent', () => {
    const md = [
      '# Top',
      'one two three',
      '',
      '## Sub',
      'four five',
    ].join('\n');

    const sections = parseMarkdown(md);
    const top = sections[0];
    const sub = top.children[0];

    expect(sub.wordCount).toBeGreaterThan(0);
    // Top-level wordCount covers its full subtree; must be >= sub's count.
    expect(top.wordCount).toBeGreaterThanOrEqual(sub.wordCount);
  });

  it('reuses IDs from prior parse when titles still match (round-trip stability)', () => {
    const md1 = '# Alpha\n\n# Beta\n';
    const first = parseMarkdown(md1);
    const alphaId = first[0].id;
    const betaId = first[1].id;

    const md2 = '# Alpha\n\nedited content\n\n# Beta\n';
    const second = parseMarkdown(md2, first);

    expect(second[0].id).toBe(alphaId);
    expect(second[1].id).toBe(betaId);
  });

  it('returns an empty array for empty input', () => {
    expect(parseMarkdown('')).toEqual([]);
  });

  it('does not let a pasted duplicate heading steal a distant section\'s id (proximity reuse)', () => {
    // "Summary" lives late in the document and owns authored testSuite data
    // keyed by its id. Pasting a second "Summary" heading near the top used to
    // consume that id positionally, silently migrating the spec to the stub.
    const md1 = ['# Intro', 'intro prose', '# Middle', 'middle prose', '# Summary', 'the real summary'].join('\n');
    const first = parseMarkdown(md1);
    const summaryId = first[2].id;

    const md2 = ['# Intro', 'intro prose', '# Summary', 'pasted stub', '# Middle', 'middle prose', '# Summary', 'the real summary'].join('\n');
    const second = parseMarkdown(md2, first);
    const summaries = second.filter((s) => s.title === 'Summary');
    expect(summaries).toHaveLength(2);
    // The ORIGINAL (still-nearest) section keeps its id; the pasted stub mints a new one.
    expect(summaries[1].id).toBe(summaryId);
    expect(summaries[0].id).not.toBe(summaryId);
  });

  it('keeps ids with their sections across a reorder of duplicate titles', () => {
    const md1 = ['# A', 'a', '# Notes', 'first notes', '# B', 'b', '# Notes', 'second notes'].join('\n');
    const first = parseMarkdown(md1);
    const firstNotesId = first[1].id;
    const secondNotesId = first[3].id;

    // Swap the two Notes sections' neighborhoods slightly; proximity still
    // pairs each old node with the heading nearest its original line.
    const md2 = ['# A', 'a', '# Notes', 'first notes', 'extra line', '# B', 'b', '# Notes', 'second notes'].join('\n');
    const second = parseMarkdown(md2, first);
    const notes = second.filter((s) => s.title === 'Notes');
    expect(notes[0].id).toBe(firstNotesId);
    expect(notes[1].id).toBe(secondNotesId);
  });

  it('does not promote non-heading lines into sections', () => {
    const md = [
      '# Real Section',
      'A line that mentions # but is not a heading.',
      'Another line.',
    ].join('\n');

    const sections = parseMarkdown(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Real Section');
  });
});

describe('generateId', () => {
  it('produces a slug-and-index id', () => {
    // Trailing punctuation collapses to '-', then the index suffix adds another '-'.
    expect(generateId('Hello World!', 0)).toBe('hello-world--0');
    expect(generateId('Plain', 2)).toBe('plain-2');
    expect(generateId('  Untitled  ', 3)).toBe('-untitled--3');
  });
});

describe('computeHash', () => {
  it('is deterministic for the same input', () => {
    expect(computeHash('abc')).toBe(computeHash('abc'));
  });

  it('differs for different inputs', () => {
    expect(computeHash('abc')).not.toBe(computeHash('abd'));
  });
});
