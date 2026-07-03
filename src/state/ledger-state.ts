import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import { repository as repo } from '../services/repository-registry';
import type { LedgerEntry, LedgerEntryKind } from '../types';

/**
 * The Ledger (Arpeggio Phase 3) — the app's honest memory of the writer's
 * concessions (IOUs / declared-heap / declared-deviation / deferred-diagnostic).
 * Mirrors the session-state discipline: the entries are the durable artifact,
 * written per-file via the Repository (`.twriter/ledger/<id>.yaml`), NOT through
 * the `StoredProjectData` blob. `ledger` in the store is a projection loaded on
 * project open (the commitment mesh + strain register + check-out read it live).
 */

/** A hyphenated, filename-safe ISO timestamp to the second, unique against `taken`. */
function uniqueLedgerId(taken: Set<string>): string {
  const base = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export interface NewLedgerEntry {
  kind: LedgerEntryKind;
  openedAtSectionId: string;
  owes: string;
  createdBy?: 'user' | 'system';
  reason?: string;
}

export interface LedgerSlice {
  /** All recorded entries, newest first — a projection of the on-disk ledger. */
  ledger: LedgerEntry[];
  /** The Ledger drawer open flag (the gist-state workspace pattern). */
  ledgerOpen: boolean;
  openLedger: () => void;
  closeLedger: () => void;
  /** Reload the ledger from the Repository (project open / after external change). */
  loadLedger: () => Promise<void>;
  /** Mint + persist a new entry (id + timestamps + `open` status assigned here). */
  addLedgerEntry: (input: NewLedgerEntry) => Promise<LedgerEntry>;
  /** Patch an entry by id (pay / waive), stamping `modifiedAt`; persists. */
  updateLedgerEntry: (id: string, patch: Partial<LedgerEntry>) => Promise<void>;
  /** Mark an IOU paid at a section (the strike-through moment). */
  payLedgerEntry: (id: string, paidAtSectionId?: string) => Promise<void>;
  /** Waive an entry (a debt the writer decides not to pay, honestly recorded). */
  waiveLedgerEntry: (id: string) => Promise<void>;
  /** Remove an entry entirely (rare — waive is the usual "done with it"). */
  removeLedgerEntry: (id: string) => Promise<void>;
}

export const createLedgerSlice: StateCreator<AppState, [], [], LedgerSlice> = (set, get) => ({
  ledger: [],
  ledgerOpen: false,
  openLedger: () => {
    set({ ledgerOpen: true });
    void get().loadLedger();
  },
  closeLedger: () => set({ ledgerOpen: false }),

  loadLedger: async () => {
    try {
      const list = await repo.listLedger();
      set({ ledger: list });
    } catch (e) {
      console.warn('listLedger failed:', e);
      set({ ledger: [] });
    }
  },

  addLedgerEntry: async (input) => {
    const now = new Date().toISOString();
    const id = uniqueLedgerId(new Set(get().ledger.map((e) => e.id)));
    const entry: LedgerEntry = {
      id,
      kind: input.kind,
      openedAtSectionId: input.openedAtSectionId,
      owes: input.owes,
      status: 'open',
      createdBy: input.createdBy ?? 'user',
      reason: input.reason,
      createdAt: now,
      modifiedAt: now,
    };
    // Optimistic list update, then persist (the sessions idiom).
    set((s) => ({ ledger: [entry, ...s.ledger.filter((r) => r.id !== id)] }));
    await repo.saveLedgerEntry(entry);
    return entry;
  },

  updateLedgerEntry: async (id, patch) => {
    const existing = get().ledger.find((e) => e.id === id);
    if (!existing) return;
    const next: LedgerEntry = { ...existing, ...patch, id, modifiedAt: new Date().toISOString() };
    set((s) => ({ ledger: s.ledger.map((e) => (e.id === id ? next : e)) }));
    await repo.saveLedgerEntry(next);
  },

  payLedgerEntry: async (id, paidAtSectionId) => {
    await get().updateLedgerEntry(id, { status: 'paid', paidAtSectionId });
  },

  waiveLedgerEntry: async (id) => {
    await get().updateLedgerEntry(id, { status: 'waived' });
  },

  removeLedgerEntry: async (id) => {
    set((s) => ({ ledger: s.ledger.filter((e) => e.id !== id) }));
    await repo.deleteLedgerEntry(id);
  },
});
