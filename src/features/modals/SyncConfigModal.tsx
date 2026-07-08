// Phase 4d — one-time setup UI for git sync.
//
// The user pastes a GitHub remote URL + a PAT. We:
//   1. Save the PAT to the OS keyring under service "git".
//   2. Set the local repo's `origin` URL and mirror to .twriter/settings.json.
//   3. Attempt one push to validate auth. If it succeeds, dismiss and let
//      sync-policy take over. If it fails, keep the modal open with the
//      verbatim error so the user can fix the URL/token without re-pasting.

import React, { useState } from 'react';
import { X, GitBranch, Loader2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../store';
import { repository as repo } from '../../services/repository-registry';
import { setSecret } from '../../services/credentials';
import { isTauri } from '../../services/tauri-environment';

export const SyncConfigModal: React.FC = () => {
  const isOpen = useStore((s) => s.showSyncConfigModal);
  const setShow = useStore((s) => s.setShowSyncConfigModal);
  const onClose = () => setShow(false);

  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSubmit = url.trim().length > 0 && token.trim().length > 0 && !busy;

  const handleSubmit = async () => {
    if (!isTauri()) {
      setError('Sync requires the desktop app. The browser build is read-only for projects.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setSecret('git', token.trim());
      await repo.configureRemote(url.trim());
      const result = await repo.syncPush();
      if (result.kind === 'pushed' || result.kind === 'upToDate') {
        toast.success('Sync configured. Future commits push automatically.');
        setShow(false);
      } else if (result.kind === 'noRemote') {
        setError('Internal: remote was set but the next push reports no remote. Try again.');
      } else if (result.kind === 'nonFastForward') {
        setError(
          'The remote already has commits this project does not. Either start with an empty GitHub repo, or pull first via a git client.',
        );
      }
    } catch (e: any) {
      setError(String(e?.message || e || 'Unknown error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      <div
        className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />

      <div className="relative w-[520px] flex flex-col bg-hld-bg border border-hld-border shadow-[0_0_40px_rgba(0,232,245,0.1)] overflow-hidden font-sans pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-[12px_16px] bg-hld-surface border-b border-hld-border">
          <div className="flex items-center gap-[10px]">
            <GitBranch className="text-hld-cyan" size={16} />
            <h2 className="text-[12px] font-bold text-hld-text font-mono uppercase tracking-[0.1em]">
              Configure Sync
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-hld-muted hover:text-hld-cyan transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-[12px] text-hld-muted leading-relaxed">
            Sync this project to a private GitHub repository. Every commit will
            push automatically. The token stays in your OS keyring, not on disk.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-[0.1em] text-hld-muted">
              Remote URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/username/repo.git"
              disabled={busy}
              className="bg-hld-surface border border-hld-border text-[12px] p-2 font-mono text-hld-text focus:outline-none focus:border-hld-cyan disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-[0.1em] text-hld-muted">
              Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_… or github_pat_…"
              disabled={busy}
              className="bg-hld-surface border border-hld-border text-[12px] p-2 font-mono text-hld-text focus:outline-none focus:border-hld-cyan disabled:opacity-50"
            />
            <p className="text-[10px] text-hld-muted leading-relaxed mt-1">
              Use a fine-grained PAT scoped to this single repo with read/write
              access to Contents. GitHub → Settings → Developer settings →
              Personal access tokens → Fine-grained tokens.
            </p>
          </div>

          {error && (
            <div className="bg-hld-yellow/10 border border-hld-yellow/30 p-3 flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-hld-yellow shrink-0 mt-0.5" />
              <div className="text-[12px] text-hld-yellow font-mono break-all">
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex justify-end gap-2 border-hld-border bg-hld-surface">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 bg-transparent border border-hld-border text-hld-text text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-surface-2 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-hld-cyan text-hld-bg text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-cyan/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {busy ? 'Testing…' : 'Test & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
