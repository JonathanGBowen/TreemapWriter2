import type { StateCreator } from 'zustand';
import type { AppState } from '.';

/**
 * Editor-local ephemera. The user's working draft, cursor focus, selection.
 * CodeMirror is the real source of truth for these while typing; this slice
 * holds the snapshot we hand to other UI surfaces (sidebar, treemap, panels).
 *
 * `localContent` is the unsaved draft — distinct from `document.markdown`,
 * which is the committed (parsed-from-disk) version. The split protects user
 * input across crashes: even mid-keystroke, the committed copy is intact.
 */
export interface EditorStateSlice {
  localContent: string;
  selectedId: string | null;
  activeLineIndex: number | null;

  setLocalContent: (content: string | ((prev: string) => string)) => void;
  setSelectedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setActiveLineIndex: (idx: number | null) => void;
}

export const createEditorStateSlice: StateCreator<AppState, [], [], EditorStateSlice> = (set) => ({
  localContent: '',
  selectedId: null,
  activeLineIndex: null,

  setLocalContent: (content) =>
    set((state) => ({
      localContent: typeof content === 'function' ? content(state.localContent) : content,
    })),
  setSelectedId: (id) =>
    set((state) => ({
      selectedId: typeof id === 'function' ? id(state.selectedId) : id,
    })),
  setActiveLineIndex: (idx) => set({ activeLineIndex: idx }),
});
