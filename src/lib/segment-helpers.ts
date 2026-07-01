// Pure markdown surgery for the Articulation (segmentation) feature. No React, no
// store, no SDK — mirrors lib/paragraph-helpers.ts / lib/spec-merge.ts in spirit.
//
// The Articulation walk proposes `SegmentEdit`s (insert / retitle / relevel /
// merge / split) anchored by the verbatim opening of a paragraph block (the
// literal-match-or-orphan idiom shared by SavedOutlineBullet / ProvenanceMark /
// GistSegment). This file turns those anchored edits into new markdown, then the
// caller reparses with `parseMarkdown` exactly as the rest of the app does.
//
// THE load-bearing guarantee: a heading is only ever spliced at a paragraph
// BOUNDARY (before a block's startOffset), never inside a paragraph. That is free
// here: `segmentParagraphs` guarantees a block never spans a paragraph break, so
// "before a block's startOffset" IS a paragraph boundary by construction.

import type { Section, SegmentEdit } from '../types';
import { segmentParagraphs, findBlockByAnchor, type ParagraphBlock } from './paragraph-helpers';
import { parseMarkdown } from './utils';

const HEADING_LINE = /^(#{1,6})\s+(.*)$/;

/** Parse a heading line into its level (1–6) and title, or null if not a heading. */
function headingParts(text: string): { level: number; title: string } | null {
  const m = text.trim().match(HEADING_LINE);
  return m ? { level: m[1].length, title: m[2].trim() } : null;
}

/** Build a canonical ATX heading line: `'#'.repeat(level) + ' ' + title`. */
const headingLine = (level: number, title: string): string =>
  `${'#'.repeat(Math.max(1, Math.min(6, level)))} ${title.trim()}`;

/** Find a HEADING block whose line matches a saved anchor (literal-match-or-orphan).
 *  Matches the raw line (`## Title`) or, as a fallback, the bare title text. */
function findHeadingByAnchor(blocks: ParagraphBlock[], anchor: string): ParagraphBlock | null {
  if (!anchor) return null;
  const a = anchor.trimStart();
  const headings = blocks.filter((b) => b.kind === 'heading');
  const byLine = headings.find((b) => b.text.trimStart().startsWith(a));
  if (byLine) return byLine;
  // Fallback: the anchor was given as the bare title (no `#`).
  return headings.find((b) => (headingParts(b.text)?.title ?? '').startsWith(a)) ?? null;
}

/** A concrete splice against the source: replace [start, end) with `replacement`. */
interface SpliceOp {
  start: number;
  end: number;
  replacement: string;
}

/** One edit resolved against the CURRENT source; `op` is null when its anchor
 *  orphaned (the prose moved/was rewritten) or the edit is already satisfied. */
export interface ResolvedEdit {
  edit: SegmentEdit;
  op: SpliceOp | null;
}

/**
 * Resolve every edit's anchor to a concrete splice against `source`. Never throws:
 * an unfindable anchor or an already-satisfied edit resolves to `op: null` and is
 * simply dropped by `applySegmentEdits`. Computed against the original source, so
 * the caller can apply right-to-left without re-resolving.
 */
export function resolveEdits(source: string, edits: SegmentEdit[]): ResolvedEdit[] {
  const blocks = segmentParagraphs(source);
  return edits.map((edit) => ({ edit, op: resolveOne(source, blocks, edit) }));
}

function resolveOne(source: string, blocks: ParagraphBlock[], edit: SegmentEdit): SpliceOp | null {
  switch (edit.kind) {
    case 'insert':
    case 'split': {
      // A new heading BEFORE the block that opens the new part.
      const target = findBlockByAnchor(blocks, edit.anchor);
      if (!target) return null;
      const desired = headingLine(edit.level, edit.title);
      // Idempotency: if the block right before the target is already this heading,
      // the seam is satisfied — re-applying is a no-op.
      const prev = blocks[target.index - 1];
      if (prev && prev.kind === 'heading' && prev.text.trim() === desired) return null;
      const before = source.slice(0, target.startOffset);
      // A block's startOffset is a line start, so `before` ends with '\n' unless at
      // the very start. Pad to a blank line before the heading when one isn't there.
      const lead = target.startOffset === 0 ? '' : before.endsWith('\n\n') ? '' : '\n';
      return { start: target.startOffset, end: target.startOffset, replacement: `${lead}${desired}\n\n` };
    }
    case 'retitle': {
      const target = findHeadingByAnchor(blocks, edit.anchor);
      if (!target) return null;
      const level = headingParts(target.text)?.level ?? 2;
      const desired = headingLine(level, edit.title);
      if (target.text.trim() === desired) return null;
      return { start: target.startOffset, end: target.endOffset, replacement: desired };
    }
    case 'relevel': {
      const target = findHeadingByAnchor(blocks, edit.anchor);
      if (!target) return null;
      const title = headingParts(target.text)?.title ?? '';
      const desired = headingLine(edit.level, title);
      if (target.text.trim() === desired) return null;
      return { start: target.startOffset, end: target.endOffset, replacement: desired };
    }
    case 'merge': {
      // Remove the shard heading; its body rejoins the part above on reparse.
      const target = findHeadingByAnchor(blocks, edit.anchor);
      if (!target) return null;
      const next = blocks[target.index + 1];
      // Take the heading line AND the blank-line run after it, so no stray blank
      // block is left where the heading was.
      const end = next ? next.startOffset : target.endOffset;
      return { start: target.startOffset, end, replacement: '' };
    }
    default:
      return null;
  }
}

/**
 * Apply a list of heading insertions/edits to markdown and return new markdown.
 * Pure and deterministic. Splices are applied RIGHT-TO-LEFT by offset so earlier
 * offsets never shift; orphaned/already-satisfied edits are dropped; the result is
 * idempotent (re-applying the same edits is a no-op). Headings only ever land at
 * paragraph boundaries.
 */
export function applySegmentEdits(source: string, edits: SegmentEdit[]): string {
  if (edits.length === 0) return source;
  const ops = resolveEdits(source, edits)
    .map((r) => r.op)
    .filter((op): op is SpliceOp => op !== null)
    // Right-to-left; for a tie (e.g. an insert at the same offset as a removal),
    // process the longer span first so a zero-width insert lands cleanly after.
    .sort((a, b) => b.start - a.start || b.end - a.end);
  let out = source;
  for (const op of ops) out = out.slice(0, op.start) + op.replacement + out.slice(op.end);
  return out;
}

/**
 * Strip every markdown heading line from the source, leaving the prose. Used by
 * the Articulation tool's "exploratory" mode, which re-derives the structure as if
 * no headings existed. Collapses the blank-line run a removed heading leaves behind.
 */
export function stripHeadings(source: string): string {
  const out = source
    .split('\n')
    .filter((line) => !HEADING_LINE.test(line.trim()))
    .join('\n');
  // Collapse 3+ newlines (left by a removed heading between two blanks) to one blank.
  return out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

/**
 * True when a parsed document carries NO markdown headings. `parseMarkdown`
 * returns the top-level nodes, so a flat draft with no `#` headings yields `[]`.
 * The detection seam for the spec sweep's auto-segment-first step.
 */
export const hasNoHeadings = (sections: Section[]): boolean => sections.length === 0;

/** Apply edits, then reparse — the shape the accept path and tests both want. */
export function applyAndReparse(
  source: string,
  edits: SegmentEdit[],
  oldSections: Section[] = [],
): { markdown: string; sections: Section[] } {
  const markdown = applySegmentEdits(source, edits);
  return { markdown, sections: parseMarkdown(markdown, oldSections) };
}
