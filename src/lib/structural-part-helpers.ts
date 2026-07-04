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
import { anchorFor, findBlockByAnchor, segmentParagraphs } from './paragraph-helpers';
import { computeHash } from './utils';
import { normalizeForHash } from './gist-helpers';

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
  // An empty anchor cannot be relocated (findBlockByAnchor would match the first
  // block on a '' prefix). An authored germ part with no prose yet is unresolved —
  // orphan here, but exempted from orphan-FLAGGING in recomputeStructuralStale.
  if (!part.startAnchor || !part.endAnchor) return { startOffset: -1, endOffset: -1, sectionIds: [], orphan: true };
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

/**
 * Re-anchor a merely-stale part against the live document (Mode 1 repair — NO AI):
 * re-stamp its anchors + `sourceHash` + `sectionIds` from the current span so the
 * annotation reads fresh again. Returns `null` for an ORPHAN (no span to relocate),
 * mirroring gist hiding its refresh button for orphans. Pure; the caller persists.
 */
export function reanchoredPart(
  part: StructuralPart,
  markdown: string,
  sections: Section[],
): StructuralPart | null {
  const { startOffset, endOffset, sectionIds, orphan } = resolvePart(part, markdown, sections);
  if (orphan) return null;
  const blocks = segmentParagraphs(markdown);
  const startBlock = findBlockByAnchor(blocks, part.startAnchor);
  const endBlock = findBlockByAnchor(blocks, part.endAnchor);
  if (!startBlock || !endBlock) return null;
  const reanchored: StructuralPart = {
    ...part,
    startAnchor: anchorFor(startBlock.text),
    endAnchor: anchorFor(endBlock.text),
    sectionIds,
    sourceHash: computeHash(normalizeForHash(markdown.slice(startOffset, endOffset))),
  };
  // Re-stamp the surround too, so a re-anchor also clears a homotypy flag (Phase 6).
  return { ...reanchored, surroundHash: computeSurroundHash(reanchored, markdown) };
}

/**
 * Hash of a part's immediate document SURROUND — the paragraph block just before
 * its start anchor + the block just after its end anchor. The direct inverse of
 * `sourceHash` (which hashes the part's OWN text): `surroundHash` HOLDS while the
 * neighbours are unchanged and MOVES when the part is relocated / re-neighboured.
 * The homotypy anchor (Phase 6) — "the same letters, a new surround." Empty for an
 * unresolvable (germ / orphan) part, so it never falsely reads as changed.
 */
export function computeSurroundHash(part: StructuralPart, markdown: string): string {
  if (!part.startAnchor || !part.endAnchor) return '';
  const blocks = segmentParagraphs(markdown);
  const s = findBlockByAnchor(blocks, part.startAnchor);
  const e = findBlockByAnchor(blocks, part.endAnchor);
  if (!s || !e) return '';
  const before = s.index > 0 ? blocks[s.index - 1].text : '';
  const after = e.index < blocks.length - 1 ? blocks[e.index + 1].text : '';
  // A record-separator glyph between the two so `before|after` can't collide.
  return computeHash(normalizeForHash(`${before}␞${after}`));
}

export interface StructuralHomotypyResult {
  /** Part ids whose OWN text HELD but whose document surround/order moved (the I.4 inversion). */
  homotypyIds: string[];
}

/**
 * The INVERSE of `recomputeStructuralStale` (Phase 6, repairing muddle I.4): flag
 * each part whose span text is UNCHANGED (`src === sourceHash`) but whose stored
 * `surroundHash` no longer matches its current surround — "after restructuring, one
 * cannot correctly even write the same letters." Partitions cleanly with staleness:
 * a part is STALE (text changed) XOR homotypy-candidate (text held, surround moved)
 * XOR clean. Germ exemption + orphan skip mirror the staleness check; a part with no
 * stored `surroundHash` (pre-Phase-6, or never stamped) has no "before" to diff and
 * is never a candidate. Annotate-only; a re-anchor re-stamps and clears it.
 */
