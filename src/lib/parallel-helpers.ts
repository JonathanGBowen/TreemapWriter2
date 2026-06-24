// Pure helpers for the Parallel Editor's two AI flows. No React, no store, no SDK
// — the AIProvider impls lean on these so they stay thin and testable. Mirrors the
// tolerant-normalization idioms in lib/revision-helpers.ts (whose pickStr /
// extractArray are module-private, so re-stated here rather than imported).

import type { ParagraphRewrite, ReverseOutlineBullet } from '../types';
import type { ParagraphBlock } from './paragraph-helpers';
import { computeHash } from './utils';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const pickRaw = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};
const pickStr = (o: Record<string, unknown>, keys: string[]): string => str(pickRaw(o, keys)).trim();

/** Pull the result array out of whatever envelope the model returned. */
const extractArray = (raw: unknown, keys: string[]): unknown[] | null => {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const key of keys) if (Array.isArray(o[key])) return o[key] as unknown[];
  }
  return null;
};

/**
 * Re-align the reverse-outline model output to the input blocks, 1:1 in document
 * order. The alignment the whole 4-column view depends on must hold even if the
 * model drops, merges, or misnumbers a bullet, so:
 *  - non-prose blocks (heading/list/code) are ALWAYS echoed verbatim (they are
 *    their own distillation — never trust the model to restate a heading);
 *  - a prose block the model covered takes the model's sentence;
 *  - a prose block the model missed gets an empty sentence (the UI flags it
 *    "distillation missing — edit me"), never a dropped row.
 */
export const normalizeReverseOutline = (
  raw: unknown,
  blocks: Pick<ParagraphBlock, 'index' | 'text' | 'kind'>[],
): ReverseOutlineBullet[] => {
  const arr = extractArray(raw, ['bullets', 'outline', 'distillations', 'results']) ?? [];
  const byIndex = new Map<number, string>();
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const idx = Number(pickRaw(o, ['index', 'i', 'n']));
    if (!Number.isInteger(idx)) continue;
    const sentence = pickStr(o, ['sentence', 'distillation', 'bullet', 'text']);
    if (sentence) byIndex.set(idx, sentence);
  }
  return blocks.map((b) => ({
    index: b.index,
    kind: b.kind,
    sentence: b.kind === 'prose' ? byIndex.get(b.index) ?? '' : b.text.trim(),
  }));
};

/**
 * Tolerant validator for the paragraph-regenerate model output. Returns null when
 * there is no usable `proposed_text` (the caller leaves the row unchanged and
 * surfaces a toast — it never silently blanks a paragraph). `original_text` is
 * advisory: the caller already knows draftA and splices against that.
 */
export const normalizeParagraphRewrite = (raw: unknown): ParagraphRewrite | null => {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!o) return null;
  const proposed_text = pickStr(o, ['proposed_text', 'proposedText', 'proposed', 'rewrite', 'revised_text', 'text']);
  if (!proposed_text) return null;
  const original_text = pickStr(o, ['original_text', 'originalText', 'original']);
  return { original_text, proposed_text };
};

/** Hash of a scope's source prose — drives the "source changed since this outline" badge. */
export const sourceHashOf = (text: string): string => computeHash(text);
