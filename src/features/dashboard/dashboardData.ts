import type { SessionRecord } from '../../types';

/**
 * Pure aggregations over the session log for the Progress Dashboard. No React,
 * no store — unit-testable. Everything here is *observation*, never evaluation:
 * sums and trajectories, no rates, targets, streaks, or comparisons.
 */

/** The calendar-day portion (YYYY-MM-DD) of a session id. */
export function sessionDay(id: string): string {
  return id.slice(0, 10);
}

/** Parse a session id (`YYYY-MM-DDTHH-MM-SS`) back to a Date. */
export function sessionDate(id: string): Date {
  const day = id.slice(0, 10);
  const time = id.slice(11).replace(/-/g, ':');
  const iso = time ? `${day}T${time}` : day;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(day) : d;
}

export interface AccumulatedTotals {
  totalWordDelta: number;
  last30WordDelta: number;
  sessionCount: number;
  totalHours: number;
  firstSessionDay: string | null;
}

export function accumulatedTotals(sessions: SessionRecord[]): AccumulatedTotals {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let total = 0;
  let last30 = 0;
  let minutes = 0;
  let firstDay: string | null = null;
  for (const s of sessions) {
    total += s.wordDelta;
    minutes += s.durationMinutes;
    if (sessionDate(s.id).getTime() >= cutoff) last30 += s.wordDelta;
    const day = sessionDay(s.id);
    if (firstDay === null || day < firstDay) firstDay = day;
  }
  return {
    totalWordDelta: total,
    last30WordDelta: last30,
    sessionCount: sessions.length,
    totalHours: minutes / 60,
    firstSessionDay: firstDay,
  };
}

export interface NodeProgress {
  nodeId: string;
  words: number;
  sessions: number;
}

/**
 * Cumulative word delta and session-touch count per treemap node, summed across
 * the log. Sorted by absolute words (most-worked first). A node id that no
 * longer exists in the document is still reported (resolved to its id).
 */
export function perNodeProgress(sessions: SessionRecord[]): NodeProgress[] {
  const words = new Map<string, number>();
  const touches = new Map<string, number>();
  for (const s of sessions) {
    for (const [nodeId, delta] of Object.entries(s.wordDeltaByNode)) {
      words.set(nodeId, (words.get(nodeId) ?? 0) + delta);
    }
    for (const nodeId of s.nodesModified) {
      touches.set(nodeId, (touches.get(nodeId) ?? 0) + 1);
    }
  }
  const ids = new Set([...words.keys(), ...touches.keys()]);
  return [...ids]
    .map((nodeId) => ({
      nodeId,
      words: words.get(nodeId) ?? 0,
      sessions: touches.get(nodeId) ?? 0,
    }))
    .sort((a, b) => Math.abs(b.words) - Math.abs(a.words));
}

export interface DayPoint {
  day: string;
  cumulative: number;
}

/**
 * Cumulative net word delta by calendar day, oldest → newest. The dashboard
 * draws this as the observed trajectory — no goal line, no target overlay.
 */
export function wordsOverTime(sessions: SessionRecord[]): DayPoint[] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const day = sessionDay(s.id);
    byDay.set(day, (byDay.get(day) ?? 0) + s.wordDelta);
  }
  const days = [...byDay.keys()].sort();
  let running = 0;
  return days.map((day) => {
    running += byDay.get(day) ?? 0;
    return { day, cumulative: running };
  });
}