export function recomputeHomotypy(
  parts: StructuralPart[],
  markdown: string,
  sections: Section[],
): StructuralHomotypyResult {
  const homotypyIds: string[] = [];
  for (const p of parts) {
    if (p.origin === 'authored' && !p.startAnchor && !p.endAnchor) continue; // germ: content-debt
    const r = resolvePart(p, markdown, sections);
    if (r.orphan) continue; // orphans belong to the staleness path
    const src = computeHash(normalizeForHash(markdown.slice(r.startOffset, r.endOffset)));
    if (src !== p.sourceHash) continue; // text CHANGED → stale, not homotypy
    if (p.surroundHash && computeSurroundHash(p, markdown) !== p.surroundHash) homotypyIds.push(p.id);
  }
  return { homotypyIds };
}

export interface StructuralStaleResult {
  /** Part ids whose source span text changed since discovery. */
  staleIds: string[];
  /** Part ids whose anchors can no longer be relocated (the part is unfindable). */
  orphanIds: string[];
}

/**
 * Recompute staleness + orphaning for the discovered parts against the live
 * markdown + Section tree — the structural-part analogue of gist-helpers'
 * `recomputeStale`. `resolvePart` relocates each part's anchors: unresolved →
 * ORPHAN; else a changed normalized-hash of the span → STALE. Annotate only,
 * never rewrite (P6). A re-discovery replaces the parts with fresh hashes and
 * clears both flags.
 */
export function recomputeStructuralStale(
  parts: StructuralPart[],
  markdown: string,
  sections: Section[],
): StructuralStaleResult {
  const staleIds: string[] = [];
  const orphanIds: string[] = [];
  for (const p of parts) {
    // An authored germ part (no anchors yet) is CONTENT-DEBT — unrealized prose,
    // not a lost anchor. It is neither stale nor orphan; skip it entirely (Phase 2).
    if (p.origin === 'authored' && !p.startAnchor && !p.endAnchor) continue;
    const r = resolvePart(p, markdown, sections);
    if (r.orphan) {
      orphanIds.push(p.id);
      continue;
    }
    if (computeHash(normalizeForHash(markdown.slice(r.startOffset, r.endOffset))) !== p.sourceHash) {
      staleIds.push(p.id);
    }
  }
  return { staleIds, orphanIds };
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

/**
 * `computeDivergences` against LIVE section mappings: re-resolve each part's
 * `sectionIds` from the current markdown first (the stored ids drift as prose is
 * edited) so the flags describe the document as it is now.
 */
export function computeLiveDivergences(
  parts: StructuralPart[],
  markdown: string,
  sections: Section[],
): Record<string, PartDivergence> {
  const live = parts.map((p) => ({ ...p, sectionIds: resolvePart(p, markdown, sections).sectionIds }));
  return computeDivergences(live, sections);
}

/**
 * A compact one-line summary of the discovered configuration for the consuming
 * passes (coach, dependencies) — the cross-section facts the per-section table
 * structurally cannot carry. Empty string when there are no parts, so a caller
 * appends nothing and degrades to its prior behavior.
 */
export function summarizeParts(parts: StructuralPart[], sections: Section[]): string {
  if (parts.length === 0) return '';
  const divergences = computeDivergences(parts, sections);
  const kinds = Array.from(new Set(parts.map((p) => p.kind).filter(Boolean)));
  const spanning = parts.filter((p) => divergences[p.id]?.spansMultiple).length;
  const shared = parts.filter((p) => (divergences[p.id]?.shared.length ?? 0) > 0).length;
  const kindList = kinds.length ? ` — kinds: ${kinds.join(', ')}` : '';
  const plural = parts.length === 1 ? '' : 's';
  return `${parts.length} discovered structural part${plural}${kindList}; ${spanning} span multiple sections; ${shared} shared across sections.`;
}
