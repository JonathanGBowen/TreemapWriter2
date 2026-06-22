import { describe, it, expect } from 'vitest';
import type { SessionRecord } from '../../../types';
import {
  accumulatedTotals,
  perNodeProgress,
  sessionDay,
  wordsOverTime,
} from '../dashboardData';

function rec(partial: Partial<SessionRecord> & { id: string }): SessionRecord {
  return {
    startTag: `session/${partial.id}/start`,
    endTag: `session/${partial.id}/end`,
    goal: { wish: 'w', outcome: null, obstacle: null, plan: null },
    steps: [],
    carryForward: [],
    reflection: null,
    wordDelta: 0,
    wordDeltaByNode: {},
    nodesModified: [],
    commitmentLevel: null,
    durationMinutes: 0,
    source: 'manual',
    ...partial,
  };
}

describe('dashboardData', () => {
  it('sums totals and counts sessions', () => {
    const sessions = [
      rec({ id: '2026-06-20T09-00-00', wordDelta: 100, durationMinutes: 30 }),
      rec({ id: '2026-06-21T09-00-00', wordDelta: -20, durationMinutes: 90 }),
    ];
    const t = accumulatedTotals(sessions);
    expect(t.totalWordDelta).toBe(80);
    expect(t.sessionCount).toBe(2);
    expect(t.totalHours).toBeCloseTo(2);
    expect(t.firstSessionDay).toBe('2026-06-20');
  });

  it('aggregates per-node words and touch counts', () => {
    const sessions = [
      rec({ id: '2026-06-20T09-00-00', wordDeltaByNode: { a: 100, b: 10 }, nodesModified: ['a', 'b'] }),
      rec({ id: '2026-06-21T09-00-00', wordDeltaByNode: { a: 50 }, nodesModified: ['a'] }),
    ];
    const nodes = perNodeProgress(sessions);
    expect(nodes[0]).toEqual({ nodeId: 'a', words: 150, sessions: 2 });
    expect(nodes.find((n) => n.nodeId === 'b')).toEqual({ nodeId: 'b', words: 10, sessions: 1 });
  });

  it('builds a cumulative day series oldest-first', () => {
    const sessions = [
      rec({ id: '2026-06-21T14-00-00', wordDelta: 30 }),
      rec({ id: '2026-06-20T09-00-00', wordDelta: 100 }),
      rec({ id: '2026-06-20T15-00-00', wordDelta: 20 }),
    ];
    const series = wordsOverTime(sessions);
    expect(series).toEqual([
      { day: '2026-06-20', cumulative: 120 },
      { day: '2026-06-21', cumulative: 150 },
    ]);
  });

  it('extracts the calendar day from a session id', () => {
    expect(sessionDay('2026-06-21T09-15-00')).toBe('2026-06-21');
  });
});
