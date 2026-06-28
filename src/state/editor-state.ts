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
/** Last caret a section was left at — drives per-section resume (the editor's
 *  margin "resume marker" and caret-restore on re-entry). Committed when a
 *  section is departed, so it only ever names a place you can return to. */
export interface SectionCaret {
  anchor: number;
  head: number;
}

export interface EditorStateSlice {
  localContent: string;
  selectedId: string | null;
  activeLineIndex: number | null;
  /** sectionId → the caret last left there. Ephemeral (per session). */
  sectionCaret: Record<string, SectionCaret>;

  setLocalContent: (content: string | ((prev: string) => string)) => void;
  setSelectedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setActiveLineIndex: (idx: number | null) => void;
  setSectionCaret: (id: string, caret: SectionCaret) => void;
}

export const createEditorStateSlice: StateCreator<AppState, [], [], EditorStateSlice> = (set) => ({
  localContent: '',
  selectedId: null,
  activeLineIndex: null,
  sectionCaret: {},

  setLocalContent: (content) =>
    set((state) => ({
      localContent: typeof content === 'function' ? content(state.localContent) : content,
    })),
  setSelectedId: (id) =>
    set((state) => ({
      selectedId: typeof id === 'function' ? id(state.selectedId) : id,
    })),
  setActiveLineIndex: (idx) => set({ activeLineIndex: idx }),
  setSectionCaret: (id, caret) =>
    set((state) => ({ sectionCaret: { ...state.sectionCaret, [id]: caret } })),
});
