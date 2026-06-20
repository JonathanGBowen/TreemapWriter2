// Pure helpers for the Version Compare workspace. No React, no store, no SDK —
// the comparison provider and the UI both lean on these so they stay thin and
// testable. Section alignment is by HEADING TITLE (not the fragile slug id), so
// it survives renames/reorders that would break id-based matching.

import type { Change } from 'diff';
import type {
  ComparisonChange,
  ComparisonDirection,
  ComparisonReceipt,
  OpenThread,
  SectionComparisonNote,
  Snapshot,
  SnapshotMeta,
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

const toOpenThreads = (v: unknown): OpenThread[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          summary: toStr(x.summary),
          ...(toStr(x.location) ? { location: toStr(x.location) } : {}),
        }))
        .filter((t) => t.summary)
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
  const openThreads = toOpenThreads(data.openThreads);

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
    ...(openThreads.length ? { openThreads } : {}),
    ...(lensName ? { lensName } : {}),
  };
};

// --- day grouping for the version picker -----------------------------------
// Frequent autosaves make raw history noisy. We coarsen it for the picker using
// ONLY cheap metadata (timestamp + trigger): group by local calendar day, and
// per day surface the "start of day" plus the meaningful checkpoints (manual /
// pre-ai-write), folding routine autosaves away (unless `showAll`).

export interface DaySnapshotOption {
  id: string;
  /** "Start of day", or a time-of-day (optionally tagged with the save type). */
  label: string;
  trigger: string;
  isDayStart: boolean;
}

export interface DayGroup {
  /** Local YYYY-MM-DD key. */
  dateKey: string;
  /** Human day label: "Today", "Yesterday", or e.g. "Jun 15". */
  dayLabel: string;
  /** The day's earliest snapshot id — its "start of day" reference. */
  startId: string;
  options: DaySnapshotOption[];
}

const CHECKPOINT_TRIGGERS = new Set(['manual', 'pre-ai-write']);

const dateKeyOf = (ts: number): string => {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const timeLabelOf = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const triggerTag = (trigger: string): string =>
  trigger === 'manual' ? 'manual' : trigger === 'pre-ai-write' ? 'pre-AI' : '';

const dayLabelOf = (dateKey: string, now: number): string => {
  if (dateKey === dateKeyOf(now)) return 'Today';
  if (dateKey === dateKeyOf(now - 86400000)) return 'Yesterday';
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Group snapshot metadata into day buckets (newest day first) for the picker.
 * Each day lists its "Start of day" first, then — by default — only the
 * meaningful checkpoints; `showAll` reveals every save. Consecutive saves with
 * an identical tree (`contentHash`) collapse to one.
 */
export const groupSnapshotsByDay = (
  metas: SnapshotMeta[],
  opts: { showAll?: boolean; now?: number } = {},
): DayGroup[] => {
  const now = opts.now ?? Date.now();
  const sorted = [...metas].sort((a, b) => b.timestamp - a.timestamp); // newest first

  const byDay = new Map<string, SnapshotMeta[]>();
  for (const m of sorted) {
    const key = dateKeyOf(m.timestamp);
    const arr = byDay.get(key);
    if (arr) arr.push(m);
    else byDay.set(key, [m]);
  }

  const groups: DayGroup[] = [];
  for (const [dateKey, daySnaps] of byDay) {
    // daySnaps is newest-first; the earliest (last) is the day's start.
    const start = daySnaps[daySnaps.length - 1];

    // Collapse consecutive identical trees. Walk chronologically so "consecutive"
    // means "adjacent in time".
    const deduped: SnapshotMeta[] = [];
    let prevHash: string | null = null;
    for (let i = daySnaps.length - 1; i >= 0; i--) {
      const m = daySnaps[i];
      if (m.contentHash && m.contentHash === prevHash) continue;
      prevHash = m.contentHash;
      deduped.push(m);
    }
    deduped.reverse(); // back to newest-first for display

    const options: DaySnapshotOption[] = [
      { id: start.id, label: 'Start of day', trigger: start.trigger, isDayStart: true },
    ];
    for (const m of deduped) {
      if (m.id === start.id) continue;
      if (!opts.showAll && !CHECKPOINT_TRIGGERS.has(m.trigger)) continue;
      const tag = triggerTag(m.trigger);
      options.push({
        id: m.id,
        label: tag ? `${timeLabelOf(m.timestamp)} · ${tag}` : timeLabelOf(m.timestamp),
        trigger: m.trigger,
        isDayStart: false,
      });
    }

    groups.push({ dateKey, dayLabel: dayLabelOf(dateKey, now), startId: start.id, options });
  }
  return groups;
};

// --- operand resolution -----------------------------------------------------

export interface CompareOperand {
  markdown: string;
  label: string;
}

/**
 * Resolve a selected version ref to its content + label. `'current'`/null is the
 * live draft (`localContent`). A snapshot ref resolves only once its full
 * content has been lazily loaded (`loaded.id === ref`); until then this returns
 * null and the UI shows a brief loading state.
 */
export const resolveOperand = (
  ref: string | null,
  loaded: Snapshot | null,
  localContent: string,
): CompareOperand | null => {
  if (ref === 'current' || ref === null) return { markdown: localContent, label: 'Current Draft' };
  if (loaded && loaded.id === ref) {
    return { markdown: loaded.markdown, label: new Date(loaded.timestamp).toLocaleString() };
  }
  return null;
};

// --- aligned (side-by-side) diff projection ---------------------------------

/** One side of an aligned diff row. `null` is a blank gutter (no line here). */
export type DiffCell = { text: string; kind: 'unchanged' | 'added' | 'removed' } | null;

/** A row of the parallel viewer: the A line (left) beside the B line (right). */
export interface DiffRow {
  left: DiffCell;
  right: DiffCell;
}

/** Split a line-diff part's value into lines, dropping the trailing newline's
 *  empty tail so each line "owns" its break (middle blank lines are kept). */
const splitLines = (value: string): string[] => {
  const lines = value.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
};

/**
 * Turn a *line-level* diff (`diffLines` output) into row-aligned cells for the
 * parallel viewer. Unchanged lines sit on both sides of the same row; a run of
 * removed lines pairs row-for-row with the following run of added lines (a
 * replacement), and whichever side runs out gets blank gutters — so additions
 * leave space on the left, removals leave space on the right, and unchanged text
 * always lines up exactly. Pure: takes a `Change[]`, returns rows.
 */
export const buildAlignedRows = (changes: Change[]): DiffRow[] => {
  const rows: DiffRow[] = [];
  let removed: string[] = [];
  let added: string[] = [];

  const flush = () => {
    const n = Math.max(removed.length, added.length);
    for (let i = 0; i < n; i++) {
      rows.push({
        left: i < removed.length ? { text: removed[i], kind: 'removed' } : null,
        right: i < added.length ? { text: added[i], kind: 'added' } : null,
      });
    }
    removed = [];
    added = [];
  };

  for (const part of changes) {
    if (part.removed) {
      removed.push(...splitLines(part.value));
    } else if (part.added) {
      added.push(...splitLines(part.value));
    } else {
      flush();
      for (const text of splitLines(part.value)) {
        rows.push({ left: { text, kind: 'unchanged' }, right: { text, kind: 'unchanged' } });
      }
    }
  }
  flush();
  return rows;
};
