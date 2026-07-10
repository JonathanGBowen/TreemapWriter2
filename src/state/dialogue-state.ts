import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { DialogueMessage } from '../types';
import type { DialogueOpening } from '../lib/dialogue-openings';

/**
 * The anchored-opening dialogue — EPHEMERAL by design (docs/dialogue-design.md
 * §V: transcripts die into artifacts). Exactly one opening exists at a time;
 * opening a new one ends the old (undo-not-confirm — it was ephemeral by
 * contract). The persisted analysis dialogue keeps its own home on the
 * testSuite; this slice never touches it.
 */
export interface DialogueOpeningSlice {
  /** The active opening, or null when the tab shows the analysis dialogue. */
  dialogueOpening: DialogueOpening | null;
  /** The opening's transcript. Lost on reload, deliberately. */
  openingMessages: DialogueMessage[];

  openDialogueOpening: (opening: DialogueOpening) => void;
  setOpeningMessages: (messages: DialogueMessage[]) => void;
  endDialogueOpening: () => void;
}

export const createDialogueOpeningSlice: StateCreator<AppState, [], [], DialogueOpeningSlice> = (
  set,
) => ({
  dialogueOpening: null,
  openingMessages: [],

  openDialogueOpening: (opening) => set({ dialogueOpening: opening, openingMessages: [] }),
  setOpeningMessages: (messages) => set({ openingMessages: messages }),
  endDialogueOpening: () => set({ dialogueOpening: null, openingMessages: [] }),
});
