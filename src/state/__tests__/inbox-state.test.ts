import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createInboxSlice, type InboxSlice } from '../inbox-state';

const sliceCreator = createInboxSlice as unknown as StateCreator<InboxSlice>;
const makeStore = () => create<InboxSlice>()(sliceCreator);

describe('inbox-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('starts empty; capture + tray closed', () => {
    expect(store.getState().inbox).toEqual([]);
    expect(store.getState().inboxOpen).toBe(false);
    expect(store.getState().captureOpen).toBe(false);
  });

  it('addInboxItem captures a trimmed thought newest-first', async () => {
    await store.getState().addInboxItem('  first idea  ');
    await store.getState().addInboxItem('second idea');
    const inbox = store.getState().inbox;
    expect(inbox).toHaveLength(2);
    expect(inbox[0].text).toBe('second idea'); // newest first
    expect(inbox[1].text).toBe('first idea'); // trimmed
  });

  it('ignores an empty / whitespace-only capture', async () => {
    await store.getState().addInboxItem('   ');
    expect(store.getState().inbox).toHaveLength(0);
  });

  it('removeInboxItem consumes an item', async () => {
    await store.getState().addInboxItem('park me');
    const id = store.getState().inbox[0].id;
    await store.getState().removeInboxItem(id);
    expect(store.getState().inbox).toHaveLength(0);
  });

  it('openCapture / closeCapture toggle the quick surface', () => {
    store.getState().openCapture();
    expect(store.getState().captureOpen).toBe(true);
    store.getState().closeCapture();
    expect(store.getState().captureOpen).toBe(false);
  });
});
