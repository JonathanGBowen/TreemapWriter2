// Pure helpers for the Glass Box revision engine. No React, no store, no SDK —
// the AIProvider impl and the revision slice both lean on these so they stay
// thin and testable. Mirrors lib/analysis-helpers.ts in spirit.

import type {
  AssemblySubMode,
  RevisionMode,
  RevisionProposal,
  RevisionType,
  SourceDocument,
} from '../types';

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

  const original_text = str(o.original_text).trim();
  const proposed_text = str(o.proposed_text).trim();
  const verbatim_source_quote = str(o.verbatim_source_quote).trim();
  // The three guarantees: a span to replace, a replacement, and a receipt.
  if (!original_text || !proposed_text || !verbatim_source_quote) return null;

  return {
    id: `rev_${Date.now()}_${revSeq++}`,
    revision_type: coerceType(o.revision_type),
    section: str(o.section).trim() || opts.sectionLabel || '',
    original_text,
    proposed_text,
    rationale: str(o.rationale).trim(),
    source_id: str(o.source_id).trim() || opts.fallbackSourceId || '',
    verbatim_source_quote,
    confidence_score: clampScore(o.confidence_score),
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

const SOURCE_CONTENT_CAP = 8000;
const SECTION_TEXT_CAP = 24000;

/** Compose the request body: directive + mode + section + the quotable sources. */
export const buildRevisionsRequestText = (args: {
  prompt: string;
  sectionTitle: string;
  sectionText: string;
  directive: string;
  mode: RevisionMode;
  subMode: AssemblySubMode;
  sources: SourceDocument[];
}): string => {
  const sourceBlocks = args.sources
    .map((s) =>
      [
        `SOURCE id=${s.id} kind="${s.kind}" label="${s.label}"`,
        '"""',
        s.content.slice(0, SOURCE_CONTENT_CAP),
        '"""',
      ].join('\n'),
    )
    .join('\n\n');

  return [
    args.prompt,
    '',
    `MODE: ${args.mode}${args.mode === 'assembly' ? ` (${args.subMode})` : ''}`,
    '',
    `DIRECTIVE: ${args.directive.trim() || '(none specified — improve the section using the sources)'}`,
    '',
    `SECTION: "${args.sectionTitle}"`,
    '',
    'SECTION TEXT (propose edits to this; original_text MUST be an exact substring):',
    '---',
    args.sectionText.slice(0, SECTION_TEXT_CAP),
    '---',
    '',
    'SOURCE MATERIALS (quote ONLY from these):',
    sourceBlocks || '(none provided)',
  ].join('\n');
};
