import { describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createDocumentStateSlice, MEMORANDUM_CAP, type DocumentStateSlice } from '../document-state';

// The setter is the one write path for the Memorandum; the cap is enforced here
// so no over-length AI proposal or paste can accrete a shadow-profile (§IV).
const sliceCreator = createDocumentStateSlice as unknown as StateCreator<DocumentStateSlice>;
const makeStore = () => create<DocumentStateSlice>()(sliceCreator);

describe('document-state — Memorandum', () => {
  it('starts empty (zero footprint until first use)', () => {
    expect(makeStore().getState().memorandum).toBe('');
  });

  it('setMemorandum stores standing intent verbatim under the cap', () => {
    const store = makeStore();
    store.getState().setMemorandum('ch. 2 framing is settled — do not reopen');
    expect(store.getState().memorandum).toBe('ch. 2 framing is settled — do not reopen');
  });

  it('hard-caps over-length input (forces triage, not accretion)', () => {
    const store = makeStore();
    store.getState().setMemorandum('x'.repeat(MEMORANDUM_CAP + 500));
    expect(store.getState().memorandum.length).toBe(MEMORANDUM_CAP);
  });
});
