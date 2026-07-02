// Pure mapping between StructuralParts and the Section grid. No React, no store,
// no SDK — mirrors lib/paragraph-helpers.ts / lib/gist-normalize.ts in spirit.
//
// A StructuralPart is anchored to arbitrary text spans (startAnchor/endAnchor,
// the verbatim opening text of the blocks that open/close it). This module
// resolves those anchors back to a [startOffset, endOffset] char span in the
// live markdown (reusing segmentParagraphs + findBlockByAnchor — never a second
// parser), then maps the span onto the sections it overlaps and reports the
// structural divergences the heading grid cannot express.
//
// Section overlap uses each section's OWN content extent
// ([startOffset, startOffset + content.length]) — NOT its subtree (fullContent)
// extent. Subtree extents nest, so a part inside a subsection would overlap the
// subsection AND every ancestor, making the many-to-many mapping and the
// divergence flags meaningless. Own extents partition the document, so a part
// maps to exactly the sections whose own text it actually touches.

import type { Section, StructuralPart } from '../types';
import { findBlockByAnchor, segmentParagraphs } from './paragraph-helpers';

export interface ResolvedPart {
  /** Char offset of the part's first block in the markdown, or -1 when unresolved. */
  startOffset: number;
  /** Char offset of the end of the part's last block, or -1 when unresolved. */
  endOffset: number;
  /** Ids of the sections whose OWN content the span overlaps, in document order. */
  sectionIds: string[];
  /** True when either anchor could not be relocated (or the span is degenerate). */
  orphan: boolean;
}

/** Depth-first flatten of the section tree, carrying each section's own char extent. */
interface SectionExtent {
  id: string;
  start: number;
  end: number; // start + content.length (the section's OWN text, excluding children)
}

function sectionExtents(sections: Section[]): SectionExtent[] {
  const out: SectionExtent[] = [];
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      out.push({ id: n.id, start: n.startOffset, end: n.startOffset + n.content.length });
      if (n.children.length) walk(n.children);
    }
  };
  walk(sections);
  return out;
}

// Half-open interval overlap: [aStart, aEnd) intersects [bStart, bEnd).
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && bStart < aEnd;

/**
 * Relocate a part's anchors in `markdown` to a [startOffset, endOffset] span and
 * map the span onto the sections it overlaps. Literal-match-or-orphan: if either
 * anchor can't be relocated (or the span comes out reversed), the part is an
 * orphan with an empty section mapping.
 */
export function resolvePart(part: StructuralPart, markdown: string, sections: Section[]): ResolvedPart {
  const blocks = segmentParagraphs(markdown);
  const startBlock = findBlockByAnchor(blocks, part.startAnchor);
  const endBlock = findBlockByAnchor(blocks, part.endAnchor);
  if (!startBlock || !endBlock) return { startOffset: -1, endOffset: -1, sectionIds: [], orphan: true };
  const startOffset = startBlock.startOffset;
  const endOffset = endBlock.endOffset;
  if (endOffset < startOffset) return { startOffset: -1, endOffset: -1, sectionIds: [], orphan: true };
  const sectionIds = sectionExtents(sections)
    .filter((s) => overlaps(startOffset, endOffset, s.start, s.end))
    .map((s) => s.id);
  return { startOffset, endOffset, sectionIds, orphan: false };
}

export interface PartDivergence {
  /** The part crosses section boundaries (maps to more than one section). */
  spansMultiple: boolean;
  /** The part sits within a single section — it subdivides that section. */
  subdivides: boolean;
  /** This part's section ids that ALSO belong to another part (a shared whole). */
  shared: string[];
}

/**
 * Compute the three divergences the heading grid cannot express, from each part's
 * already-resolved `sectionIds`:
 * - spansMultiple — a part that runs across >1 section.
 * - subdivides    — a part contained within exactly one section (a sub-part of it).
 *   ("strictly inside one section", read at section granularity: the span touches
 *   exactly one section's own text.)
 * - shared        — the part's sections that another part also claims.
 * `sections` scopes the count to live ids, so stale mappings don't inflate flags.
 */
export function computeDivergences(
  parts: StructuralPart[],
  sections: Section[],
): Record<string, PartDivergence> {
  const liveIds = new Set(sectionExtents(sections).map((s) => s.id));
  // How many parts claim each section (only live sections count).
  const claimCount = new Map<string, number>();
  for (const p of parts) {
    for (const sid of p.sectionIds) {
      if (!liveIds.has(sid)) continue;
      claimCount.set(sid, (claimCount.get(sid) ?? 0) + 1);
    }
  }
  const out: Record<string, PartDivergence> = {};
  for (const p of parts) {
    const ids = p.sectionIds.filter((sid) => liveIds.has(sid));
    out[p.id] = {
      spansMultiple: ids.length > 1,
      subdivides: ids.length === 1,
      shared: ids.filter((sid) => (claimCount.get(sid) ?? 0) > 1),
    };
  }
  return out;
}
