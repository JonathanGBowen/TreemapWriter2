// magnitude.ts — approximate magnitude rendering (docs/gestalt-design-IV.md C2).
//
// Wertheimer 1912 (§§8–10): a natural "number series" is not uniform steps but a graded
// mix of privileged relevance-levels with ZONES OF INDIFFERENCE — "a dozen" is a band,
// not exactly twelve — and exactness past the task's limit is "false and meaningless."
// On ORIENTATION surfaces (where the question is "how big is this, roughly?") an exact
// word count is false precision and, for an ADHD reader, noise. So we render magnitude
// as a Gestalt: either a prose band (a section / about a chapter) or a rounded figure.
//
// This does NOT replace exact counts where the TASK needs them (gist budget fit, charts,
// session word-deltas) — Wertheimer's own rule: exactness up to the limit of the task,
// and no further. Pure, no imports → unit-testable.

/** Privileged relevance-levels for academic prose. Each entry is `[maxWords, label]`:
 *  a half-open band `[prevMax, maxWords)` mapping to one label. The band IS the zone of
 *  indifference — counts inside it do not flip-flop. Tunable; ordered ascending. */
const BANDS: readonly [number, string][] = [
  [1, 'empty'],
  [75, 'a line or two'],
  [200, 'a paragraph'],
  [500, 'a few paragraphs'],
  [1200, 'a short section'],
  [3000, 'a section'],
  [6000, 'a long section'],
  [12000, 'about a chapter'],
];
const BEYOND = 'a long chapter';

/** Word count at which a section is large enough that disproportionate bulk is worth
 *  noting — the start of the "about a chapter" band. Shared with the C1 ballast signal
 *  (strain-metrics) so the two never disagree on "large." */
export const CHAPTER_WORDS = 6000;

/**
 * A magnitude as a prose Gestalt with privileged relevance-levels and zones of
 * indifference. For at-a-glance surfaces (treemap tiles, the SR mirror) — never where
 * the task needs the exact figure.
 */
export function magnitudeBand(words: number): { label: string } {
  const w = Number.isFinite(words) && words > 0 ? Math.floor(words) : 0;
  for (const [max, label] of BANDS) {
    if (w < max) return { label };
  }
  return { label: BEYOND };
}

/**
 * An approximate figure — a round number (Wertheimer's "round numbers"), to roughly one
 * or two significant figures — for compact meta where a phrase will not fit (e.g. the
 * sidebar row). "~400", "~1.9k", "~12k". Empty stays "0".
 */
export function roundedCount(words: number): string {
  const w = Number.isFinite(words) && words > 0 ? Math.floor(words) : 0;
  if (w === 0) return '0';
  if (w < 100) return `~${Math.max(10, Math.round(w / 10) * 10)}`;
  if (w < 1000) return `~${Math.round(w / 100) * 100}`;
  const k = w / 1000;
  if (k < 10) return `~${(Math.round(k * 10) / 10).toString()}k`;
  return `~${Math.round(k)}k`;
}
