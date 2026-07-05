// The Ledger drawer (Arpeggio Phase 3): the app's honest memory as literal ledger
// rows — kind, opened-at section, owes, age, status. Payment produces the one juicy
// motion (strike-through), at the moment of consequence only. A right-side drawer
// (the first in the app), self-gating on `ledgerOpen` like the Gist workspace; no
// new pigment — the four semantic HLD accents (owed / paid / declared / neutral).

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../state';
import { findSectionById } from '../tests-panel/use-current-section';
import type { LedgerEntry, LedgerEntryKind } from '../../types';

const KIND_LABEL: Record<LedgerEntryKind, string> = {
  iou: 'IOU',
  'declared-heap': 'HEAP',
  'declared-deviation': 'DEVIATION',
  'deferred-diagnostic': 'DEFERRED',
};

/** Owed reads amber; a declaration reads cyan (informational); paid/waived go quiet. */
function kindClass(e: LedgerEntry): string {
  if (e.status === 'paid') return 'text-hld-green';
  if (e.status === 'waived') return 'text-hld-muted';
  if (e.kind === 'iou' || e.kind === 'deferred-diagnostic') return 'text-hld-feat-confidence';
  return 'text-hld-cyan'; // declared-heap / declared-deviation
}

function ageOf(createdAt: string): string {
  const then = Date.parse(createdAt);
  if (Number.isNaN(then)) return '';
  const ms = Date.now() - then;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / 60_000);
  return `${Math.max(0, mins)}m`;
}

export function LedgerDrawer() {
  const open = useStore((s) => s.ledgerOpen);
  const close = useStore((s) => s.closeLedger);
  const ledger = useStore((s) => s.ledger);
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const payLedgerEntry = useStore((s) => s.payLedgerEntry);
  const waiveLedgerEntry = useStore((s) => s.waiveLedgerEntry);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const titleOf = useMemo(() => {
    return (id: string) => (id === 'root' ? 'the whole document' : findSectionById(sections, id)?.title ?? id);
  }, [sections]);

  // Open first (the live debts), then paid, then waived — the working set on top.
  const rows = useMemo(() => {
    const rank = (s: LedgerEntry['status']) => (s === 'open' ? 0 : s === 'paid' ? 1 : 2);
    return [...ledger].sort((a, b) => rank(a.status) - rank(b.status) || b.id.localeCompare(a.id));
  }, [ledger]);

  if (!open) return null;

  const openCount = ledger.filter((e) => e.status === 'open').length;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[380px] max-w-full flex flex-col bg-hld-surface border-l border-hld-border text-hld-text font-sans shadow-2xl">
      <header className="shrink-0 flex items-center gap-[8px] px-[16px] h-[44px] border-b border-hld-border">
        <span aria-hidden className="w-[6px] h-[6px] rotate-45 bg-hld-feat-confidence" />
        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-hld-muted-text">
          Ledger · {openCount} open
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Close the ledger"
          className="ml-auto text-hld-muted hover:text-hld-text transition-colors"
        >
          <X size={14} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="p-[24px] font-mono text-[10px] tracking-[0.12em] uppercase text-hld-muted leading-[1.8]">
            The ledger is empty. Defer a structural-tension finding, or declare a heap, to record a
            concession the tool will remember.
          </div>
        ) : (
          <ul>
            {rows.map((e) => {
              const done = e.status !== 'open';
              return (
                <li
                  key={e.id}
                  className={`border-b border-hld-border/50 px-[16px] py-[10px] ${e.openedAtSectionId === selectedId ? 'bg-hld-cyan/5' : ''}`}
                >
                  <div className="flex items-center gap-[8px]">
                    <span className={`font-mono text-[8px] tracking-[0.14em] uppercase font-bold ${kindClass(e)}`}>
                      {KIND_LABEL[e.kind]}
                    </span>
                    <span className="font-mono text-[8px] tracking-[0.08em] uppercase text-hld-muted truncate">
                      {titleOf(e.openedAtSectionId)}
                    </span>
                    <span className="ml-auto font-mono text-[8px] text-hld-muted shrink-0">{ageOf(e.createdAt)}</span>
                  </div>
                  <div className={`mt-[3px] text-[11px] leading-snug ${done ? 'line-through text-hld-muted' : 'text-hld-text'}`}>
                    {e.owes}
                  </div>
                  {e.status === 'open' && e.kind === 'iou' && (
                    <div className="mt-[5px] flex gap-[10px]">
                      <button
                        type="button"
                        onClick={() => void payLedgerEntry(e.id, selectedId ?? undefined)}
                        title={selectedId ? 'Mark paid at the current section' : 'Mark paid'}
                        className="font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted hover:text-hld-green transition-colors"
                      >
                        ✓ pay
                      </button>
                      <button
                        type="button"
                        onClick={() => void waiveLedgerEntry(e.id)}
                        title="Waive — a debt honestly decided against"
                        className="font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted hover:text-hld-magenta transition-colors"
                      >
                        waive
                      </button>
                    </div>
                  )}
                  {e.status === 'open' && e.kind !== 'iou' && (
                    <div className="mt-[5px] flex gap-[10px]">
                      <button
                        type="button"
                        onClick={() => void waiveLedgerEntry(e.id)}
                        title="Retract this declaration"
                        className="font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted hover:text-hld-magenta transition-colors"
                      >
                        retract
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
