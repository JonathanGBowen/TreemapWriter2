// Pure helpers for the Version Compare workspace. No React, no store, no SDK —
// the comparison provider and the UI both lean on these so they stay thin and
// testable. Section alignment is by HEADING TITLE (not the fragile slug id), so
// it survives renames/reorders that would break id-based matching.

import type {
  ComparisonChange,
  ComparisonDirection,
  ComparisonReceipt,
  SectionComparisonNote,
  VersionComparison,
} from '../types';

const HEADING_RE = /^(#{1,6})\s+(.*\S)\s*$/;

export interface Heading {
  title: string;
  level: number;
}

/** Extract markdown ATX headings (title + level), in document order. */
export const extractHeadings = (md: string): Heading[] => {
  const out: Heading[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(HEADING_RE);
    if (m) out.push({ level: m[1].length, title: m[2].trim() });
  }
  return out;
};

export interface TitleAlignment {
  title: string;
  presentInA: boolean;
  presentInB: boolean;
}

/**
 * Align the two versions' sections by heading title. Returns the union of
 * titles — A's order first, then B-only titles — each flagged with which side
 * it appears on. Duplicate titles within a version collapse to one entry; the
 * scaffold only needs to know which titles align, not how many times.
 */
export const alignByTitle = (mdA: string, mdB: string): TitleAlignment[] => {
  const titlesA = extractHeadings(mdA).map((h) => h.title);
  const titlesB = extractHeadings(mdB).map((h) => h.title);
  const setA = new Set(titlesA);
  const setB = new Set(titlesB);

  const out: TitleAlignment[] = [];
  const seen = new Set<string>();
  for (const title of [...titlesA, ...titlesB]) {
    if (seen.has(title)) continue;
    seen.add(title);
    out.push({ title, presentInA: setA.has(title), presentInB: setB.has(title) });
  }
  return out;
};

/** Titles present in BOTH versions — the directly comparable sections. */
export const sharedTitles = (mdA: string, mdB: string): string[] =>
  alignByTitle(mdA, mdB)
    .filter((t) => t.presentInA && t.presentInB)
    .map((t) => t.title);

// --- response normalization ------------------------------------------------

const DIRECTIONS: ComparisonDirection[] = ['improved', 'regressed', 'mixed', 'lateral'];

const toStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const toDirection = (v: unknown): ComparisonDirection =>
  DIRECTIONS.includes(v as ComparisonDirection) ? (v as ComparisonDirection) : 'lateral';

const toReceipts = (v: unknown): ComparisonReceipt[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({ quote: toStr(x.quote), side: x.side === 'b' ? ('b' as const) : ('a' as const) }))
        .filter((r) => r.quote)
    : [];

const toChanges = (v: unknown): ComparisonChange[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          summary: toStr(x.summary),
          ...(toStr(x.aspect) ? { aspect: toStr(x.aspect) } : {}),
          receipts: toReceipts(x.receipts),
        }))
        .filter((c) => c.summary)
    : [];

const toSectionNotes = (v: unknown): SectionComparisonNote[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          sectionTitle: toStr(x.sectionTitle),
          // Default to present on both sides unless explicitly told otherwise.
          presentInA: x.presentInA !== false,
          presentInB: x.presentInB !== false,
          direction: toDirection(x.direction),
          note: toStr(x.note),
        }))
        .filter((n) => n.sectionTitle && n.note)
    : [];

/**
 * Tolerant validator for the model's comparison JSON. Missing arrays become
 * empty; an invalid direction falls back to 'lateral'. Returns null when there
 * is nothing usable (no verdict, no drift, and no findings) — the signal of a
 * junk response, which the caller surfaces as a parse error.
 */
export const normalizeComparison = (
  raw: unknown,
  lensName?: string,
): VersionComparison | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const verdict = toStr(data.verdict);
  const conceptualDrift = toStr(data.conceptualDrift);
  const improvements = toChanges(data.improvements);
  const losses = toChanges(data.losses);
  const moveChanges = toChanges(data.moveChanges);
  const sectionNotes = toSectionNotes(data.sectionNotes);

  if (!verdict && !conceptualDrift && !improvements.length && !losses.length && !moveChanges.length) {
    return null;
  }

  return {
    direction: toDirection(data.direction),
    verdict,
    conceptualDrift,
    improvements,
    losses,
    moveChanges,
    sectionNotes,
    ...(lensName ? { lensName } : {}),
  };
};
