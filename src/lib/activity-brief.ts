// The activity brief — a bounded, deterministic RECENT ACTIVITY record composed
// from the canonical sources the app already keeps (session records; git
// snapshot metadata). No AI call, no network: derived context is computed fresh,
// never remembered (docs/dialogue-design.md §III). Word deltas render as
// approximate magnitude (lib/magnitude.ts ethos) — orientation, never a report
// to read. Pure and injectable (`now` is a parameter) → unit-testable.

import type { SessionRecord, SnapshotMeta } from '../types';
import type { ReinstateFragment } from './reinstate';
import { roundedCount } from './magnitude';

/** Hard cap on the composed brief — fuel for a prompt, not a document. */
export const ACTIVITY_BRIEF_CAP = 1200;

export interface ActivityBriefInput {
  /** All recorded sessions, newest first (the `listSessions` order). */
  sessions: SessionRecord[];
  /** Recent snapshot metadata, newest first (the `listSnapshotMeta` order). */
  snapshots: SnapshotMeta[];
  /** Injected clock (ms epoch). */
  now: number;
}

/** Parse a session id ("2026-06-21T09-15-00") back to its UTC start ms, or null. */
export function sessionStartMs(id: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(id)) return null;
  const iso = `${id.slice(0, 10)}T${id.slice(11).replace(/-/g, ':')}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

const DAY_MS = 86_400_000;

/** Coarse recency in words — a band, not a timestamp (zones of indifference). */
export function whenLabel(now: number, ts: number): string {
  const days = Math.floor(Math.max(0, now - ts) / DAY_MS);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} weeks ago`;
}

/** "+~400" / "-~1.2k" / "±0" — signed approximate magnitude. */
const signedDelta = (delta: number): string =>
  delta === 0 ? '±0' : `${delta > 0 ? '+' : '-'}${roundedCount(Math.abs(delta))}`;

const endedSessions = (sessions: SessionRecord[]): SessionRecord[] =>
  sessions.filter((s) => s.endTag !== null);

/**
 * The LAST checked-out session's carry-forward (null when it captured none —
 * an older session's unfinished items are presumed resolved or stale), each
 * item resolved to its step description. The app's own gap-capture, finally
 * re-surfaced (STATUS: "surface last session's carry-forward").
 */
export function latestCarryForward(
  sessions: SessionRecord[],
): { session: SessionRecord; items: { stepDescription: string; nextAction: string }[] } | null {
  const last = endedSessions(sessions)[0];
  if (!last || last.carryForward.length === 0) return null;
  const items = last.carryForward.map((c) => ({
    stepDescription: last.steps.find((st) => st.id === c.stepId)?.description ?? '',
    nextAction: c.nextAction,
  }));
  return { session: last, items };
}

/** Carry-forward as reinstatement fragments (the `reinstate.ts` seam). */
export function carryForwardFragments(sessions: SessionRecord[]): ReinstateFragment[] {
  const carry = latestCarryForward(sessions);
  if (!carry) return [];
  return carry.items.map((c) => ({
    source: 'carried forward',
    text: c.stepDescription ? `${c.nextAction} (${c.stepDescription})` : c.nextAction,
  }));
}

/**
 * Compose the brief, or null when there is nothing to report. Line order is
 * priority order — the cap drops from the tail, never the head.
 */
export function buildActivityBrief(input: ActivityBriefInput): string | null {
  const { now } = input;
  const ended = endedSessions(input.sessions);
  const snapshots = input.snapshots;
  if (ended.length === 0 && snapshots.length === 0) return null;

  const lines: string[] = [];

  // Most recent touch, whichever record carries it. The session's check-OUT is
  // its start + duration — using the start would count in-session snapshots as
  // later, unsessioned work.
  const lastSnapMs = snapshots[0]?.timestamp ?? null;
  const lastSessionStartMs = ended[0] ? sessionStartMs(ended[0].id) : null;
  const lastSessionEndMs =
    lastSessionStartMs !== null ? lastSessionStartMs + (ended[0]?.durationMinutes ?? 0) * 60_000 : null;
  const lastTouch = Math.max(lastSnapMs ?? 0, lastSessionEndMs ?? 0);
  if (lastTouch > 0) lines.push(`- last touched: ${whenLabel(now, lastTouch)}`);

  // The last sitting, in full; up to two earlier ones, compressed.
  ended.slice(0, 3).forEach((s, i) => {
    const startMs = sessionStartMs(s.id);
    const when = startMs ? ` (${whenLabel(now, startMs)})` : '';
    const steps = s.steps.length
      ? `, ${s.steps.filter((st) => st.completed).length}/${s.steps.length} steps`
      : '';
    const minutes = s.durationMinutes > 0 ? `, ${s.durationMinutes} min` : '';
    lines.push(
      i === 0
        ? `- last sitting${when}: "${s.goal.wish}" — ${signedDelta(s.wordDelta)} words${steps}${minutes}`
        : `- earlier${when}: "${s.goal.wish}" — ${signedDelta(s.wordDelta)} words`,
    );
    if (i === 0) {
      for (const c of s.carryForward) {
        const step = s.steps.find((st) => st.id === c.stepId)?.description;
        lines.push(`- unfinished → next: "${c.nextAction}"${step ? ` (step: ${step})` : ''}`);
      }
      if (s.goal.obstacle) lines.push(`- named obstacle last sitting: ${s.goal.obstacle}`);
    }
  });

  // Work outside the session ceremony: snapshots after the last check-out.
  const lastEndMs = lastSessionEndMs;
  const since = lastEndMs ? snapshots.filter((m) => m.timestamp > lastEndMs) : snapshots;
  if (since.length > 0) {
    const latest = since[0];
    const label = lastEndMs ? 'since last check-out' : 'recent snapshots';
    lines.push(
      `- ${label}: ${since.length} snapshot${since.length === 1 ? '' : 's'} (latest: "${latest.message}")`,
    );
  }

  // Cap from the tail — the head lines carry the orientation.
  const out: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > ACTIVITY_BRIEF_CAP) break;
    out.push(line);
    used += line.length + 1;
  }
  return out.length > 0 ? out.join('\n') : null;
}
