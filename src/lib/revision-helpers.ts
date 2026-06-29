// Pure helpers for the Glass Box revision engine. No React, no store, no SDK —
// the AIProvider impl and the revision slice both lean on these so they stay
// thin and testable. Mirrors lib/analysis-helpers.ts in spirit.

import type { DirectiveSuggestion, RevisionMode, RevisionProposal, RevisionType } from '../types';
import { safeJsonParse } from './utils';

/**
 * Whether a revision pass is ready to generate. `revision` mode needs a directive
 * (it can be sourceless); `assembly` and `citations` need at least one source to
 * work from (their directive is optional). The single source of truth for the
 * Generate gate, shared by the config UI and the action's abort check.
 */
export const revisionReady = (
  mode: RevisionMode,
  selectedSourceCount: number,
  directive: string,
): boolean => (mode === 'revision' ? directive.trim().length > 0 : selectedSourceCount > 0);

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
export const pickRaw = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};
export const pickStr = (o: Record<string, unknown>, keys: string[]): string =>
  str(pickRaw(o, keys)).trim();

/** Pull the result array out of whatever envelope the model returned. */
const extractArray = (
  raw: unknown,
  keys = ['proposals', 'revisions', 'edits', 'results'],
): unknown[] | null => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
  }
  return null;
};

let revSeq = 0;

interface NormalizeOpts {
  sectionLabel?: string;
  fallbackSourceId?: string;
  /**
   * SOURCELESS pass (no source documents). When true the glass-box receipt is
   * not required: proposals are grounded in the document itself, so a missing
   * `verbatim_source_quote`/`source_id` is expected, not a defect.
   */
  sourceless?: boolean;
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
  // The glass-box guarantees: a span to replace, a replacement, and — in SOURCED
  // mode — a verbatim receipt. A sourceless pass grounds proposals in the document
  // itself, so it drops to two guarantees (no receipt to require). This is the one
  // place the receipt contract is conditional; keep sourced mode strict.
  if (!original_text || !proposed_text) return null;
  if (!opts.sourceless && !verbatim_source_quote) return null;

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

/**
 * Parse a deep-revision AGENT's final answer into something `normalizeRevisions` can
 * read: a JSON array (preferred) or an object envelope, tolerating fenced code blocks
 * and an array buried in stray prose. Returns null when nothing array-like is found.
 * The agent is instructed to emit ONLY the array; this is the safety net.
 */
export const parseAgentProposals = (answer: string): unknown => {
  const direct = safeJsonParse(answer, null);
  if (Array.isArray(direct)) return direct;
  // Prefer an explicit array slice over safeJsonParse's brace-match, which can grab a
  // single inner object out of an array printed amid prose. Also unwraps the array
  // from an `{ proposals: [...] }` envelope.
  const lb = answer.indexOf('[');
  const rb = answer.lastIndexOf(']');
  if (lb >= 0 && rb > lb) {
    try {
      const arr = JSON.parse(answer.slice(lb, rb + 1));
      if (Array.isArray(arr)) return arr;
    } catch {
      /* fall through */
    }
  }
  // Last resort: a clean object envelope normalizeRevisions can still unwrap.
  return direct && typeof direct === 'object' ? direct : null;
};

/**
 * Tolerant validator for the model's directive-suggestion JSON. Null only when no
 * array is recoverable; drops entries with no `directive` text and titles each
 * missing one.
 */
export const normalizeDirectiveSuggestions = (raw: unknown): DirectiveSuggestion[] | null => {
  const arr = extractArray(raw, ['directives', 'suggestions', 'options', 'results']);
  if (!arr) return null;
  const out: DirectiveSuggestion[] = [];
  arr.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const directive = pickStr(o, ['directive', 'text', 'body', 'content', 'instruction']);
    if (!directive) return;
    out.push({ title: pickStr(o, ['title', 'label', 'name']) || `Option ${i + 1}`, directive });
  });
  return out;
};
