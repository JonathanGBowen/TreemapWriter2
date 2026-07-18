// Remote-aware project entry. Two modes via a SegControl:
//   • Clone  — load an existing TreemapWriter project from a remote (pull from
//     the start).
//   • Create — make a new project locally and publish it to an empty remote.
//
// Both collect a remote URL + PAT, then on submit fire a folder dialog and the
// matching project-state thunk. The thunks resolve `true` on success (dismiss),
// `false` if the folder picker was cancelled (stay open, no error), and throw on
// failure (stay open, show the verbatim message) — same UX as SyncConfigModal.

import React, { useState } from 'react';
import { X, GitBranch, Loader2, AlertCircle, Check } from 'lucide-react';
import { useStore } from '../../../store';
import { isTauri } from '../../../services/tauri-environment';
import { SegControl } from '../shared/SegControl';

export const RemoteProjectModal: React.FC = () => {
  const isOpen = useStore((s) => s.showRemoteProjectModal);
  const setShow = useStore((s) => s.setShowRemoteProjectModal);
  const cloneRemoteProject = useStore((s) => s.cloneRemoteProject);
  const createProjectWithRemote = useStore((s) => s.createProjectWithRemote);
  const onClose = () => setShow(false);

  // 0 = Clone (load existing), 1 = Create (new + publish).
  const [mode, setMode] = useState(0);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isClone = mode === 0;
  const canSubmit = url.trim().length > 0 && token.trim().length > 0 && !busy;

  const handleSubmit = async () => {
    if (!isTauri()) {
      setError('Remote projects require the desktop app. The browser build is read-only.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = isClone
        ? await cloneRemoteProject(url, token)
        : await createProjectWithRemote(url, token);
      if (ok) {
        setUrl('');
        setToken('');
        setShow(false);
      }
      // ok === false → folder picker cancelled; keep the modal open silently.
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
              New from remote
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
          <SegControl
            ariaLabel="Remote project mode"
            value={mode}
            onChange={(i) => { setMode(i); setError(null); }}
            options={[
              { glyph: '↓', label: 'Clone', fine: 'load existing' },
              { glyph: '↑', label: 'Create', fine: 'new + publish' },
            ]}
          />

          <p className="text-[12px] text-hld-muted leading-relaxed">
            {isClone
              ? 'Load an existing TreemapWriter project from a private GitHub repository. You will pick an empty local folder to clone into.'
              : 'Create a new project locally and publish it to an empty private GitHub repository. Pick a folder for the new project.'}
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
              access to Contents. The token stays in your OS keyring, not on disk.
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
            {busy ? 'Working…' : isClone ? 'Clone' : 'Create & publish'}
          </button>
        </div>
      </div>
    </div>
  );
};
