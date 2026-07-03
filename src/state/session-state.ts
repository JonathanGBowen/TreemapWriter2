import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { CommitTrailer } from '../services/repository';
import { repository as repo } from '../services/repository-registry';
import { isTauri } from '../services/tauri-environment';
import { countWords } from '../lib/utils';
import type { CarryForward, Section, SessionGoal, SessionRecord, SessionStep } from '../types';

/**
 * Session ceremony state — the lifecycle of a writing session and the read-only
 * Progress Dashboard that surfaces the accumulated record.
 *
 * "Invisible git, visible coaching": the thunks here bracket a session with a
 * pair of git tags (`session/<id>/start|end`) and a semantic end-commit, then
 * persist a `SessionRecord` sidecar — but the writer only ever sees the
 * coaching surface (the SessionModal) and the dashboard. Two paths create a
 * session: the standalone Start/End boundary and a completed Living Sprint.
 *
 * `activeSession` + the `sessionStart*` fields are ephemeral run-state (lost on
 * reload, fine); `sessionLog` is a projection of the on-disk records, reloaded
 * on demand. NOTHING here belongs in a persisted slice — the records are the
 * durable artifact, written via the Repository.
 */

/** A hyphenated, filename- and tag-safe ISO timestamp to the second. */
function sessionIdNow(): string {
  // 2026-06-21T09:15:00.000Z → 2026-06-21T09-15-00 (colons are invalid in tags).
  return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
}

/** Flatten the section tree to a `{ sectionId: wordCount }` map. */
function wordCountByNode(sections: Section[]): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      out[n.id] = n.wordCount;
      walk(n.children);
    }
  };
  walk(sections);
  return out;
}

export interface StartSessionInput {
  goal: SessionGoal;
  steps: SessionStep[];
  commitmentLevel?: number | null;
  source?: 'manual' | 'sprint';
}

export interface EndSessionInput {
  /** Ids of steps the writer marked done. */
  completedStepIds: string[];
  /** Next-action captures for incomplete steps (the Masicampo-Baumeister move). */
  carryForward: CarryForward[];
  reflection?: string | null;
}

export interface SessionSlice {
  /** The in-flight session, or null when none is running. */
  activeSession: SessionRecord | null;
  /** All recorded sessions for the open project, newest first. */
  sessionLog: SessionRecord[];
  /** Progress Dashboard openness (ephemeral, like the other workspaces). */
  dashboardOpen: boolean;

  // Ephemeral start-of-session baselines, used to compute deltas at check-out.
  sessionStartedAt: number | null;
  sessionStartTotalWords: number;
  sessionStartWordByNode: Record<string, number>;

  startSession: (input: StartSessionInput) => Promise<void>;
  endSession: (input: EndSessionInput) => Promise<void>;
  /** Abandon the in-flight session without recording an end (no check-out). */
  cancelSession: () => void;
  loadSessions: () => Promise<void>;
  openDashboard: () => void;
  closeDashboard: () => void;
}

