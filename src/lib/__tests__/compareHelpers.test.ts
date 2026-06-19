import { describe, expect, it } from 'vitest';
import {
  alignByTitle,
  extractHeadings,
  groupSnapshotsByDay,
  normalizeComparison,
  resolveOperand,
  sharedTitles,
} from '../compareHelpers';
import type { Snapshot, SnapshotMeta } from '../../types';

const A = `# Intro
Some text.
## Method
More text.
## Results
Findings.`;

const B = `# Intro
Revised text.
## Method
Tighter text.
## Discussion
New section.`;

describe('extractHeadings', () => {
  it('pulls ATX headings with their levels, in order', () => {
    expect(extractHeadings(A)).toEqual([
      { title: 'Intro', level: 1 },
      { title: 'Method', level: 2 },
      { title: 'Results', level: 2 },
    ]);
  });

  it('ignores non-heading lines and trims trailing whitespace', () => {
    expect(extractHeadings('plain line\n##   Spaced   \ntext')).toEqual([
      { title: 'Spaced', level: 2 },
    ]);
  });

  it('returns [] for prose with no headings', () => {
    expect(extractHeadings('just a paragraph')).toEqual([]);
  });
});

describe('alignByTitle', () => {
  it('unions titles (A order first, then B-only) with presence flags', () => {
    expect(alignByTitle(A, B)).toEqual([
      { title: 'Intro', presentInA: true, presentInB: true },
      { title: 'Method', presentInA: true, presentInB: true },
      { title: 'Results', presentInA: true, presentInB: false },
      { title: 'Discussion', presentInA: false, presentInB: true },
    ]);
  });

  it('collapses duplicate titles within a version to one entry', () => {
    const dup = '# Same\n## Same\ntext';
    expect(alignByTitle(dup, dup)).toEqual([
      { title: 'Same', presentInA: true, presentInB: true },
    ]);
  });

  it('handles an empty side', () => {
    expect(alignByTitle('', B)).toEqual([
      { title: 'Intro', presentInA: false, presentInB: true },
      { title: 'Method', presentInA: false, presentInB: true },
      { title: 'Discussion', presentInA: false, presentInB: true },
    ]);
  });
});

describe('sharedTitles', () => {
  it('returns only titles present in both versions', () => {
    expect(sharedTitles(A, B)).toEqual(['Intro', 'Method']);
  });
});

describe('normalizeComparison', () => {
  const wellFormed = {
    direction: 'improved',
    verdict: 'B sharpens the central claim.',
    conceptualDrift: 'The thesis narrowed from two claims to one.',
    improvements: [
      { summary: 'Clearer thesis', aspect: 'mainClaim', receipts: [{ quote: 'B sentence', side: 'b' }] },
    ],
    losses: [],
    moveChanges: [],
    sectionNotes: [
      { sectionTitle: 'Intro', presentInA: true, presentInB: true, direction: 'improved', note: 'tighter' },
    ],
  };

  it('passes a well-formed payload through, attaching the lens name', () => {
    const r = normalizeComparison(wellFormed, 'Developmental Edit');
    expect(r).not.toBeNull();
    expect(r!.direction).toBe('improved');
    expect(r!.improvements[0].receipts[0].side).toBe('b');
    expect(r!.sectionNotes[0].sectionTitle).toBe('Intro');
    expect(r!.lensName).toBe('Developmental Edit');
  });

  it('falls back to a lateral direction when the value is invalid', () => {
    const r = normalizeComparison({ ...wellFormed, direction: 'wat' });
    expect(r!.direction).toBe('lateral');
  });

  it('drops malformed changes and receipts but keeps usable ones', () => {
    const r = normalizeComparison({
      ...wellFormed,
      improvements: [
        { summary: '', receipts: [] }, // dropped: no summary
        { summary: 'kept', receipts: [{ quote: '', side: 'a' }, { quote: 'ok', side: 'b' }] },
      ],
    });
    expect(r!.improvements).toHaveLength(1);
    expect(r!.improvements[0].summary).toBe('kept');
    expect(r!.improvements[0].receipts).toHaveLength(1);
  });

  it('returns null for junk with no findings', () => {
    expect(normalizeComparison({ verdict: '', improvements: [] })).toBeNull();
    expect(normalizeComparison(null)).toBeNull();
    expect(normalizeComparison('nope')).toBeNull();
  });

  it('defaults section presence to true unless explicitly false', () => {
    const r = normalizeComparison({
      ...wellFormed,
      sectionNotes: [{ sectionTitle: 'X', presentInB: false, direction: 'regressed', note: 'cut' }],
    });
    expect(r!.sectionNotes[0].presentInA).toBe(true);
    expect(r!.sectionNotes[0].presentInB).toBe(false);
  });

  it('keeps well-formed openThreads and drops empty-summary ones', () => {
    const r = normalizeComparison({
      ...wellFormed,
      openThreads: [
        { summary: 'Results section is still a stub', location: 'Results' },
        { summary: '' },
        { summary: 'Tie back to the intro claim' },
      ],
    });
    expect(r!.openThreads).toHaveLength(2);
    expect(r!.openThreads![0]).toEqual({ summary: 'Results section is still a stub', location: 'Results' });
    expect(r!.openThreads![1]).toEqual({ summary: 'Tie back to the intro claim' });
  });

  it('omits openThreads entirely when none are usable (the final-mode shape)', () => {
    const r = normalizeComparison(wellFormed);
    expect('openThreads' in r!).toBe(false);
    const r2 = normalizeComparison({ ...wellFormed, openThreads: [{ summary: '' }] });
    expect('openThreads' in r2!).toBe(false);
  });
});

