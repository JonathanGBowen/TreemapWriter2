// Pure helpers for the Glass Box revision engine. No React, no store, no SDK —
// the AIProvider impl and the revision slice both lean on these so they stay
// thin and testable. Mirrors lib/analysis-helpers.ts in spirit.

import type { RevisionProposal, RevisionType } from '../types';

const VALID_REVISION_TYPES: RevisionType[] = [
  'Addition',
  'Replacement',
  'Deletion',
  'Rewording',
  'Citation',
  'Tone Adjustment',
  'Flow Improvement',
  'Assembly',
];

const coerceType = (v: unknown): RevisionType =>
  typeof v === 'string' && (VALID_REVISION_TYPES as string[]).includes(v)
    ? (v as RevisionType)
    : 'Replacement';

const clampScore = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.max(0, Math.min(5, n));
};

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** First non-null value among the candidate keys — tolerates the model's field-name variance. */
const pickRaw = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};
const pickStr = (o: Record<string, unknown>, keys: string[]): string => str(pickRaw(o, keys)).trim();

/** Pull the proposal array out of whatever envelope the model returned. */
const extractArray = (raw: unknown): unknown[] | null => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const key of ['proposals', 'revisions', 'edits', 'results']) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
  }
  return null;
};

let revSeq = 0;

interface NormalizeOpts {
  sectionLabel?: string;
  fallbackSourceId?: string;
}

/** Validate + coerce one raw item, or null if it lacks a load-bearing field. */
const normalizeOne = (item: unknown, opts: NormalizeOpts): RevisionProposal | null => {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;

  // Tolerate the model's field-name variance (snake/camel, common synonyms) so a
  // minor rename doesn't silently nuke every proposal.
  const original_text = pickStr(o, ['original_text', 'originalText', 'original', 'target_text']);
  const proposed_text = pickStr(o, [
    'proposed_text',
    'proposedText',
    'proposed',
    'replacement',
    'revised_text',
  ]);
  const verbatim_source_quote = pickStr(o, [
    'verbatim_source_quote',
    'verbatimSourceQuote',
    'source_quote',
    'sourceQuote',
    'verbatim_quote',
    'quote',
  ]);
  // The three guarantees: a span to replace, a replacement, and a receipt.
  if (!original_text || !proposed_text || !verbatim_source_quote) return null;

  return {
    id: `rev_${Date.now()}_${revSeq++}`,
    revision_type: coerceType(pickRaw(o, ['revision_type', 'revisionType', 'type'])),
    section: pickStr(o, ['section', 'section_title']) || opts.sectionLabel || '',
    original_text,
    proposed_text,
    rationale: pickStr(o, ['rationale', 'reason', 'justification']),
    source_id: pickStr(o, ['source_id', 'sourceId']) || opts.fallbackSourceId || '',
    verbatim_source_quote,
    confidence_score: clampScore(pickRaw(o, ['confidence_score', 'confidenceScore', 'confidence'])),
  };
};

/**
 * Tolerant validator for the model's revision JSON. Returns null only when the
 * response shape is unrecoverable (no array anywhere) — a valid-but-empty array
 * means "no well-grounded edit", which is NOT an error. Drops any entry missing
 * the load-bearing fields (see normalizeOne).
 */
export const normalizeRevisions = (
  raw: unknown,
  opts: NormalizeOpts = {},
): RevisionProposal[] | null => {
  const arr = extractArray(raw);
  if (!arr) return null;
  const out: RevisionProposal[] = [];
  for (const item of arr) {
    const p = normalizeOne(item, opts);
    if (p) out.push(p);
  }
  return out;
};

/**
 * Locate a proposal's `original_text` in the document. Returns the offset of the
 * first occurrence, or -1 if absent. The engine assumes a unique literal match
 * for acceptance, so first-occurrence IS the contract — we do not fuzzy-match.
 */
export const findProposalOffset = (doc: string, original: string): number =>
  original ? doc.indexOf(original) : -1;

/**
 * Apply a proposal: a single literal `original_text → proposed_text` replace of
 * the first occurrence. Uses slice (not String.replace) so `$` in the proposed
 * text is never interpreted as a replacement pattern. No-op if the span is gone.
 */
export const applyProposal = (
  content: string,
  p: Pick<RevisionProposal, 'original_text' | 'proposed_text'>,
): string => {
  const at = findProposalOffset(content, p.original_text);
  if (at < 0) return content;
  return content.slice(0, at) + p.proposed_text + content.slice(at + p.original_text.length);
};
