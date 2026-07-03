import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createCanvasSlice, type CanvasSlice } from '../canvas-state';

const sliceCreator = createCanvasSlice as unknown as StateCreator<CanvasSlice>;
const makeStore = () => create<CanvasSlice>()(sliceCreator);

describe('canvas-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('starts closed, unselected, with no edge draft', () => {
    const s = store.getState();
    expect(s.canvasOpen).toBe(false);
    expect(s.canvasFocusPartId).toBeNull();
    expect(s.canvasSelectedId).toBeNull();
    expect(s.canvasEdgeDraftFrom).toBeNull();
    expect(s.canvasEdgeDraftKind).toBe('grounds');
    expect(s.canvasListView).toBe(false);
  });

  it('openCanvas opens and records an optional focus target', () => {
    store.getState().openCanvas('part-7');
    expect(store.getState().canvasOpen).toBe(true);
    expect(store.getState().canvasFocusPartId).toBe('part-7');
    store.getState().openCanvas();
    expect(store.getState().canvasFocusPartId).toBeNull();
  });

  it('openCanvas clears any stale selection / edge draft', () => {
    store.getState().setCanvasSelected('x');
    store.getState().armCanvasEdge('y');
    store.getState().openCanvas();
    expect(store.getState().canvasSelectedId).toBeNull();
    expect(store.getState().canvasEdgeDraftFrom).toBeNull();
    expect(store.getState().canvasEdgeDraftKind).toBe('grounds');
  });

  it('closeCanvas resets open + focus + selection', () => {
    store.getState().openCanvas('p1');
    store.getState().setCanvasSelected('p1');
    store.getState().closeCanvas();
    const s = store.getState();
    expect(s.canvasOpen).toBe(false);
    expect(s.canvasFocusPartId).toBeNull();
    expect(s.canvasSelectedId).toBeNull();
  });

  it('armCanvasEdge sets the source and defaults the kind to grounds', () => {
    store.getState().setCanvasEdgeKind('opposes');
    store.getState().armCanvasEdge('src');
    expect(store.getState().canvasEdgeDraftFrom).toBe('src');
    expect(store.getState().canvasEdgeDraftKind).toBe('grounds');
  });

  it('setCanvasEdgeKind retypes the armed edge; clearCanvasEdgeDraft drops the source', () => {
    store.getState().armCanvasEdge('src');
    store.getState().setCanvasEdgeKind('answers');
    expect(store.getState().canvasEdgeDraftKind).toBe('answers');
    store.getState().clearCanvasEdgeDraft();
    expect(store.getState().canvasEdgeDraftFrom).toBeNull();
    // the kind is not reset by clearing (re-arming resets it).
    expect(store.getState().canvasEdgeDraftKind).toBe('answers');
  });

  it('toggleCanvasListView flips the list panel', () => {
    store.getState().toggleCanvasListView();
    expect(store.getState().canvasListView).toBe(true);
    store.getState().toggleCanvasListView();
    expect(store.getState().canvasListView).toBe(false);
  });

  it('clearCanvasFocus consumes the focus target', () => {
    store.getState().openCanvas('deep-link');
    store.getState().clearCanvasFocus();
    expect(store.getState().canvasFocusPartId).toBeNull();
  });
});
