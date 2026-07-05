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
import { sectionAnchor } from './section-ids';

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

// ── move (Arpeggio Phase 6) — reorder a heading block as an OPERATION ─────────
//
// A `move` is a cut+reinsert of a section's WHOLE subtree (heading + body + all
// descendants) to a new document position — the FIRST feature to structurally
// rewrite `project.md`. It is NOT a `SegmentEdit` kind (those five are single
// in-place splices resolved to one `SpliceOp`; a move is a cut AND a reinsert with
// hygiene at up to three seams). It works in LINE SPACE — a section's subtree is
// exactly `lines[startLine .. endLine]` (`parseMarkdown` sets `endLine` to the last
// descendant line) — so `split('\n')/join('\n')` is an exact inverse (CRLF rides
// inside the line strings) and byte-changes are confined to the ≤3 touched seams.
// Ids never live in `project.md`, so the mover/target are located by the same
// heading→body-anchor→ordinal discipline `reconcileSectionIds` uses.

/** A section move, addressed by anchors (never ids — those aren't in the prose). */
export interface MoveSpec {
  /** The moving section's canonical heading line (`headingLine(level, title)`). */
  sourceHeadingAnchor: string;
  /** Its `sectionAnchor` (first 64 chars of its own body) — disambiguates duplicates; '' for a germ. */
  sourceBodyAnchor?: string;
  /** Its flatten index in the CURRENT tree — the final nearest-ordinal tiebreak. */
  sourceOrdinal?: number;
  destHeadingAnchor: string;
  destBodyAnchor?: string;
  destOrdinal?: number;
  /** Land the moving subtree before, or after, the destination's WHOLE subtree. */
  position: 'before' | 'after';
}

const isBlankLine = (line: string): boolean => line.trim() === '';

/** Drop leading + trailing blank LINES of a slice (interior blanks preserved). */
function trimBlankEnds(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && isBlankLine(lines[a])) a += 1;
  while (b > a && isBlankLine(lines[b - 1])) b -= 1;
  return lines.slice(a, b);
}

/** The leading blank-line run of a segment (the document's top, when it is segment 0). */
function leadingBlanks(lines: string[]): string[] {
  let a = 0;
  while (a < lines.length && isBlankLine(lines[a])) a += 1;
  return lines.slice(0, a);
}

/** The trailing blank-line run of a segment (the document's EOF, when it is the last segment). */
function trailingBlanks(lines: string[]): string[] {
  let b = lines.length;
  while (b > 0 && isBlankLine(lines[b - 1])) b -= 1;
  return lines.slice(b);
}

/**
 * Concatenate disjoint line segments, normalizing every SEAM to exactly one blank
 * line: each segment's blank ends are trimmed, non-empty segments are rejoined with
 * a single blank line between them. This is the one hygiene primitive — it subsumes
 * the insert applier's `lead` padding and the merge applier's trailing-blank
 * absorption, so no seam collapses two blocks or leaves `\n\n\n`.
 */
function joinBlocks(...segments: string[][]): string[] {
  const parts: string[] = [];
  for (const seg of segments) {
    const s = trimBlankEnds(seg);
    if (s.length === 0) continue;
    if (parts.length) parts.push('');
    parts.push(...s);
  }
  return parts;
}

/** Pre-order DFS flatten of the section tree (document order). */
function flattenSections(sections: Section[]): Section[] {
  const out: Section[] = [];
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(sections);
  return out;
}

/** Locate a section by heading → body-anchor → nearest-ordinal (unique-or-null). */
function locate(flat: Section[], headingAnchor: string, bodyAnchor?: string, ordinal?: number): Section | null {
  if (!headingAnchor) return null;
  const want = headingAnchor.trim();
  let cands = flat.filter((s) => headingLine(s.level, s.title) === want);
  if (cands.length === 0) cands = flat.filter((s) => s.title.trim() === want); // bare-title fallback
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  if (bodyAnchor) {
    const byBody = cands.filter((s) => sectionAnchor(s) === bodyAnchor);
    if (byBody.length === 1) return byBody[0];
    if (byBody.length > 1) cands = byBody;
  }
  if (ordinal !== undefined) {
    let best: Section | null = null;
    let bestDist = Infinity;
    for (const s of cands) {
      const d = Math.abs(flat.indexOf(s) - ordinal);
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  }
  return null; // still ambiguous with no tiebreak — refuse (a no-op is safer than guessing)
}

/**
 * Move a section's whole subtree to a new position. Pure and byte-stable outside
 * the touched seams; returns `source` unchanged on any no-op (orphaned anchor,
 * move-onto-self, already-in-place, or a move into the section's own subtree —
 * `parseMarkdown` always yields a valid tree, but self-nesting would corrupt it).
 * Re-parses `source` internally so it never trusts a possibly-stale section tree.
 */
export function applyMove(source: string, spec: MoveSpec): string {
  const flat = flattenSections(parseMarkdown(source));
  const M = locate(flat, spec.sourceHeadingAnchor, spec.sourceBodyAnchor, spec.sourceOrdinal);
  const T = locate(flat, spec.destHeadingAnchor, spec.destBodyAnchor, spec.destOrdinal);
  if (!M || !T || M === T) return source;

  const lines = source.split('\n');
  const mStart = M.startLine;
  const mEndX = M.endLine + 1; // exclusive; covers heading + body + ALL descendants
  const destStart = T.startLine;
  const destEndX = T.endLine + 1;

  let insertBefore = spec.position === 'before' ? destStart : destEndX;
  if (spec.position === 'after') {
    // Land right after the destination's CONTENT, not after its trailing blank run.
    let q = destEndX;
    while (q > destStart && isBlankLine(lines[q - 1])) q -= 1;
    insertBefore = q;
  }

  // No-op: dropping right where it already is.
  if (insertBefore === mStart || insertBefore === mEndX) return source;
  // Guard: an insertion point strictly inside the moving subtree = move-into-self.
  if (insertBefore > mStart && insertBefore < mEndX) return source;

  // The payload — the moving subtree with its own trailing blank lines trimmed.
  let pe = mEndX;
  while (pe > mStart && isBlankLine(lines[pe - 1])) pe -= 1;
  const payload = lines.slice(mStart, pe);

  const segs =
    insertBefore <= mStart
      ? // Case A — reinsert ABOVE the old location (removal seam = Mid | Tail).
        [lines.slice(0, insertBefore), payload, lines.slice(insertBefore, mStart), lines.slice(mEndX)]
      : // Case B — reinsert BELOW the old location (removal seam = Head | Gap).
        [lines.slice(0, mStart), lines.slice(mEndX, insertBefore), payload, lines.slice(insertBefore)];

  // `joinBlocks` normalizes only the interior seams the move creates and strips the
  // whole result's outer blanks; the document's OUTERMOST blank runs (leading blanks +
  // the trailing final newline) are not touched seams, so re-wrap them from the source
  // verbatim. Taken from the full `lines` (not an end segment) so they survive even when
  // the moved subtree was itself the document's first or last block. This gives
  // byte-stability at the document ends and lets a no-op drop on an already-canonical
  // doc reproduce `source` exactly (restoring the store's no-op fast-path).
  const docLead = leadingBlanks(lines);
  const docTrail = trailingBlanks(lines);
  const result = [...docLead, ...joinBlocks(...segs), ...docTrail];
  return result.join('\n');
}
