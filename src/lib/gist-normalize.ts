// Tolerant normalizers for the Gist pipeline's JSON output. No React, no store, no
// SDK — the AIProvider impls call these after safeJsonParse so a malformed or
// partial model response degrades gracefully instead of throwing. Mirrors the
// extractArray / pickStr idioms in lib/parallel-helpers.ts (which are module-private
// there, hence re-stated rather than imported).

import type {
  GistAnalysis,
  GistComposition,
  GistForce,
  GistMove,
  GistSegmentAnalysis,
  GistSpan,
  GistStyle,
} from '../types';

const MOVES = new Set<GistMove>([
  'define', 'distinguish', 'assert', 'argue', 'object', 'reply',
  'concede', 'exemplify', 'reframe', 'survey', 'setup', 'conclude',
]);
const FORCES = new Set<GistForce>(['asserted', 'hedged', 'entertained', 'denied']);

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const pickRaw = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null) return o[k];
  return undefined;
};
const pickStr = (o: Record<string, unknown>, keys: string[]): string => str(pickRaw(o, keys)).trim();
const asObj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const strArray = (v: unknown, max: number): string[] => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x).trim()).filter(Boolean).slice(0, max);
};

const extractArray = (raw: unknown, keys: string[]): unknown[] => {
  if (Array.isArray(raw)) return raw;
  const o = asObj(raw);
  if (o) for (const key of keys) if (Array.isArray(o[key])) return o[key] as unknown[];
  return [];
};

const asMove = (v: unknown): GistMove => {
  const s = str(v).trim().toLowerCase() as GistMove;
  return MOVES.has(s) ? s : 'assert';
};
const asForce = (v: unknown): GistForce => {
  const s = str(v).trim().toLowerCase() as GistForce;
  return FORCES.has(s) ? s : 'asserted';
};
const asWeight = (v: unknown): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 2;
  return Math.min(5, Math.max(1, n));
};

const DEFAULT_STYLE: GistStyle = { person: 'first person', register: 'plain', cadence: 'mixed', signature_moves: '' };

/**
 * Re-align the analysis output to the known segment ids, 1:1. A segment the model
 * covered takes its analysis; one it missed gets a minimal default so composition
 * still has full coverage (never a dropped segment).
 */
export const normalizeGistAnalysis = (raw: unknown, segmentIds: string[]): GistAnalysis => {
  const root = asObj(raw) ?? {};
  const arr = extractArray(pickRaw(root, ['segments', 'analysis', 'results']) ?? raw, ['segments', 'analysis', 'results']);

  const byId = new Map<string, GistSegmentAnalysis>();
  for (const item of arr) {
    const o = asObj(item);
    if (!o) continue;
    const id = pickStr(o, ['id', 'segment', 'seg', 'segmentId']);
    if (!id) continue;
    byId.set(id, {
      id,
      core_claims: strArray(pickRaw(o, ['core_claims', 'claims', 'coreClaims']), 3),
      move: asMove(pickRaw(o, ['move'])),
      anchor_terms: strArray(pickRaw(o, ['anchor_terms', 'anchorTerms', 'terms']), 5),
      force: asForce(pickRaw(o, ['force'])),
      transition: pickStr(o, ['transition']),
      weight: asWeight(pickRaw(o, ['weight'])),
    });
  }

  const segments: GistSegmentAnalysis[] = segmentIds.map(
    (id) =>
      byId.get(id) ?? {
        id,
        core_claims: [],
        move: 'assert',
        anchor_terms: [],
        force: 'asserted',
        transition: '',
        weight: 2,
      },
  );

  const styleObj = asObj(pickRaw(root, ['style']));
  const style: GistStyle = styleObj
    ? {
        person: pickStr(styleObj, ['person']) || DEFAULT_STYLE.person,
        register: pickStr(styleObj, ['register']) || DEFAULT_STYLE.register,
        cadence: pickStr(styleObj, ['cadence']) || DEFAULT_STYLE.cadence,
        signature_moves: pickStr(styleObj, ['signature_moves', 'signatureMoves']),
      }
    : DEFAULT_STYLE;

  return { segments, thesis: pickStr(root, ['thesis']), style };
};

const alignSpans = (raw: unknown, keys: string[], ids: string[]): GistSpan[] => {
  const arr = extractArray(raw, keys);
  const byId = new Map<string, string>();
  for (const item of arr) {
    const o = asObj(item);
    if (!o) continue;
    const id = pickStr(o, ['id', 'segment', 'seg', 'section']);
    const text = pickStr(o, ['text', 'span', 'gist', 'sentence']);
    if (id && text) byId.set(id, text);
  }
  return ids.map((id) => ({ id, text: byId.get(id) ?? '' }));
};

/**
 * Re-align the composition output to the coarse/fine id lists. A missing span comes
 * back as empty text — recorded as an OMISSION (a section the whole-summary does not
 * carry; see `validateGist`/`gistOmittedIds`), NOT a validation failure — rather than
 * silently dropping the segment id from the gist.
 */
export const normalizeGistComposition = (
  raw: unknown,
  ids: { coarse: string[]; fine: string[] },
): GistComposition => {
  const root = asObj(raw) ?? {};
  return {
    g0: pickStr(root, ['g0', 'thesis', 'headline']),
    coarse: alignSpans(pickRaw(root, ['coarse']) ?? [], ['coarse', 'spans'], ids.coarse),
    fine: alignSpans(pickRaw(root, ['fine']) ?? [], ['fine', 'spans'], ids.fine),
  };
};

/** Tolerant single-span refresh output (Prompt C): { id, text }. Null when unusable. */
export const normalizeGistSpan = (raw: unknown): GistSpan | null => {
  const o = asObj(raw);
  if (!o) return null;
  const id = pickStr(o, ['id', 'segment', 'seg', 'section']);
  const text = pickStr(o, ['text', 'span', 'gist', 'sentence']);
  if (!id || !text) return null;
  return { id, text };
};

/**
 * Tolerant re-fit output (Prompt D): either `{ fits: false }` (caller falls back a
 * grain) or a grain in the same { id, text }[] shape. Returns null on `fits:false`
 * or an unusable response.
 */
export const normalizeGistRefit = (raw: unknown, ids: string[]): GistSpan[] | null => {
  const o = asObj(raw);
  if (o && o.fits === false) return null;
  const spans = alignSpans(raw, ['spans', 'fine', 'coarse', 'grain'], ids);
  return spans.some((s) => s.text) ? spans : null;
};
