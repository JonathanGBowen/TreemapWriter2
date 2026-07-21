// Phase 5 — in-app merge conflict resolution.
//
// Opens when a pull comes back `mergeRequired` (sync-policy latches the conflict
// data into `pendingMerge` and flips `showConflictModal`). The user resolves
// each file via ConflictFileView, then submits: we call `syncResolveMerge`,
// which applies the choices and creates the merge commit on the Rust side.
//
// Cancel keeps `pendingMerge` latched (sync stays paused, the sidebar indicator
// stays clickable to reopen) — divergence doesn't fix itself by hiding it.

import React, { useCallback, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../../store';
import { repository as repo } from '../../../services/repository-registry';
import { onMergeResolved, retryPull } from '../../../services/sync-policy';
import type { PendingMerge, Resolution } from '../../../types';
import { ConflictFileView } from './ConflictFileView';
import { ModalShell } from '../shared/ModalShell';

export const ConflictResolutionModal: React.FC = () => {
  const isOpen = useStore((s) => s.showConflictModal);
  const pendingMerge = useStore((s) => s.pendingMerge);
  if (!isOpen || !pendingMerge) return null;
  // Keyed by theirCommit so per-file resolution state resets when a fresh
  // (post-`retryPull`) conflict set arrives.
  return <ConflictBody key={pendingMerge.theirCommit} merge={pendingMerge} />;
};

const ConflictBody: React.FC<{ merge: PendingMerge }> = ({ merge }) => {
  const setShow = useStore((s) => s.setShowConflictModal);
  const [resolutions, setResolutions] = useState<Record<string, Resolution | null>>(() =>
    Object.fromEntries(merge.conflicts.map((c) => [c.path, null])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOne = useCallback((path: string, r: Resolution | null) => {
    setResolutions((prev) => ({ ...prev, [path]: r }));
  }, []);

  const resolvedCount = merge.conflicts.filter((c) => resolutions[c.path] != null).length;
  const allResolved = resolvedCount === merge.conflicts.length;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    const list = merge.conflicts
      .map((c) => resolutions[c.path])
      .filter((r): r is Resolution => r != null);
    try {
      const outcome = await repo.syncResolveMerge(merge.theirCommit, merge.baseHead, list);
      switch (outcome.kind) {
        case 'resolved':
          toast.success(
            `Merged ${outcome.commits} remote commit${outcome.commits === 1 ? '' : 's'}.`,
          );
          await onMergeResolved();
          break;
        case 'stale':
          toast('Repository changed since detection — refreshing conflicts.');
          await retryPull();
          break;
        case 'noRemote':
          setError('No remote is configured for this project.');
          break;
        case 'failed':
          setError(outcome.reason);
          break;
      }
    } catch (e: unknown) {
      setError(String((e as { message?: string })?.message || e || 'Unknown error'));
    } finally {
      setBusy(false);
    }
  };

  // Cancel hides the modal but leaves the conflict latched.
  const onClose = () => {
    if (!busy) setShow(false);
  };

  return (
    <ModalShell
      accent="magenta"
      eyebrow="Sync"
      title="Resolve merge conflicts"
      onClose={onClose}
      widthClass="max-w-3xl"
      footer={
        <>
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-hld-muted-text">
            {resolvedCount} / {merge.conflicts.length} resolved
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="ml-auto bg-transparent border-none text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase cursor-pointer transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allResolved || busy}
            style={{ '--br-color': 'var(--color-hld-magenta)' } as React.CSSProperties}
            className="bracketed hld-lit-magenta px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {busy ? 'Merging…' : 'Resolve & merge'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-hld-muted-text leading-relaxed">
          The remote diverged from your local history. Choose <span className="text-hld-cyan">LOCAL</span>{' '}
          (your version) or <span className="text-hld-magenta">REMOTE</span> per hunk, or edit the merge
          directly. Nothing is committed until you resolve every file. Your local commits are never
          discarded.
        </p>

        {merge.conflicts.map((c) => (
          <ConflictFileView key={c.path} file={c} onChange={setOne} />
        ))}

        {error && (
          <div className="bg-hld-yellow/10 border border-hld-yellow/30 p-3 flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 text-hld-yellow shrink-0 mt-0.5" />
            <div className="text-[12px] text-hld-yellow font-mono break-all">{error}</div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
