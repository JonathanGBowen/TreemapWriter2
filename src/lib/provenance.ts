import type { ProvenanceMark, ProvenanceSource } from '../types';

/** Verbatim prefix length used to relocate a mark against the live document. */
export const PROVENANCE_ANCHOR_LEN = 64;

let provSeq = 0;

/**
 * Build a durable provenance mark for a freshly-accepted AI span, or null when the
 * inserted text is empty/blank (nothing to attribute). Pure — `at` is passed in so
 * the result is deterministic and unit-testable. The anchor is the inserted text's
 * leading slice; relocation on load is literal `indexOf`, never fuzzy — so a rewrite
 * of the span's opening drops the mark and the prose becomes the writer's own (F2).
 *
 * `offset` is the known splice position when the accept path has one (it always
 * does now — applyProposalAt reports it). It pins the mark to the occurrence that
 * was actually written, so a duplicate of the inserted phrase earlier in the
 * document can no longer steal the tint; anchor `indexOf` remains the fallback
 * for legacy marks and for spans whose position has drifted.
 */
export const makeProvenanceMark = (
  insertedText: string,
  source: ProvenanceSource,
  at: number,
  offset?: number,
): ProvenanceMark | null => {
  const text = insertedText ?? '';
  if (!text.trim()) return null;
  return {
    id: `prov_${at}_${provSeq++}`,
    anchor: text.slice(0, PROVENANCE_ANCHOR_LEN),
    length: text.length,
    source,
    at,
    ...(offset !== undefined && offset >= 0 ? { offset } : {}),
  };
};
