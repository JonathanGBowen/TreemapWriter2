import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { AgentTraceSinkEvent } from '../services/ai/clients';
import * as prefs from '../services/preferences';

/**
 * Agent SDK activity trace (ephemeral + optionally persisted). The AgentSdkClient
 * emits lifecycle/think/text/activity events (via the injected sink wired in
 * `state/index.ts`); this slice turns them into per-run logs that the inline
 * ticker (`AgentTraceTicker`) and the audit viewer (`AgentTraceModal`) read.
 *
 * Ephemeral by lifecycle, but the last MAX_RUNS finished runs are mirrored to
 * IndexedDB (when saving is on) so they survive a reload for optional auditing —
 * never written into the git-tracked project files.
 */

export interface TraceEvent {
  t: 'think' | 'text' | 'activity';
  text: string;
  at: number;
}

export interface TraceRun {
  id: string;
  label: string;
  callKind?: string;
  model: string;
  startedAt: number;
  finishedAt?: number;
  status: 'running' | 'success' | 'error';
  errorMessage?: string;
  events: TraceEvent[];
}

const MAX_RUNS = 25;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(runs: TraceRun[]): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void prefs
      .setSavedAgentTraces(runs.filter((r) => r.status !== 'running').slice(0, MAX_RUNS))
      .catch(() => {}); // a failed pref write must never surface as an unhandled rejection
  }, 500);
}

/** Append a delta to a run's event log, merging consecutive same-type deltas. */
function withEvent(run: TraceRun, t: TraceEvent['t'], text: string, at: number): TraceRun {
  const last = run.events[run.events.length - 1];
  if (last && last.t === t && t !== 'activity') {
    const events = run.events.slice(0, -1).concat({ t, text: last.text + text, at });
    return { ...run, events };
  }
  return { ...run, events: run.events.concat({ t, text, at }) };
}

export interface TraceSlice {
  /** Newest-first; capped at MAX_RUNS. */
  traceRuns: TraceRun[];
  /** Run ids currently in flight (for the live ticker). */
  activeRunIds: string[];
  /** Whether finished runs are mirrored to IndexedDB. */
  traceSavingEnabled: boolean;

  /** Fold one client trace event into the run log. */
  applyTraceEvent: (e: AgentTraceSinkEvent) => void;
  clearTraces: () => void;
  setTraceSavingEnabled: (enabled: boolean) => void;
  /** Load persisted runs + the saving flag at boot. */
  hydrateTraces: () => Promise<void>;
}

export const createTraceSlice: StateCreator<AppState, [], [], TraceSlice> = (set, get) => ({
  traceRuns: [],
  activeRunIds: [],
  traceSavingEnabled: true,

  applyTraceEvent: (e) => {
    if (e.type === 'start') {
      const run: TraceRun = {
        id: e.runId,
        label: e.label || e.callKind || 'Agent run',
        callKind: e.callKind,
        model: e.model,
        startedAt: e.at,
        status: 'running',
        events: [],
      };
      set((s) => ({
        traceRuns: [run, ...s.traceRuns].slice(0, MAX_RUNS),
        activeRunIds: [...s.activeRunIds, e.runId],
      }));
      return;
    }
    if (e.type === 'end') {
      set((s) => ({
        traceRuns: s.traceRuns.map((r) =>
          r.id === e.runId
            ? { ...r, status: e.status, finishedAt: e.at, errorMessage: e.errorMessage }
            : r,
        ),
        activeRunIds: s.activeRunIds.filter((id) => id !== e.runId),
      }));
      if (get().traceSavingEnabled) scheduleSave(get().traceRuns);
      return;
    }
    // think | text | activity — append to the matching run's log.
    const text = e.type === 'activity' ? e.label : e.delta;
    set((s) => ({
      traceRuns: s.traceRuns.map((r) =>
        r.id === e.runId ? withEvent(r, e.type, text, e.at) : r,
      ),
    }));
  },

  clearTraces: () => {
    set({ traceRuns: [], activeRunIds: [] });
    void prefs.setSavedAgentTraces([]).catch(() => {});
  },

  setTraceSavingEnabled: (enabled) => {
    set({ traceSavingEnabled: enabled });
    void prefs.setAgentTraceSaving(enabled).catch(() => {});
    if (enabled) scheduleSave(get().traceRuns);
  },

  hydrateTraces: async () => {
    try {
      const [saved, saving] = await Promise.all([
        prefs.getSavedAgentTraces(),
        prefs.getAgentTraceSaving(),
      ]);
      set({ traceRuns: saved.slice(0, MAX_RUNS), traceSavingEnabled: saving });
    } catch {
      // No persisted traces available (e.g. no IndexedDB) — start empty.
    }
  },
});
