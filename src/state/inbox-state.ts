import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import { repository as repo } from '../services/repository-registry';
import type { InboxItem } from '../types';

/**
 * The capture inbox (Arpeggio Phase 3) — thought-capture is sacred: a stray idea
 * must be parkable in under thirty seconds, zero navigation, from anywhere in the
 * app. `captureOpen` is the quick single-field capture (the Cmd/Ctrl+I chord);
 * `inboxOpen` is the tray that later routes items to a section or a germ part.
 * Items persist per-file (`.twriter/inbox/<id>.md`) via the Repository, like the
 * ledger — never through the `StoredProjectData` blob.
 */

function uniqueInboxId(taken: Set<string>): string {
  const base = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export interface InboxSlice {
  /** Parked thoughts, newest first — a projection of the on-disk inbox. */
  inbox: InboxItem[];
  /** The tray (list + destination actions). */
  inboxOpen: boolean;
  /** The quick single-field capture surface (the chord). */
  captureOpen: boolean;
  openInbox: () => void;
  closeInbox: () => void;
  openCapture: () => void;
  closeCapture: () => void;
  loadInbox: () => Promise<void>;
  /** Capture a thought (id + createdAt minted here); persists + optimistic. */
  addInboxItem: (text: string) => Promise<void>;
  /** Consume an item (on append / promote / discard); persists the deletion. */
  removeInboxItem: (id: string) => Promise<void>;
}

export const createInboxSlice: StateCreator<AppState, [], [], InboxSlice> = (set, get) => ({
  inbox: [],
  inboxOpen: false,
  captureOpen: false,
  openInbox: () => {
    set({ inboxOpen: true });
    void get().loadInbox();
  },
  closeInbox: () => set({ inboxOpen: false }),
  openCapture: () => set({ captureOpen: true }),
  closeCapture: () => set({ captureOpen: false }),

  loadInbox: async () => {
    try {
      const list = await repo.listInbox();
      set({ inbox: list });
    } catch (e) {
      console.warn('listInbox failed:', e);
      set({ inbox: [] });
    }
  },

  addInboxItem: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = uniqueInboxId(new Set(get().inbox.map((i) => i.id)));
    const item: InboxItem = { id, text: trimmed, createdAt: new Date().toISOString() };
    set((s) => ({ inbox: [item, ...s.inbox.filter((i) => i.id !== id)] }));
    await repo.saveInboxItem(item);
  },

  removeInboxItem: async (id) => {
    set((s) => ({ inbox: s.inbox.filter((i) => i.id !== id) }));
    await repo.deleteInboxItem(id);
  },
});