describe('groupSnapshotsByDay', () => {
  // Fixed reference so "Today"/"Yesterday" are deterministic. Timestamps are
  // built with the local Date constructor to match the helper's local bucketing.
  const NOW = new Date(2026, 5, 17, 15, 0).getTime(); // Jun 17, 15:00 local
  const at = (day: number, h: number, m: number) => new Date(2026, 5, day, h, m).getTime();
  const mk = (id: string, ts: number, trigger: string, contentHash: string): SnapshotMeta => ({
    id, timestamp: ts, trigger, affectedScope: 'all', contentHash, message: '',
  });

  const metas: SnapshotMeta[] = [
    mk('a4', at(17, 12, 0), 'autosave', 'C'), // dup tree of a3 → collapses
    mk('a3', at(17, 11, 0), 'manual', 'C'),
    mk('a2', at(17, 10, 0), 'autosave', 'B'),
    mk('a1', at(17, 9, 0), 'autosave', 'A'), // start of today
    mk('b2', at(16, 16, 0), 'pre-ai-write', 'E'),
    mk('b1', at(16, 14, 0), 'autosave', 'D'), // start of yesterday
  ];

  it('buckets by day (newest first) with Today/Yesterday labels and day-start ids', () => {
    const groups = groupSnapshotsByDay(metas, { now: NOW });
    expect(groups.map((g) => g.dayLabel)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].startId).toBe('a1');
    expect(groups[1].startId).toBe('b1');
  });

  it('default mode shows start-of-day + checkpoints, folding routine autosaves', () => {
    const [today, yesterday] = groupSnapshotsByDay(metas, { now: NOW });
    // a1 (start) + a3 (manual). a2 (autosave) and a4 (dup) are folded away.
    expect(today.options.map((o) => o.id)).toEqual(['a1', 'a3']);
    expect(today.options[0].isDayStart).toBe(true);
    expect(today.options[1].label).toContain('manual');
    // b1 (start) + b2 (pre-ai-write).
    expect(yesterday.options.map((o) => o.id)).toEqual(['b1', 'b2']);
    expect(yesterday.options[1].label).toContain('pre-AI');
  });

  it('showAll reveals every save (still collapsing identical trees)', () => {
    const [today] = groupSnapshotsByDay(metas, { now: NOW, showAll: true });
    // a1 start, a3 manual, a2 autosave — a4 is dropped as a consecutive dup of a3.
    expect(today.options.map((o) => o.id)).toEqual(['a1', 'a3', 'a2']);
  });

  it('returns [] for empty history', () => {
    expect(groupSnapshotsByDay([], { now: NOW })).toEqual([]);
  });
});

describe('resolveOperand', () => {
  const snap = (id: string, markdown: string): Snapshot => ({
    id, timestamp: Date.UTC(2026, 5, 1), trigger: 'manual', affectedScope: 'all',
    contentHash: 'h', markdown, testSuite: {},
  });

  it("maps 'current' and null to the live draft", () => {
    expect(resolveOperand('current', null, 'LIVE')).toEqual({ markdown: 'LIVE', label: 'Current Draft' });
    expect(resolveOperand(null, null, 'LIVE')).toEqual({ markdown: 'LIVE', label: 'Current Draft' });
  });

  it('resolves a snapshot ref once its content has loaded', () => {
    const r = resolveOperand('s1', snap('s1', 'OLD'), 'LIVE');
    expect(r?.markdown).toBe('OLD');
    expect(r?.label).toBeTruthy();
  });

  it('returns null while the loaded snapshot does not match the ref (still loading)', () => {
    expect(resolveOperand('s2', null, 'LIVE')).toBeNull();
    expect(resolveOperand('s2', snap('s1', 'OLD'), 'LIVE')).toBeNull();
  });
});
