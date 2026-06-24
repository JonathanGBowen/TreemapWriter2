// Pure paragraph segmentation for the Parallel Editor. No React, no store, no SDK
// — mirrors lib/revision-helpers.ts / lib/compareHelpers.ts in spirit. The one
// load-bearing invariant: every block's `text` is an EXACT substring of the
// source (source.slice(startOffset, endOffset) === text), because that text is
// fed verbatim to applyProposal — a non-substring would silently no-op the accept.
//
// There is no existing paragraph splitter: parseMarkdown (lib/utils.ts) splits by
// HEADING into a Section tree; compareHelpers.buildAlignedRows aligns a LINE diff.
// Both are the wrong granularity, hence this file.

import type { ParagraphKind } from '../types';

export interface ParagraphBlock {
  /** 0-based position within the segmented source, in document order. */
  index: number;
  /** Verbatim block text (no surrounding blank-line runs). EXACT substring of source. */
  text: string;
  /** Byte offset of `text` within the source. */
  startOffset: number;
  /** startOffset + text.length. */
  endOffset: number;
  kind: ParagraphKind;
}

const BLANK = /^[ \t\r]*$/;
const HEADING = /^#{1,6}\s/;
const FENCE = /^\s*(```|~~~)/;
const LIST = /^\s*([-*+]|\d+[.)])\s/;

/**
 * Split a markdown source into paragraph blocks. Rules (robust to headings, fenced
 * code, lists, blank lines, and CRLF):
 * - blocks are separated by blank-line runs;
 * - a heading line is its own block (a heading is its own distillation);
 * - a fenced code block is ONE block even with blank lines inside;
 * - a contiguous list (incl. wrapped continuation lines) is ONE block;
 * - offsets are computed by walking the raw string (never join — that drifts on \r\n).
 */
export const segmentParagraphs = (source: string): ParagraphBlock[] => {
  if (!source) return [];
  const lines = source.split('\n');

  // Start offset of each line in the raw source (mirrors parseMarkdown's lineOffsets).
  const lineStart: number[] = [];
  let off = 0;
  for (const line of lines) {
    lineStart.push(off);
    off += line.length + 1; // +1 for the consumed '\n'
  }

  const blocks: ParagraphBlock[] = [];
  const push = (startLine: number, endLineExcl: number, kind: ParagraphKind) => {
    // Trim leading/trailing blank lines so `text` never carries a blank-line run.
    let s = startLine;
    let e = endLineExcl;
    while (s < e && BLANK.test(lines[s])) s++;
    while (e > s && BLANK.test(lines[e - 1])) e--;
    if (s >= e) return;
    const startOffset = lineStart[s];
    const endOffset = lineStart[e - 1] + lines[e - 1].length; // end of last line, excl. newline
    blocks.push({
      index: blocks.length,
      text: source.slice(startOffset, endOffset),
      startOffset,
      endOffset,
      kind,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BLANK.test(line)) {
      i++;
      continue;
    }
    if (HEADING.test(line)) {
      push(i, i + 1, 'heading');
      i++;
      continue;
    }
    if (FENCE.test(line)) {
      const start = i;
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) i++;
      if (i < lines.length) i++; // include the closing fence line
      push(start, i, 'code');
      continue;
    }
    if (LIST.test(line)) {
      const start = i;
      i++;
      while (i < lines.length && !BLANK.test(lines[i]) && !HEADING.test(lines[i]) && !FENCE.test(lines[i])) i++;
      push(start, i, 'list');
      continue;
    }
    // Prose: consume until a blank line, heading, fence, or list begins.
    const start = i;
    i++;
    while (
      i < lines.length &&
      !BLANK.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !FENCE.test(lines[i]) &&
      !LIST.test(lines[i])
    ) {
      i++;
    }
    push(start, i, 'prose');
  }

  return blocks;
};

/** A short verbatim anchor for a block — the 1:1 link persisted with outlineA. */
export const anchorFor = (text: string, len = 64): string => text.trimStart().slice(0, len);

/**
 * Find the block whose text matches a saved anchor, or null. Literal-match-or-skip:
 * prefer a start-of-block match, fall back to a contained match; never fuzzy-match
 * (mirrors findProposalOffset). Caller segments once and passes the blocks in.
 */
export const findBlockByAnchor = (blocks: ParagraphBlock[], anchor: string): ParagraphBlock | null => {
  if (!anchor) return null;
  const byStart = blocks.find((b) => b.text.trimStart().startsWith(anchor));
  if (byStart) return byStart;
  return blocks.find((b) => b.text.includes(anchor)) ?? null;
};

/** Convenience wrapper: segment `source` then relocate by anchor. */
export const relocateBlock = (source: string, anchor: string): ParagraphBlock | null =>
  findBlockByAnchor(segmentParagraphs(source), anchor);
