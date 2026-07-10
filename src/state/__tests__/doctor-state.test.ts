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

  it('a scope change clears every scope-derived reading and bumps the epoch', () => {
    const s = store.getState();
    s.setDoctorOutlineRows([{ index: 0, claim: 'c', kind: 'prose' }], 'hash');
    s.setDoctorCoherenceRows([{ index: 0, claim: 'c', verdict: 'yes', justification: '', kind: 'prose' }]);
    const epoch = store.getState().doctorWizardEpoch;
    store.getState().setDoctorTarget('sec-1');
    expect(store.getState().doctorOutlineRows).toBeNull();
    expect(store.getState().doctorOutlineHash).toBeNull();
    expect(store.getState().doctorCoherenceRows).toBeNull();
    expect(store.getState().doctorWizardEpoch).toBe(epoch + 1);
    // Same target again is a no-op (no gratuitous invalidation).
    store.getState().setDoctorOutlineRows([{ index: 0, claim: 'c', kind: 'prose' }], 'h2');
    store.getState().setDoctorTarget('sec-1');
    expect(store.getState().doctorOutlineRows).not.toBeNull();
  });

  it('the wizard walk advances, and retreat clears downstream outputs only', () => {
    const s = store.getState();
    // Walk to strategy with outputs at each step.
    s.advanceDoctorStep(); // calibration
    s.setDoctorCoherenceRows([{ index: 0, claim: 'c', verdict: 'no', justification: 'j', kind: 'prose' }]);
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
    expect(store.getState().doctorCoherenceRows).not.toBeNull();
  });

  it('resetDoctorWizard returns to discovery, clears the chain, bumps the epoch', () => {
    const s = store.getState();
    s.advanceDoctorStep();
    s.appendDoctorDiagnosis('prose');
    s.setDoctorRoadmaps([{ title: 'A', summary: '', outline: [] }]);
    const epoch = store.getState().doctorWizardEpoch;
    store.getState().resetDoctorWizard();
    const st = store.getState();
    expect(st.doctorStepCursor).toBe(0);
    expect(st.doctorDiagnosis).toBe('');
    expect(st.doctorRoadmaps).toBeNull();
    expect(st.doctorWizardEpoch).toBe(epoch + 1);
  });

  it('advance clamps at the last step', () => {
    for (let i = 0; i < 10; i++) store.getState().advanceDoctorStep();
    expect(store.getState().doctorStepCursor).toBe(DOCTOR_STEPS.length - 1);
  });
});
