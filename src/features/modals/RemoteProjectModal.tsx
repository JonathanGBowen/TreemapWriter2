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
import { Loader2, AlertCircle, Check } from 'lucide-react';
import { useStore } from '../../store';
import { isTauri } from '../../services/tauri-environment';
import { ModalShell } from './ModalShell';
import { SegControl } from './SegControl';
import { RemoteAuthFields } from './RemoteAuthFields';

export const RemoteProjectModal: React.FC = () => {
  const isOpen = useStore((s) => s.showRemoteProjectModal);
  const setShow = useStore((s) => s.setShowRemoteProjectModal);
  const cloneRemoteProject = useStore((s) => s.cloneRemoteProject);
  const createProjectWithRemote = useStore((s) => s.createProjectWithRemote);

  // 0 = Clone (load existing), 1 = Create (new + publish).
  const [mode, setMode] = useState(0);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const onClose = () => {
    if (!busy) setShow(false);
  };
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
    } catch (e: unknown) {
      setError(String((e as { message?: string })?.message || e || 'Unknown error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      eyebrow="Project"
      title="New from remote"
      onClose={onClose}
      widthClass="max-w-lg"
      onPrimary={handleSubmit}
      primaryLabel={
        <span className="flex items-center gap-2">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {busy ? 'Working…' : isClone ? 'Clone' : 'Create & publish'}
        </span>
      }
      primaryDisabled={!canSubmit}
    >
      <div className="flex flex-col gap-4">
        <SegControl
          ariaLabel="Remote project mode"
          value={mode}
          onChange={(i) => { setMode(i); setError(null); }}
          options={[
            { glyph: '↓', label: 'Clone', fine: 'load existing' },
            { glyph: '↑', label: 'Create', fine: 'new + publish' },
          ]}
        />

        <p className="text-[12px] text-hld-muted-text leading-relaxed">
          {isClone
            ? 'Load an existing TreemapWriter project from a private GitHub repository. You will pick an empty local folder to clone into.'
            : 'Create a new project locally and publish it to an empty private GitHub repository. Pick a folder for the new project.'}
        </p>

        <RemoteAuthFields
          url={url}
          onUrlChange={setUrl}
          token={token}
          onTokenChange={setToken}
          disabled={busy}
        />

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
