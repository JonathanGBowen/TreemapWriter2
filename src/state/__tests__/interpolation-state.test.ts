import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createInterpolationSlice, type InterpolationSlice, type StageWork } from '../interpolation-state';
import type { SpecStage } from '../../services/ai/ai-provider.specs';
import type { SectionSpec } from '../../types';

const sliceCreator = createInterpolationSlice as unknown as StateCreator<InterpolationSlice>;
const makeStore = () => create<InterpolationSlice>()(sliceCreator);

const stage = (id: string): SpecStage => ({ id, kind: 'level', level: 1, nodeIds: [], label: id });
const work = (over: Partial<StageWork> = {}): StageWork => ({
  steer: '',
  messages: [],
  proposed: {},
  status: 'idle',
  ...over,
});
const someSpec: SectionSpec = {
  function: 'argue',
  mainClaim: 'c',
  requiredMoves: [],
  incomingContext: [],
  outgoingCommitments: [],
};

describe('interpolation-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('openInterpolate materializes a stage plan keyed by stage id and opens the workspace', () => {
    // Seed the cross-slice fields openInterpolate reads via get().
    store.setState({ sections: [], modelConfig: {}, globalModelDefault: {} } as unknown as Partial<InterpolationSlice>);
    store.getState().openInterpolate();
    const s = store.getState();
    expect(s.interpolateOpen).toBe(true);
    // specStages always yields at least the root stage.
    expect(s.interpStages.length).toBeGreaterThanOrEqual(1);
    // Every stage gets a fresh working-data bucket.
    expect(Object.keys(s.stageWork).sort()).toEqual(s.interpStages.map((st) => st.id).sort());
    expect(s.stageCursor).toBe(0);
    expect(s.walkStarted).toBe(false);
  });

  it('closeInterpolate fully resets the regenerable walk', () => {
    store.setState({
      interpolateOpen: true,
      interpStages: [stage('a')],
      stageCursor: 1,
      specCache: { x: someSpec },
      stageWork: { a: work() },
      walkStarted: true,
    });
    store.getState().closeInterpolate();
    const s = store.getState();
    expect(s.interpolateOpen).toBe(false);
    expect(s.interpStages).toEqual([]);
    expect(s.specCache).toEqual({});
    expect(s.stageWork).toEqual({});
    expect(s.walkStarted).toBe(false);
  });

  it('acceptStage merges the proposal into specCache and advances the cursor', () => {
    store.setState({
      interpStages: [stage('a'), stage('b')],
      stageCursor: 0,
      stageWork: { a: work({ proposed: { sec1: someSpec } }), b: work() },
      specCache: {},
    });
    store.getState().acceptStage('a');
    const s = store.getState();
    expect(s.specCache).toEqual({ sec1: someSpec });
    expect(s.stageWork['a'].status).toBe('accepted');
    expect(s.stageCursor).toBe(1); // index of 'a' (0) + 1
  });

  it('setProposedSpec edits one section in place; missing stage is a no-op', () => {
    store.setState({ stageWork: { a: work({ proposed: {} }) } });
    store.getState().setProposedSpec('a', 'sec1', someSpec);
    expect(store.getState().stageWork['a'].proposed['sec1']).toBe(someSpec);

    // Editing an absent stage leaves state untouched (no thrown error).
    store.getState().setProposedSpec('ghost', 'sec1', someSpec);
    expect(store.getState().stageWork['ghost']).toBeUndefined();
  });

  it('per-stage patch setters only touch the targeted stage', () => {
    store.setState({ stageWork: { a: work(), b: work() } });
    store.getState().setStageSteer('a', 'steer note');
    store.getState().setStageStatus('b', 'generating');
    const s = store.getState();
    expect(s.stageWork['a'].steer).toBe('steer note');
    expect(s.stageWork['a'].status).toBe('idle'); // unchanged
    expect(s.stageWork['b'].status).toBe('generating');
  });
});
