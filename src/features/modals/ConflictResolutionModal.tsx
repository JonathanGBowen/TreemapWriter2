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
import { AlertCircle, Check, GitMerge, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../store';
import { repository as repo } from '../../services/repository-registry';
import { onMergeResolved, retryPull } from '../../services/sync-policy';
import type { PendingMerge, Resolution } from '../../types';
import { ConflictFileView } from './ConflictFileView';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[760px] max-h-[85vh] flex flex-col bg-hld-bg border border-hld-border shadow-[0_0_40px_rgba(255,0,170,0.12)] overflow-hidden font-sans pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-[12px_16px] bg-hld-surface border-b border-hld-border">
          <div className="flex items-center gap-[10px]">
            <GitMerge className="text-hld-magenta" size={16} />
            <h2 className="text-[12px] font-bold text-hld-text font-mono uppercase tracking-[0.1em]">
              Resolve Merge Conflicts
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-hld-muted-text hover:text-hld-magenta transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3 overflow-auto">
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
            <div className="bg-hld-magenta/10 border border-hld-magenta/30 p-3 flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-hld-magenta shrink-0 mt-0.5" />
              <div className="text-[12px] text-hld-magenta font-mono break-all">{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex items-center justify-between gap-2 border-hld-border bg-hld-surface">
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-hld-muted-text">
            {resolvedCount} / {merge.conflicts.length} resolved
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 bg-transparent border border-hld-border text-hld-text text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-surface2 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!allResolved || busy}
              className="px-4 py-2 bg-hld-magenta text-hld-bg text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-magenta/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {busy ? 'Merging…' : 'Resolve & Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
