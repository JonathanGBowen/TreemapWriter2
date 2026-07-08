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
 *  section is departed, so it only ever names a place you can return to.
 *  Offsets are SECTION-RELATIVE (anchor/head minus the section's start at
 *  commit time): edits elsewhere in the document shift absolute positions, so
 *  a restore re-derives the section's live start and adds these back. */
export interface SectionCaret {
  anchor: number;
  head: number;
}

export interface EditorStateSlice {
  localContent: string;
  /**
   * True once the DRAFT has been edited this session (any setLocalContent).
   * Distinguishes a deliberately-emptied document (persist it) from a transient
   * empty buffer mid project-load/switch (never let it blank a saved document —
   * the guard in saveCurrentState). Reset wherever localContent is seeded.
   */
  draftDirty: boolean;
  selectedId: string | null;
  activeLineIndex: number | null;
  /** sectionId → the caret last left there. Ephemeral (per session). */
  sectionCaret: Record<string, SectionCaret>;

  /**
   * Monotonic focus-request counter. Any surface (the Dock's Continue button)
   * bumps it via `requestEditorFocus`; the editor watches it and responds by
   * focusing the view and restoring the current section's resume caret — even
   * when the selection didn't change (the case the old dead-ref wiring missed).
   */
  editorFocusSeq: number;
  /**
   * "Here is what just changed": the character offset of the most recent
   * accepted AI splice. The main editor consumes it (scroll + landing pulse)
   * once no workspace overlay is covering it, then clears it — so closing the
   * Glass Box / Parallel workspace lands the writer AT the accepted edit
   * instead of wherever the caret last was.
   */
  pendingEditorReveal: { offset: number } | null;

  setLocalContent: (content: string | ((prev: string) => string)) => void;
  setSelectedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setActiveLineIndex: (idx: number | null) => void;
  setSectionCaret: (id: string, caret: SectionCaret) => void;
  requestEditorFocus: () => void;
  setPendingEditorReveal: (reveal: { offset: number } | null) => void;
}

export const createEditorStateSlice: StateCreator<AppState, [], [], EditorStateSlice> = (set) => ({
  localContent: '',
  draftDirty: false,
  selectedId: null,
  activeLineIndex: null,
  sectionCaret: {},
  editorFocusSeq: 0,
  pendingEditorReveal: null,

  setLocalContent: (content) =>
    set((state) => ({
      localContent: typeof content === 'function' ? content(state.localContent) : content,
      draftDirty: true,
    })),
  setSelectedId: (id) =>
    set((state) => ({
      selectedId: typeof id === 'function' ? id(state.selectedId) : id,
    })),
  setActiveLineIndex: (idx) => set({ activeLineIndex: idx }),
  setSectionCaret: (id, caret) =>
    set((state) => ({ sectionCaret: { ...state.sectionCaret, [id]: caret } })),
  requestEditorFocus: () => set((state) => ({ editorFocusSeq: state.editorFocusSeq + 1 })),
  setPendingEditorReveal: (reveal) => set({ pendingEditorReveal: reveal }),
});
