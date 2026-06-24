// Pure logic for the Gist Editor. No React, no store, no SDK — the workspace hook
// and the AIProvider impls lean on these so they stay thin and testable. Mirrors the
// spirit of lib/parallel-helpers.ts (tolerant normalization) and lib/paragraph-helpers
// (verbatim anchoring, literal-match-or-orphan).
//
// The Gist is the document at LOW RESOLUTION, not metadata about it. Segmentation is
// the existing Section tree (heading hierarchy = the design's primary scheme): the
// COARSE grain is one span per top-level section, the FINE grain one span per segment.

import type {
  GistBudgets,
  GistGrain,
  GistMove,
  GistSegment,
  GistSegmentAnalysis,
  GistSpan,
  Section,
  StoredGist,
} from '../types';
import { computeHash, countWords } from './utils';
import { anchorFor } from './paragraph-helpers';

// ───────────────────────────── segmentation ─────────────────────────────

/** A segment of the document for gist purposes — one heading-delimited Section node. */
export interface GistSegmentInfo {
  id: string;
  /** Titles from the document root down to this node (for aria-labels + tooltips). */
  headingPath: string[];
  level: number;
  title: string;
  /** The node's OWN text (heading + paragraphs before the first sub-heading). */
  text: string;
  /** A top-level section is a COARSE-grain span (parentId === null). */
  isTopLevel: boolean;
}

/** Flatten the Section tree into gist segments, in document order (every node). */
export const flattenGistSegments = (sections: Section[]): GistSegmentInfo[] => {
  const out: GistSegmentInfo[] = [];
  const walk = (nodes: Section[], path: string[]) => {
    for (const n of nodes) {
      const headingPath = [...path, n.title];
      out.push({
        id: n.id,
        headingPath,
        level: n.level,
        title: n.title,
        text: n.content,
        // Top-level (a coarse-grain span) = a direct child of the document root,
        // i.e. depth 0 in this walk. `parseMarkdown` returns the root's children
        // with parentId 'root' (not null), so depth is the robust signal.
        isTopLevel: path.length === 0,
      });
      if (n.children.length) walk(n.children, headingPath);
    }
  };
  walk(sections, []);
  return out;
};

/** The ids that make up each grain. fine = every segment; coarse = top-level only. */
export const grainSegmentIds = (sections: Section[]): { fine: string[]; coarse: string[] } => {
  const segs = flattenGistSegments(sections);
  return { fine: segs.map((s) => s.id), coarse: segs.filter((s) => s.isTopLevel).map((s) => s.id) };
};

// ──────────────────────── normalization & staleness ─────────────────────

/**
 * Normalize a segment's text for hashing: strip markdown punctuation and collapse
 * whitespace so a FORMATTING-only edit doesn't trip staleness (P6 / §5.3). Applied
 * identically at generation and recompute, so it only sets sensitivity, never skews
 * the comparison.
 */