export const createSessionSlice: StateCreator<AppState, [], [], SessionSlice> = (set, get) => ({
  activeSession: null,
  sessionLog: [],
  dashboardOpen: false,
  sessionStartedAt: null,
  sessionStartTotalWords: 0,
  sessionStartWordByNode: {},

  startSession: async ({ goal, steps, commitmentLevel = null, source = 'manual' }) => {
    const state = get();
    if (!state.activeProjectId) return;

    const id = sessionIdNow();
    const startTag = `session/${id}/start`;

    // Commit current state so the start tag marks the real starting point of
    // the session (createSnapshot saves the live buffer + makes a git commit;
    // it's a no-op git-side in the browser and for the desktop demo preview).
    await state.createSnapshot('manual');
    let startCommit: string | null = null;
    try {
      startCommit = await repo.resolveRef('HEAD');
    } catch {
      startCommit = null;
    }
    if (startCommit) {
      try {
        await repo.createTag(startTag, startCommit);
      } catch (e) {
        console.warn('session start tag failed (non-fatal):', e);
      }
    }

    const record: SessionRecord = {
      id,
      startTag,
      endTag: null,
      goal,
      steps,
      carryForward: [],
      reflection: null,
      wordDelta: 0,
      wordDeltaByNode: {},
      nodesModified: [],
      commitmentLevel,
      durationMinutes: 0,
      source,
    };

    set({
      activeSession: record,
      sessionStartedAt: Date.now(),
      sessionStartTotalWords: countWords(get().localContent),
      sessionStartWordByNode: wordCountByNode(get().sections),
    });
    try {
      await repo.saveSession(record);
    } catch (e) {
      console.warn('saveSession (start) failed:', e);
    }
    set((s) => ({ sessionLog: [record, ...s.sessionLog.filter((r) => r.id !== record.id)] }));
  },

  endSession: async ({ completedStepIds, carryForward, reflection = null }) => {
    const state = get();
    const rec = state.activeSession;
    if (!rec) return;

    const steps = rec.steps.map((st) => ({
      ...st,
      completed: completedStepIds.includes(st.id),
    }));
    const stepsCompleted = steps.filter((st) => st.completed).length;

    // Per-section word deltas vs the start baseline (cross-platform; no git).
    const endByNode = wordCountByNode(state.sections);
    const startByNode = state.sessionStartWordByNode;
    const wordDeltaByNode: Record<string, number> = {};
    for (const nodeId of new Set([...Object.keys(endByNode), ...Object.keys(startByNode)])) {
      const delta = (endByNode[nodeId] ?? 0) - (startByNode[nodeId] ?? 0);
      if (delta !== 0) wordDeltaByNode[nodeId] = delta;
    }
    const nodesModified = Object.keys(wordDeltaByNode);

    const endTotal = countWords(state.localContent);
    const wordDelta = endTotal - state.sessionStartTotalWords;
    const durationMinutes = state.sessionStartedAt
      ? Math.max(0, Math.round((Date.now() - state.sessionStartedAt) / 60000))
      : 0;

    // Semantic end-commit (GMT "Check"): trailers are machine-parseable and the
    // subject becomes `Session goal: <wish>`. `Task:` is intentionally omitted
    // (no task system on nodes). Ordered per the brief.
    const ledger = state.ledger;
    const ledgerPaid = ledger.filter((e) => e.status === 'paid').length;
    const ledgerDeclared = ledger.filter((e) => e.kind.startsWith('declared-')).length;
    const trailers: CommitTrailer[] = [
      { key: 'GMT-step', value: 'Check' },
      { key: 'Session', value: rec.id },
      ...(rec.goal.obstacle ? [{ key: 'WOOP-obstacle', value: rec.goal.obstacle }] : []),
      { key: 'Steps-completed', value: `${stepsCompleted}/${steps.length}` },
      // The theory's currency (Phase 3), beside the word delta.
      { key: 'Ledger-paid', value: `${ledgerPaid}` },
      { key: 'Ledger-declared', value: `${ledgerDeclared}` },
      { key: 'Word-delta', value: `${wordDelta >= 0 ? '+' : ''}${wordDelta}` },
    ];

    await state.saveCurrentState();
    let endCommit: string | null = null;
    try {
      endCommit = await repo.commitSnapshot(rec.goal.wish, 'manual', 'all', trailers);
    } catch (e) {
      console.warn('session semantic commit failed (non-fatal):', e);
    }

    const endTag = `session/${rec.id}/end`;
    let tagTarget = endCommit;
    if (!tagTarget) {
      try {
        tagTarget = await repo.resolveRef('HEAD');
      } catch {
        tagTarget = null;
      }
    }
    if (tagTarget) {
      try {
        await repo.createTag(endTag, tagTarget);
      } catch (e) {
        console.warn('session end tag failed (non-fatal):', e);
      }
    }

    // On desktop, record the authoritative delta from the committed git blobs
    // (history is the source of truth — equals the buffer delta after the save
    // above, but read from the tagged commits). Browser keeps the buffer delta.
    let recordedDelta = wordDelta;
    const toRef = endCommit ?? tagTarget;
    if (isTauri() && toRef) {
      try {
        recordedDelta = await repo.wordCountDelta(rec.startTag, toRef);
      } catch (e) {
        console.warn('git word delta failed; using buffer delta:', e);
      }
    }

    const finalized: SessionRecord = {
      ...rec,
      endTag,
      steps,
      carryForward,
      reflection,
      wordDelta: recordedDelta,
      wordDeltaByNode,
      nodesModified,
      durationMinutes,
    };

    try {
      await repo.saveSession(finalized);
    } catch (e) {
      console.warn('saveSession (end) failed:', e);
    }

    set((s) => ({
      activeSession: null,
      sessionStartedAt: null,
      sessionStartTotalWords: 0,
      sessionStartWordByNode: {},
      sessionLog: [finalized, ...s.sessionLog.filter((r) => r.id !== finalized.id)],
    }));
  },

  cancelSession: () =>
    set({
      activeSession: null,
      sessionStartedAt: null,
      sessionStartTotalWords: 0,
      sessionStartWordByNode: {},
    }),

  loadSessions: async () => {
    try {
      const list = await repo.listSessions();
      set({ sessionLog: list });
    } catch (e) {
      console.warn('listSessions failed:', e);
      set({ sessionLog: [] });
    }
  },

  openDashboard: () => {
    set({ dashboardOpen: true });
    void get().loadSessions();
  },
  closeDashboard: () => set({ dashboardOpen: false }),
});
