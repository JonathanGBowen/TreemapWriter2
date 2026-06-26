import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createSpecTestSlice, type SpecTestSlice } from '../spec-test-state';
import type { SectionSpecTest } from '../../types';

const sliceCreator = createSpecTestSlice as unknown as StateCreator<SpecTestSlice>;
const makeStore = () => create<SpecTestSlice>()(sliceCreator);

const fakeSection = (title: string): SectionSpecTest => ({
  sectionTitle: title,
  presentInA: true,
  presentInB: true,
  scopeReason: 'changed',
  truth: 'whole-true',
  direction: 'improved',
  wholeSignature: { a: 'aligned', b: 'aligned' },
  summary: 's',
  moveDeltas: [],
});

describe('spec-test-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('starts closed with the documented defaults', () => {
    const s = store.getState();
    expect(s.specTestOpen).toBe(false);
    expect(s.specTestAId).toBeNull();
    expect(s.specTestBId).toBeNull();
    expect(s.specTestScope).toBe('changed');
    expect(s.specTestMode).toBe('draft');
    expect(s.specTestRubricSource).toBe('live');
    expect(s.specTestStatus).toBe('idle');
    expect(s.specTestPartial).toEqual([]);
  });

  it('openSpecTest opens; closeSpecTest closes and settles in-flight status', () => {
    store.getState().openSpecTest();
    store.getState().setSpecTestStatus('running');
    expect(store.getState().specTestOpen).toBe(true);

    store.getState().closeSpecTest();
    expect(store.getState().specTestOpen).toBe(false);
    expect(store.getState().specTestStatus).toBe('idle');
  });

  it('pushSpecTestSection accumulates in order; resetSpecTestPartial clears it', () => {
    store.getState().pushSpecTestSection(fakeSection('A'));
    store.getState().pushSpecTestSection(fakeSection('B'));
    expect(store.getState().specTestPartial.map((s) => s.sectionTitle)).toEqual(['A', 'B']);

    store.getState().resetSpecTestPartial();
    expect(store.getState().specTestPartial).toEqual([]);
  });

  it('scope / mode / rubric-source setters each update their own field', () => {
    store.getState().setSpecTestScope('all');
    store.getState().setSpecTestMode('final');
    store.getState().setSpecTestRubricSource('snapshot-a');
    const s = store.getState();
    expect(s.specTestScope).toBe('all');
    expect(s.specTestMode).toBe('final');
    expect(s.specTestRubricSource).toBe('snapshot-a');
  });

  it('closeSpecTest preserves the selected operands and last report', () => {
    store.getState().setSpecTestA('snap-a');
    store.getState().setSpecTestB('current');
    store.getState().closeSpecTest();
    expect(store.getState().specTestAId).toBe('snap-a');
    expect(store.getState().specTestBId).toBe('current');
  });
});
