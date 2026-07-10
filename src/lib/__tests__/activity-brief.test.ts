import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_BRIEF_CAP,
  buildActivityBrief,
  carryForwardFragments,
  latestCarryForward,
  sessionStartMs,
  whenLabel,
} from '../activity-brief';
import type { SessionRecord, SnapshotMeta } from '../../types';

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-10T12:00:00Z');

const session = (over: Partial<SessionRecord> & { id: string }): SessionRecord => ({
  startTag: `session/${over.id}/start`,
  endTag: `session/${over.id}/end`,
  goal: { wish: 'Draft the methods opening', outcome: null, obstacle: null, plan: null },
  steps: [],
  carryForward: [],
  reflection: null,
  wordDelta: 412,
  wordDeltaByNode: {},
  nodesModified: [],
  commitmentLevel: null,
  durationMinutes: 42,
  source: 'manual',
  ...over,
});

const snap = (ts: number, message: string): SnapshotMeta => ({
  id: `s${ts}`,
  timestamp: ts,
  trigger: 'manual',
  affectedScope: 'all',
  contentHash: 'h',
  message,
});

describe('sessionStartMs', () => {
  it('parses the hyphenated ISO session id back to UTC ms', () => {
    expect(sessionStartMs('2026-07-06T09-15-00')).toBe(Date.parse('2026-07-06T09:15:00Z'));
  });
  it('returns null on malformed ids', () => {
    expect(sessionStartMs('not-a-session')).toBeNull();
  });
});

describe('whenLabel', () => {
  it('uses coarse bands, not timestamps', () => {
    expect(whenLabel(NOW, NOW - 2 * 3600_000)).toBe('today');
    expect(whenLabel(NOW, NOW - DAY)).toBe('yesterday');
    expect(whenLabel(NOW, NOW - 4 * DAY)).toBe('4 days ago');
    expect(whenLabel(NOW, NOW - 21 * DAY)).toBe('3 weeks ago');
  });
});

describe('buildActivityBrief', () => {
  it('returns null when there is nothing to report', () => {
    expect(buildActivityBrief({ sessions: [], snapshots: [], now: NOW })).toBeNull();
  });

  it('ignores a still-running session (no endTag)', () => {
    const running = session({ id: '2026-07-10T08-00-00', endTag: null });
    expect(buildActivityBrief({ sessions: [running], snapshots: [], now: NOW })).toBeNull();
  });

  it('leads with last-touched and renders the last sitting with approximate magnitude', () => {
    const s = session({
      id: '2026-07-06T09-15-00',
      steps: [
        { id: 'a', description: 'Outline the moves', estimatedMinutes: null, completed: true, implementationIntention: null },
        { id: 'b', description: 'Stitch them together', estimatedMinutes: null, completed: false, implementationIntention: null },
      ],
      carryForward: [{ stepId: 'b', nextAction: 'Start from the transition sentence' }],
    });
    const brief = buildActivityBrief({ sessions: [s], snapshots: [], now: NOW });
    expect(brief).toContain('- last touched: 4 days ago');
    expect(brief).toContain('"Draft the methods opening" — +~400 words, 1/2 steps, 42 min');
    expect(brief).toContain('- unfinished → next: "Start from the transition sentence" (step: Stitch them together)');
    expect(brief).not.toContain('412'); // approximate magnitude, never the exact figure
  });

  it('counts snapshots after the last check-out as unsessioned work', () => {
    const s = session({ id: '2026-07-06T09-15-00' });
    const later = snap(Date.parse('2026-07-08T10:00:00Z'), 'polish transitions');
    const earlier = snap(Date.parse('2026-07-05T10:00:00Z'), 'inside the session');
    const brief = buildActivityBrief({ sessions: [s], snapshots: [later, earlier], now: NOW });
    expect(brief).toContain('- since last check-out: 1 snapshot (latest: "polish transitions")');
  });

  it('stays under the cap', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      session({
        id: `2026-06-${String((i % 28) + 1).padStart(2, '0')}T09-15-00`,
        goal: { wish: 'w'.repeat(120), outcome: null, obstacle: null, plan: null },
      }),
    );
    const brief = buildActivityBrief({ sessions: many, snapshots: [], now: NOW });
    expect(brief).not.toBeNull();
    expect((brief as string).length).toBeLessThanOrEqual(ACTIVITY_BRIEF_CAP);
  });
});

describe('carry-forward helpers', () => {
  const withCarry = session({
    id: '2026-07-06T09-15-00',
    steps: [{ id: 'b', description: 'Stitch', estimatedMinutes: null, completed: false, implementationIntention: null }],
    carryForward: [{ stepId: 'b', nextAction: 'Start from the transition' }],
  });

  it('surfaces the most recent checked-out session with carry-forward', () => {
    const newerWithout = session({ id: '2026-07-08T09-15-00' });
    const got = latestCarryForward([newerWithout, withCarry]);
    // The newest ended session has no carry — nothing is owed.
    expect(got).toBeNull();
  });

  it('resolves step descriptions and builds reinstatement fragments', () => {
    const got = latestCarryForward([withCarry]);
    expect(got?.items).toEqual([{ stepDescription: 'Stitch', nextAction: 'Start from the transition' }]);
    expect(carryForwardFragments([withCarry])).toEqual([
      { source: 'carried forward', text: 'Start from the transition (Stitch)' },
    ]);
  });
});