export const normalizeForHash = (text: string): string =>
  text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links / images → their visible text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')      // heading markers
    .replace(/^[ \t]*>[ \t]?/gm, '')           // blockquote markers
    .replace(/[*_~`]/g, '')                    // emphasis / inline-code fences
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Build the persisted per-segment anchors at generation time (id + verbatim anchor + hash). */
export const buildSegmentation = (sections: Section[]): GistSegment[] =>
  flattenGistSegments(sections).map((s) => ({
    id: s.id,
    headingPath: s.headingPath,
    anchor: anchorFor(s.text),
    sourceHash: computeHash(normalizeForHash(s.text)),
  }));

/** Relocate a stored segment in the current tree: by id, else by verbatim anchor. */
const relocate = (
  seg: GistSegment,
  byId: Map<string, GistSegmentInfo>,
  all: GistSegmentInfo[],
): GistSegmentInfo | null => {
  const direct = byId.get(seg.id);
  if (direct) return direct;
  if (!seg.anchor) return null;
  return (
    all.find((s) => s.text.trimStart().startsWith(seg.anchor)) ??
    all.find((s) => s.text.includes(seg.anchor)) ??
    null
  );
};

export interface StaleResult {
  /** Segment ids whose source text changed since generation. */
  staleIds: string[];
  /** Segment ids whose source section can no longer be found (deleted). */
  orphanIds: string[];
}

/**
 * Recompute staleness + orphaning against the live Section tree. Staleness never
 * rewrites a span — it only annotates it. A segment found by id-or-anchor with a
 * changed normalized hash is stale; one that can't be found at all is orphaned.
 */
export const recomputeStale = (segmentation: GistSegment[], sections: Section[]): StaleResult => {
  const all = flattenGistSegments(sections);
  const byId = new Map(all.map((s) => [s.id, s]));
  const staleIds: string[] = [];
  const orphanIds: string[] = [];
  for (const seg of segmentation) {
    const cur = relocate(seg, byId, all);
    if (!cur) {
      orphanIds.push(seg.id);
      continue;
    }
    if (computeHash(normalizeForHash(cur.text)) !== seg.sourceHash) staleIds.push(seg.id);
  }
  return { staleIds, orphanIds };
};

// ─────────────────────────── budgets & fit ──────────────────────────────

export interface PanelMetrics {
  contentW: number;
  contentH: number;
  lineHeightPx: number;
  avgGlyphPx: number;
}

/**
 * Measured word budget for one generation (design §6.1). `fine`/`total` is the hard
 * cap fit is computed against; `target` is where the fine grain aims; coarse is a
 * tighter fallback and g0 is a fixed one-sentence cap. All inherently-fitting grains
 * (coarse, g0) are smaller than fine by construction.
 */
export const computeBudgets = (m: PanelMetrics): GistBudgets => {
  const linesAvailable = Math.max(1, Math.floor(m.contentH / Math.max(1, m.lineHeightPx)));
  const charsPerLine = Math.max(1, Math.floor(m.contentW / Math.max(1, m.avgGlyphPx)));
  const capacityChars = linesAvailable * charsPerLine * 0.92; // rag + paragraph-break loss
  const total = Math.max(40, Math.floor(capacityChars / 6.5)); // avg English word + space
  return {
    total,
    target: Math.floor(total * 0.88),
    fine: total,
    coarse: Math.max(24, Math.floor(total * 0.5)),
    g0: 40,
  };
};

/** Per-segment word budgets from the analysis weights (design §6.1), trimmed to target. */
export const perSegmentBudgets = (
  weights: { id: string; weight: number }[],
  target: number,
): Record<string, number> => {
  const sum = weights.reduce((a, w) => a + Math.max(1, w.weight), 0) || 1;
  const raw = weights.map((w) => ({ id: w.id, b: Math.max(8, Math.round((target * Math.max(1, w.weight)) / sum)) }));
  const totalB = raw.reduce((a, r) => a + r.b, 0);
  if (totalB > target && totalB > 0) {
    const scale = target / totalB;
    for (const r of raw) r.b = Math.max(8, Math.floor(r.b * scale));
  }
  const out: Record<string, number> = {};
  for (const r of raw) out[r.id] = r.b;
  return out;
};

/** The spans of a grain (g0 collapses to a single 'thesis' span). */
export const spansForGrain = (gist: StoredGist, grain: GistGrain): GistSpan[] =>
  grain === 'g0' ? [{ id: 'thesis', text: gist.g0 }] : grain === 'coarse' ? gist.coarse : gist.fine;

/** Concatenate spans into the continuous prose a grain reads as. */
export const joinSpans = (spans: GistSpan[]): string => spans.map((s) => s.text).join(' ');

/** Plain text of a grain (for fit measurement + word count). */
export const grainText = (gist: StoredGist, grain: GistGrain): string => joinSpans(spansForGrain(gist, grain));

/**
 * Choose the finest grain whose RENDERED height fits (design §6.2). `measure` is
 * supplied by the hook (an offscreen twin of the prose node); fit is verified
 * empirically, never trusted from word count. g0 is the terminal fallback.
 */
export const chooseGrain = (
  gist: StoredGist,
  measure: (text: string) => number,
  availableHeight: number,
): GistGrain => {
  const order: GistGrain[] = ['fine', 'coarse', 'g0'];
  for (const g of order) {
    if (measure(grainText(gist, g)) <= availableHeight) return g;
  }
  return 'g0';
};

// ───────────────────────── validation gates (§8) ────────────────────────

/**
 * Reporting FRAMES the gist must never use (Prompt B Rule 1). The scan targets
 * third-person reporting registers — never first-person uses ("I argue" is correct),
 * which these patterns cannot match by construction.
 */
export const BANNED_FRAMES: RegExp[] = [
  /\bthe author\b/i,
  /\bthis (section|chapter|paper|essay|dissertation|thesis|article)\b/i,
  /\bthe (section|chapter|paper|essay)\b/i,
  /\bhere we see\b/i,
  /\bis (presented|argued that|discussed|examined|explored|outlined|surveyed)\b/i,
  /\b(discusses|explores|examines|delves|outlines|highlights|considers|surveys)\b/i,
];

/** Return the banned reporting frames found in `text` (empty = clean). */
export const scanBannedFrames = (text: string): string[] => {
  const hits: string[] = [];
  for (const re of BANNED_FRAMES) {
    const m = text.match(re);
    if (m) hits.push(m[0].toLowerCase());
  }
  return hits;
};

export interface GistValidation {
  ok: boolean;
  /** Human-readable failure reasons, appended to the one corrective retry prompt. */
  reasons: string[];
}

const SPAN_TOLERANCE = 1.15; // per-span ±15%; the grain total is a hard cap

/**
 * App-side validation before any swap (design §8): JSON shape, every segment id
 * present exactly once per grain, word caps, and the banned-frame scan. Returns the
 * reasons so the caller can do one automatic retry with them appended.
 */
export const validateGist = (
  composition: { g0: string; coarse: GistSpan[]; fine: GistSpan[] },
  ids: { coarse: string[]; fine: string[] },
  budgets: GistBudgets,
): GistValidation => {
  const reasons: string[] = [];

  const checkCoverage = (label: string, spans: GistSpan[], expected: string[]) => {
    const seen = new Set<string>();
    for (const sp of spans) {
      if (!sp.text || !sp.text.trim()) reasons.push(`${label}: empty span for "${sp.id}".`);
      if (seen.has(sp.id)) reasons.push(`${label}: duplicate span for "${sp.id}".`);
      seen.add(sp.id);
    }
    for (const id of expected) if (!seen.has(id)) reasons.push(`${label}: missing span for "${id}".`);
  };

  checkCoverage('coarse', composition.coarse, ids.coarse);
  checkCoverage('fine', composition.fine, ids.fine);

  if (countWords(composition.g0) > budgets.g0) reasons.push(`g0 exceeds ${budgets.g0}-word cap.`);
  if (countWords(joinSpans(composition.coarse)) > budgets.coarse) reasons.push(`coarse exceeds ${budgets.coarse}-word cap.`);
  if (countWords(joinSpans(composition.fine)) > budgets.fine) reasons.push(`fine exceeds ${budgets.fine}-word cap.`);

  const allText = [composition.g0, joinSpans(composition.coarse), joinSpans(composition.fine)].join(' ');
  const frames = scanBannedFrames(allText);
  if (frames.length) reasons.push(`banned reporting frames present: ${[...new Set(frames)].join(', ')}.`);

  return { ok: reasons.length === 0, reasons };
};

/** Per-span budget overrun (advisory, ±15%) — used by the re-fit decision, not the gate. */
export const spanOverBudget = (span: GistSpan, budget: number): boolean =>
  countWords(span.text) > Math.ceil(budget * SPAN_TOLERANCE);

// ─────────────────── voice-chip "describing" anti-pattern ───────────────

const DESCRIBE_VERB: Record<GistMove, string> = {
  define: 'defines', distinguish: 'distinguishes', assert: 'asserts', argue: 'argues',
  object: 'raises an objection to', reply: 'replies to', concede: 'concedes',
  exemplify: 'illustrates', reframe: 'reframes', survey: 'reviews', setup: 'introduces', conclude: 'concludes',
};

/**
 * Synthesize the DESCRIBING anti-pattern for the didactic voice chip — the register
 * the author cannot hold ("This section examines…"). Assembled app-side from the
 * analysis + heading titles; NEVER persisted and NEVER sent to the model.
 */
export const synthesizeDescribeSpans = (
  items: { id: string; title: string; analysis?: GistSegmentAnalysis }[],
): GistSpan[] =>
  items.map((it, i) => {
    const verb = it.analysis ? DESCRIBE_VERB[it.analysis.move] ?? 'discusses' : 'discusses';
    const topic = it.analysis?.anchor_terms?.[0] ?? it.title;
    const subject = i === 0 ? 'This section' : `Section ${i}`;
    return { id: it.id, text: `${subject} ${verb} ${topic.toLowerCase()}.` };
  });

/** The describing g0 — a conventional abstract opener, deliberately decontextualized. */
export const describeG0 = (thesis: string): string => {
  const core = (thesis || 'its central topic').replace(/^["']|["']$/g, '').replace(/\.$/, '');
  return `This document discusses ${core.charAt(0).toLowerCase()}${core.slice(1)}, and outlines its argument.`;
};
