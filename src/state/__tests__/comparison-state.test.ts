import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createComparisonSlice, type ComparisonSlice } from '../comparison-state';

const sliceCreator = createComparisonSlice as unknown as StateCreator<ComparisonSlice>;
const makeStore = () => create<ComparisonSlice>()(sliceCreator);

describe('comparison-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('starts closed and unset', () => {
    const s = store.getState();
    expect(s.comparisonOpen).toBe(false);
    expect(s.versionAId).toBeNull();
    expect(s.versionBId).toBeNull();
    expect(s.compareMode).toBe('draft');
    expect(s.comparisonStatus).toBe('idle');
  });

  it('openCompare opens; closeCompare closes and settles in-flight status', () => {
    store.getState().openCompare();
    store.getState().setComparisonStatus('running');
    expect(store.getState().comparisonOpen).toBe(true);

    store.getState().closeCompare();
    // Closing keeps selections but resets status so reopening lands settled.
    expect(store.getState().comparisonOpen).toBe(false);
    expect(store.getState().comparisonStatus).toBe('idle');
  });

  it('closeCompare preserves the selected operands and last report', () => {
    store.getState().setVersionA('snap-a');
    store.getState().setVersionB('current');
    store.getState().closeCompare();
    expect(store.getState().versionAId).toBe('snap-a');
    expect(store.getState().versionBId).toBe('current');
  });

  it('operand, lens, and index setters update their own field', () => {
    store.getState().setCompareLens('lens-1');
    store.getState().setIndexStatus('ready');
    store.getState().setShowAllSaves(true);
    const s = store.getState();
    expect(s.activeCompareLensId).toBe('lens-1');
    expect(s.indexStatus).toBe('ready');
    expect(s.showAllSaves).toBe(true);
  });
});
