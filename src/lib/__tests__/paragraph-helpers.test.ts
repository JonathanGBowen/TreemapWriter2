import { describe, expect, it } from 'vitest';
import {
  anchorFor,
  findBlockByAnchor,
  relocateBlock,
  segmentParagraphs,
} from '../paragraph-helpers';

/** The load-bearing invariant: every block's text is an exact substring of source. */
const assertSubstringFidelity = (source: string) => {
  for (const b of segmentParagraphs(source)) {
    expect(source.slice(b.startOffset, b.endOffset)).toBe(b.text);
  }
};

describe('segmentParagraphs', () => {
  it('returns [] for empty input', () => {
    expect(segmentParagraphs('')).toEqual([]);
    expect(segmentParagraphs('   \n\n  ')).toEqual([]);
  });

  it('splits prose on blank-line runs and trims blank lines from text', () => {
    const src = 'First para line one.\nstill first.\n\n\nSecond para.';
    const blocks = segmentParagraphs(src);
    expect(blocks.map((b) => b.text)).toEqual(['First para line one.\nstill first.', 'Second para.']);
    expect(blocks.map((b) => b.kind)).toEqual(['prose', 'prose']);
    expect(blocks.map((b) => b.index)).toEqual([0, 1]);
  });

  it('makes a heading its own block, never merged with following prose', () => {
    const src = '# Title\nBody paragraph.';
    const blocks = segmentParagraphs(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ text: '# Title', kind: 'heading' });
    expect(blocks[1]).toMatchObject({ text: 'Body paragraph.', kind: 'prose' });
  });

  it('keeps a fenced code block as one block even with blank lines inside', () => {
    const src = 'Intro.\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nOutro.';
    const blocks = segmentParagraphs(src);
    expect(blocks.map((b) => b.kind)).toEqual(['prose', 'code', 'prose']);
    expect(blocks[1].text).toBe('```ts\nconst a = 1;\n\nconst b = 2;\n```');
  });

  it('merges a contiguous list into one block', () => {
    const src = 'Lead.\n\n- one\n- two\n  wrapped\n- three\n\nAfter.';
    const blocks = segmentParagraphs(src);
    expect(blocks.map((b) => b.kind)).toEqual(['prose', 'list', 'prose']);
    expect(blocks[1].text).toBe('- one\n- two\n  wrapped\n- three');
  });

  it('preserves exact offsets across CRLF, headings, fences, and lists', () => {
    assertSubstringFidelity('# H\r\n\r\nPara with CRLF.\r\nsecond line.\r\n\r\n- a\r\n- b');
    assertSubstringFidelity('No trailing newline.');
    assertSubstringFidelity('a\n\n```\nx\n```');
    assertSubstringFidelity('# Only a heading');
  });
});

describe('anchorFor / findBlockByAnchor / relocateBlock', () => {
  const src = '# Title\n\nThe first paragraph makes a claim.\n\nThe second paragraph defends it.';

  it('anchorFor takes the leading verbatim slice', () => {
    expect(anchorFor('The first paragraph makes a claim.', 16)).toBe('The first paragr');
    expect(anchorFor('  leading space kept after trimStart')).toBe('leading space kept after trimStart');
  });

  it('relocates a block by its anchor', () => {
    const found = relocateBlock(src, 'The second paragraph');
    expect(found?.text).toBe('The second paragraph defends it.');
  });

  it('returns null when the anchor is gone (literal-match-or-skip)', () => {
    expect(relocateBlock(src, 'A paragraph that was deleted')).toBeNull();
    expect(findBlockByAnchor(segmentParagraphs(src), '')).toBeNull();
  });
});
