// External-edit reconciliation prompt.
//
// Opens when project.md changed on disk outside the app AND the in-app editor
// has unsaved edits, so neither side can win silently (see
// services/sync-policy.ts → checkExternalChanges). The user chooses: take the
// on-disk version (losing in-app edits) or keep the in-app version (overwriting
// the file). When the buffer is clean, sync-policy reloads automatically and
// this modal never appears.
//
// ESC/backdrop dismisses without choosing — safe, because the divergence is
// still there and checkExternalChanges re-prompts on the next window focus.

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from '../../../store';
import { reloadFromDisk } from '../../../services/sync-policy';
import { ModalShell } from '../shared/ModalShell';

export const ExternalChangeModal: React.FC = () => {
  const isOpen = useStore((s) => s.showExternalChangeModal);
  const setShow = useStore((s) => s.setShowExternalChangeModal);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const onClose = () => {
    if (!busy) setShow(false);
  };

  // Take the on-disk version, discarding the in-app buffer. Re-reads disk fresh
  // (via loadProject), so a second external change between detect and click is
  // picked up too.
  const reload = async () => {
    setBusy(true);
    try {
      await reloadFromDisk();
      setShow(false);
    } finally {
      setBusy(false);
    }
  };

  // Keep the in-app version: persist it now so it overwrites the file and the
  // prompt stops re-firing on the next focus.
  const keepMine = async () => {
    setBusy(true);
    try {
      await saveCurrentState();
      setShow(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      eyebrow="Project"
      title="File changed on disk"
      onClose={onClose}
      widthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={reload}
            disabled={busy}
            className="ml-auto px-3 py-2 bg-transparent border border-hld-border text-hld-text text-[10px] font-mono uppercase tracking-[0.1em] hover:bg-hld-surface-2 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            Reload from disk
          </button>
          <button
            type="button"
            onClick={keepMine}
            disabled={busy}
            style={{ '--br-color': 'var(--color-hld-cyan)' } as React.CSSProperties}
            className="bracketed hld-lit px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            Keep mine
          </button>
        </>
      }
    >
      <p className="text-[12px] text-hld-muted-text leading-relaxed">
        <span className="font-mono text-hld-cyan">project.md</span> was changed outside the app,
        but you have unsaved edits here. Reload from disk to take the external version (your
        unsaved edits are lost), or keep yours to overwrite the file.
      </p>
    </ModalShell>
  );
};
