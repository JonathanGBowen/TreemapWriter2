import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createLedgerSlice, type LedgerSlice } from '../ledger-state';

// Slice-only store (the editor-state test idiom); repo saves are browser no-ops in tests,
// so the optimistic in-memory `ledger` is what we assert.
const sliceCreator = createLedgerSlice as unknown as StateCreator<LedgerSlice>;
const makeStore = () => create<LedgerSlice>()(sliceCreator);

describe('ledger-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('starts empty and closed', () => {
    expect(store.getState().ledger).toEqual([]);
    expect(store.getState().ledgerOpen).toBe(false);
  });

  it('addLedgerEntry mints an open entry with timestamps + defaults', async () => {
    const entry = await store.getState().addLedgerEntry({
      kind: 'iou',
      openedAtSectionId: 's1',
      owes: 'define the term',
    });
    expect(entry.status).toBe('open');
    expect(entry.createdBy).toBe('user');
    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();
    expect(store.getState().ledger).toHaveLength(1);
    expect(store.getState().ledger[0].owes).toBe('define the term');
  });

  it('payLedgerEntry marks paid + records where', async () => {
    const e = await store.getState().addLedgerEntry({ kind: 'iou', openedAtSectionId: 's1', owes: 'x' });
    await store.getState().payLedgerEntry(e.id, 's5');
    const after = store.getState().ledger.find((r) => r.id === e.id)!;
    expect(after.status).toBe('paid');
    expect(after.paidAtSectionId).toBe('s5');
  });

  it('waiveLedgerEntry marks waived; removeLedgerEntry drops it', async () => {
    const e = await store.getState().addLedgerEntry({ kind: 'declared-heap', openedAtSectionId: 's2', owes: 'heap' });
    await store.getState().waiveLedgerEntry(e.id);
    expect(store.getState().ledger.find((r) => r.id === e.id)!.status).toBe('waived');
    await store.getState().removeLedgerEntry(e.id);
    expect(store.getState().ledger.find((r) => r.id === e.id)).toBeUndefined();
  });

  it('mints distinct ids for entries created back-to-back', async () => {
    const a = await store.getState().addLedgerEntry({ kind: 'iou', openedAtSectionId: 's', owes: 'a' });
    const b = await store.getState().addLedgerEntry({ kind: 'iou', openedAtSectionId: 's', owes: 'b' });
    expect(a.id).not.toBe(b.id);
    expect(store.getState().ledger).toHaveLength(2);
  });
});
