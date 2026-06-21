import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createTraceSlice, type TraceSlice } from '../trace-state';

// The slice is typed against the full AppState but only ever touches its own
// fields via set/get, so a standalone store exercises the reducer faithfully.
const makeStore = () => create<TraceSlice>()(createTraceSlice as unknown as StateCreator<TraceSlice>);

describe('trace-state applyTraceEvent', () => {
  it('opens a running run on start', () => {
    const s = makeStore();
    s.getState().applyTraceEvent({
      type: 'start', runId: 'r1', label: 'Analyze', callKind: 'analyzeSection', model: 'm', at: 1,
    });
    const run = s.getState().traceRuns[0];
    expect(run).toMatchObject({ id: 'r1', label: 'Analyze', callKind: 'analyzeSection', status: 'running' });
    expect(s.getState().activeRunIds).toEqual(['r1']);
  });

  it('coalesces consecutive same-type deltas, splits on type change', () => {
    const s = makeStore();
    const ev = s.getState().applyTraceEvent;
    ev({ type: 'start', runId: 'r1', model: 'm', at: 1 });
    ev({ type: 'think', runId: 'r1', delta: 'a', at: 2 });
    ev({ type: 'think', runId: 'r1', delta: 'b', at: 3 });
    ev({ type: 'text', runId: 'r1', delta: 'c', at: 4 });
    ev({ type: 'activity', runId: 'r1', label: 'step', at: 5 });
    ev({ type: 'activity', runId: 'r1', label: 'step2', at: 6 });
    const { events } = s.getState().traceRuns[0];
    expect(events.map((e) => `${e.t}:${e.text}`)).toEqual([
      'think:ab', // merged
      'text:c',
      'activity:step', // activity never merges
      'activity:step2',
    ]);
  });

  it('closes the run and clears it from active on end', () => {
    const s = makeStore();
    s.getState().applyTraceEvent({ type: 'start', runId: 'r1', model: 'm', at: 1 });
    s.getState().applyTraceEvent({ type: 'end', runId: 'r1', status: 'success', at: 9 });
    const run = s.getState().traceRuns[0];
    expect(run.status).toBe('success');
    expect(run.finishedAt).toBe(9);
    expect(s.getState().activeRunIds).toEqual([]);
  });

  it('caps at 25 runs, newest first', () => {
    const s = makeStore();
    for (let i = 0; i < 30; i++) {
      s.getState().applyTraceEvent({ type: 'start', runId: `k${i}`, model: 'm', at: i });
    }
    const runs = s.getState().traceRuns;
    expect(runs.length).toBe(25);
    expect(runs[0].id).toBe('k29');
    expect(runs[24].id).toBe('k5');
  });
});
