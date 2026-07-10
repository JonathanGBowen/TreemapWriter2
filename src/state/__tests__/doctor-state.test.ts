import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createDoctorSlice, DOCTOR_STEPS, type DoctorSlice } from '../doctor-state';
import type { TestSuite } from '../../types';

// The slice reads cross-slice state (testSuite) via get(); exercise it in
// isolation with the fields it touches injected.
const sliceCreator = createDoctorSlice as unknown as StateCreator<DoctorSlice>;

const makeStore = (testSuite: TestSuite = {}) => {
  const store = create<DoctorSlice>()(sliceCreator);
  store.setState({ testSuite } as unknown as Partial<DoctorSlice>);
  return store;
};

describe('doctor-state', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('openDoctor seeds the thesis from the root spec mainClaim', () => {
    store = makeStore({
      root: {
        goals: '',
        status: 'idle',
        history: [],
        mainClaim: 'legacy claim',
        spec: {
          function: 'argue',
          mainClaim: 'The spec claim.',
          requiredMoves: [],
          incomingContext: [],
          outgoingCommitments: [],
        },
      },
    } as TestSuite);
    store.getState().openDoctor();
    expect(store.getState().doctorThesis).toBe('The spec claim.');
    expect(store.getState().doctorThesisSource).toBe('document');
  });

  it('openDoctor falls back to the legacy root mainClaim, and never overwrites a set thesis', () => {
    store = makeStore({
      root: { goals: '', status: 'idle', history: [], mainClaim: 'legacy claim' },
    } as TestSuite);
    store.getState().openDoctor();
    expect(store.getState().doctorThesis).toBe('legacy claim');

    store.getState().setDoctorThesis('my own thesis', 'typed');
    store.getState().closeDoctor();
    store.getState().openDoctor();
    expect(store.getState().doctorThesis).toBe('my own thesis');
    expect(store.getState().doctorThesisSource).toBe('typed');
  });

  it('close keeps results but settles status', () => {
    store.getState().setDoctorReport({ instrument: 'flow', markdown: 'report' });
    store.getState().setDoctorStatus('running');
    store.getState().closeDoctor();
    expect(store.getState().doctorOpen).toBe(false);
    expect(store.getState().doctorStatus).toBe('idle');
    expect(store.getState().doctorReport?.markdown).toBe('report');
  });

  it('a scope change clears every scope-derived reading (incl. distilled options) and bumps the epoch', () => {
    const s = store.getState();
    s.setDoctorOutlineRows([{ index: 0, claim: 'c', kind: 'prose', anchor: '' }], 'hash');
    s.setDoctorCoherenceRows(
      [{ index: 0, claim: 'c', verdict: 'yes', justification: '', kind: 'prose', anchor: '' }],
      'scopehash',
    );
    s.setDoctorThesisOptions([{ type: 'mirror', description: 'd', thesis: 't' }]);
    const epoch = store.getState().doctorEpoch;
    store.getState().setDoctorTarget('sec-1');
    expect(store.getState().doctorOutlineRows).toBeNull();
    expect(store.getState().doctorOutlineHash).toBeNull();
    expect(store.getState().doctorCoherenceRows).toBeNull();
    expect(store.getState().doctorScopeHash).toBeNull();
    // The old scope's distilled thesis candidates must not carry into the new scope.
    expect(store.getState().doctorThesisOptions).toBeNull();
    expect(store.getState().doctorEpoch).toBe(epoch + 1);
    // Same target again is a no-op (no gratuitous invalidation).
    store.getState().setDoctorOutlineRows([{ index: 0, claim: 'c', kind: 'prose', anchor: '' }], 'h2');
    store.getState().setDoctorTarget('sec-1');
    expect(store.getState().doctorOutlineRows).not.toBeNull();
  });

  it('changing the thesis invalidates the thesis-derived chain and bumps the epoch', () => {
    const s = store.getState();
    s.setDoctorThesis('T1', 'typed');
    s.advanceDoctorStep(); // calibration
    s.setDoctorCoherenceRows(
      [{ index: 0, claim: 'c', verdict: 'yes', justification: 'j', kind: 'prose', anchor: '' }],
      'scopehash',
    );
    s.advanceDoctorStep(); // diagnosis
    s.setDoctorCriticalIssue('The most critical issue is X.');
    s.advanceDoctorStep(); // strategy
    s.setDoctorRoadmaps([{ title: 'A', summary: '', outline: [] }]);
    const epoch = store.getState().doctorEpoch;

    store.getState().setDoctorThesis('T2 — a different thesis', 'typed');
    const st = store.getState();
    expect(st.doctorThesis).toBe('T2 — a different thesis');
    expect(st.doctorCoherenceRows).toBeNull(); // calibration is thesis-derived
    expect(st.doctorScopeHash).toBeNull();
    expect(st.doctorCriticalIssue).toBe('');
    expect(st.doctorRoadmaps).toBeNull();
    expect(st.doctorStepCursor).toBe(1); // dropped to calibration to re-run
    expect(st.doctorEpoch).toBe(epoch + 1);
  });

  it('re-setting the same thesis is a no-op (only the source updates, no invalidation)', () => {
    const s = store.getState();
    s.setDoctorThesis('T', 'typed');
    s.setDoctorCoherenceRows(
      [{ index: 0, claim: 'c', verdict: 'yes', justification: '', kind: 'prose', anchor: '' }],
      'h',
    );
    const epoch = store.getState().doctorEpoch;
    store.getState().setDoctorThesis('T', 'document'); // same text, new source
    expect(store.getState().doctorCoherenceRows).not.toBeNull();
    expect(store.getState().doctorEpoch).toBe(epoch);
    expect(store.getState().doctorThesisSource).toBe('document');
  });

  it('the wizard walk advances, and retreat clears downstream outputs only', () => {
    const s = store.getState();
    // Walk to strategy with outputs at each step.
    s.advanceDoctorStep(); // calibration
    s.setDoctorCoherenceRows([{ index: 0, claim: 'c', verdict: 'no', justification: 'j', kind: 'prose', anchor: '' }]);
    s.advanceDoctorStep(); // diagnosis
    s.appendDoctorDiagnosis('CoT… The most critical issue is X.');
    s.setDoctorCriticalIssue('The most critical issue is X.');
    s.advanceDoctorStep(); // strategy
    s.setDoctorRoadmaps([{ title: 'A', summary: 's', outline: ['x'] }]);
    s.chooseDoctorRoadmap(0);

    store.getState().retreatDoctorStep(); // back to diagnosis
    const st = store.getState();
    expect(DOCTOR_STEPS[st.doctorStepCursor]).toBe('diagnosis');
    expect(st.doctorRoadmaps).toBeNull(); // downstream of the landing step: cleared
    expect(st.doctorChosenRoadmap).toBeNull();
    expect(st.doctorDiagnosis).toContain('critical'); // the landing step's own output survives
    expect(st.doctorCoherenceRows).not.toBeNull(); // upstream survives

    store.getState().retreatDoctorStep(); // back to calibration
    expect(store.getState().doctorDiagnosis).toBe('');
    expect(store.getState().doctorCriticalIssue).toBe('');
    // Coherence is calibration's OWN output — it survives landing at calibration.
    expect(store.getState().doctorCoherenceRows).not.toBeNull();

    store.getState().retreatDoctorStep(); // back to discovery
    // Now the coherence table is downstream of the landing step — cleared.
    expect(store.getState().doctorCoherenceRows).toBeNull();
    expect(store.getState().doctorScopeHash).toBeNull();
  });

  it('clearDoctorDiagnosis empties the streamed buffer through a slice action', () => {
    store.getState().appendDoctorDiagnosis('some streamed prose');
    expect(store.getState().doctorDiagnosis).not.toBe('');
    store.getState().clearDoctorDiagnosis();
    expect(store.getState().doctorDiagnosis).toBe('');
  });

  it('closeDoctor bumps the epoch so an in-flight op is invalidated', () => {
    const epoch = store.getState().doctorEpoch;
    store.getState().setDoctorStatus('running');
    store.getState().closeDoctor();
    expect(store.getState().doctorEpoch).toBe(epoch + 1);
    expect(store.getState().doctorStatus).toBe('idle');
  });

  it('resetDoctorWizard returns to discovery, clears the chain (incl. coherence), bumps the epoch', () => {
    const s = store.getState();
    s.advanceDoctorStep();
    s.setDoctorCoherenceRows([{ index: 0, claim: 'c', verdict: 'yes', justification: '', kind: 'prose', anchor: '' }], 'h');
    s.appendDoctorDiagnosis('prose');
    s.setDoctorRoadmaps([{ title: 'A', summary: '', outline: [] }]);
    const epoch = store.getState().doctorEpoch;
    store.getState().resetDoctorWizard();
    const st = store.getState();
    expect(st.doctorStepCursor).toBe(0);
    expect(st.doctorDiagnosis).toBe('');
    expect(st.doctorRoadmaps).toBeNull();
    expect(st.doctorCoherenceRows).toBeNull();
    expect(st.doctorScopeHash).toBeNull();
    expect(st.doctorEpoch).toBe(epoch + 1);
  });

  it('advance clamps at the last step', () => {
    for (let i = 0; i < 10; i++) store.getState().advanceDoctorStep();
    expect(store.getState().doctorStepCursor).toBe(DOCTOR_STEPS.length - 1);
  });
});
