import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createEditorStateSlice, type EditorStateSlice } from '../editor-state';

const sliceCreator = createEditorStateSlice as unknown as StateCreator<EditorStateSlice>;
const makeStore = () => create<EditorStateSlice>()(sliceCreator);

describe('editor-state slice — sectionCaret', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('starts with no remembered carets', () => {
    expect(store.getState().sectionCaret).toEqual({});
  });

  it('setSectionCaret records a per-section caret', () => {
    store.getState().setSectionCaret('s1', { anchor: 12, head: 12 });
    expect(store.getState().sectionCaret.s1).toEqual({ anchor: 12, head: 12 });
  });

  it('keeps carets for other sections when one is updated (the resume map)', () => {
    store.getState().setSectionCaret('s1', { anchor: 4, head: 4 });
    store.getState().setSectionCaret('s2', { anchor: 99, head: 110 });
    store.getState().setSectionCaret('s1', { anchor: 40, head: 40 });
    const map = store.getState().sectionCaret;
    expect(map.s1).toEqual({ anchor: 40, head: 40 });
    expect(map.s2).toEqual({ anchor: 99, head: 110 });
  });
});
