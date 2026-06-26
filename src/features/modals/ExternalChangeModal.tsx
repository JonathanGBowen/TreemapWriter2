// External-edit reconciliation prompt.
//
// Opens when project.md changed on disk outside the app AND the in-app editor
// has unsaved edits, so neither side can win silently (see
// services/sync-policy.ts → checkExternalChanges). The user chooses: take the
// on-disk version (losing in-app edits) or keep the in-app version (overwriting
// the file). When the buffer is clean, sync-policy reloads automatically and
// this modal never appears.

import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { reloadFromDisk } from '../../services/sync-policy';

export const ExternalChangeModal: React.FC = () => {
  const isOpen = useStore((s) => s.showExternalChangeModal);
  const setShow = useStore((s) => s.setShowExternalChangeModal);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05090d]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-hld-surface border border-hld-cyan/30 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col items-center p-6 mx-4">
        <div className="w-12 h-12 rounded-full bg-hld-magenta/20 flex items-center justify-center mb-4">
          <AlertCircle className="text-hld-magenta shrink-0" size={24} />
        </div>
        <h3 className="text-hld-text font-bold text-lg mb-2 text-center uppercase tracking-wider font-mono">
          File Changed on Disk
        </h3>
        <p className="text-hld-muted text-sm text-center mb-6">
          <span className="font-mono text-hld-cyan">project.md</span> was changed outside the app,
          but you have unsaved edits here. Reload from disk to take the external version (your
          unsaved edits are lost), or keep yours to overwrite the file.
        </p>
        <div className="flex w-full gap-3">
          <button
            onClick={reload}
            disabled={busy}
            className="flex-1 py-2 px-4 border border-hld-surface-2 text-hld-muted hover:bg-hld-surface-2 rounded font-mono uppercase tracking-wider text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Reload from disk
          </button>
          <button
            onClick={keepMine}
            disabled={busy}
            className="flex-1 py-2 px-4 bg-hld-magenta hover:bg-hld-magenta/80 text-white rounded font-mono uppercase tracking-wider text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Keep mine
          </button>
        </div>
      </div>
    </div>
  );
};
