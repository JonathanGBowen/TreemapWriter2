// The sync home for the open project. Two views on one flag:
//   • no remote (or "Change remote…") — URL + PAT form; submit runs
//     attachRemote (keyring → origin → one validating push → policy rebind).
//   • remote configured — live status (shared summarizeSync vocabulary, so it
//     always agrees with the sidebar pip), remote URL, branch, ahead/behind,
//     any latched error; actions: Sync now · Change remote…
//
// Sync network calls go through sync-policy (attachRemote/retrySync) — never
// the repository directly. The one direct repository call is syncState, which
// is purely local (same precedent as ConflictResolutionModal's resolve call).

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../store';
import { attachRemote, retrySync } from '../../services/sync-policy';
import { repository } from '../../services/repository-registry';
import { isTauri } from '../../services/tauri-environment';
import { summarizeSync, type SyncSummary } from '../sidebar/sync-status';
import { Pip } from '../shared/Pip';
import { ModalShell } from './ModalShell';
import { RemoteAuthFields } from './RemoteAuthFields';

const QUIET_BTN =
  'px-3 py-2 bg-transparent border border-hld-border text-hld-text text-[10px] font-mono uppercase tracking-[0.1em] hover:bg-hld-surface-2 transition-colors disabled:opacity-50';
const CANCEL_BTN =
  'ml-auto bg-transparent border-none text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase cursor-pointer transition-colors disabled:opacity-50';
const LIT_BTN =
  'bracketed hld-lit px-[20px] py-[10px] font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2';
const CYAN = { '--br-color': 'var(--color-hld-cyan)' } as React.CSSProperties;

const ErrorBlock: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-hld-yellow/10 border border-hld-yellow/30 p-3 flex gap-2 items-start">
    <AlertCircle className="w-4 h-4 text-hld-yellow shrink-0 mt-0.5" />
    <div className="text-[12px] text-hld-yellow font-mono break-all">{message}</div>
  </div>
);

const StatusRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline gap-3">
    <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-hld-muted-text w-[64px] shrink-0">
      {label}
    </span>
    <span className="text-[11px] font-mono text-hld-text break-all">{value}</span>
  </div>
);

/** Read-only status view: live pip + the configured remote's local git state. */
const StatusView: React.FC<{
  sync: SyncSummary;
  remoteUrl: string | null;
  branch: string | null;
  ahead: number;
  behind: number;
  syncError: string | null;
}> = ({ sync, remoteUrl, branch, ahead, behind, syncError }) => {
  const position =
    ahead === 0 && behind === 0
      ? 'in sync'
      : [ahead > 0 ? `${ahead} unpushed` : null, behind > 0 ? `${behind} to pull` : null]
          .filter(Boolean)
          .join(' · ');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-[10px]">
        <Pip status={sync.pip} pulse={sync.pulse} live={sync.pulse} />
        <span className="text-[12px] font-mono text-hld-text">{sync.text}</span>
      </div>
      <div className="flex flex-col gap-2 border border-hld-border p-3">
        <StatusRow label="Remote" value={remoteUrl ?? '—'} />
        <StatusRow label="Branch" value={branch ?? '—'} />
        <StatusRow label="Position" value={position} />
      </div>
      {syncError && <ErrorBlock message={syncError} />}
    </div>
  );
};

export const SyncConfigModal: React.FC = () => {
  const isOpen = useStore((s) => s.showSyncConfigModal);
  const setShow = useStore((s) => s.setShowSyncConfigModal);
  const syncStatus = useStore((s) => s.syncStatus);
  const syncError = useStore((s) => s.syncError);
  const syncAhead = useStore((s) => s.syncAhead);
  const syncBehind = useStore((s) => s.syncBehind);

  const [view, setView] = useState<'status' | 'form'>('form');
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On open: read the purely-local git state to pick the view and show the
  // configured remote. The live status line itself comes from the store.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setToken('');
    let cancelled = false;
    void repository
      .syncState()
      .then((s) => {
        if (cancelled) return;
        setRemoteUrl(s.remoteUrl);
        setBranch(s.branch);
        setUrl(s.remoteUrl ?? '');
        setView(s.hasRemote ? 'status' : 'form');
      })
      .catch(() => {
        if (!cancelled) setView('form');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const onClose = () => {
    if (!busy) setShow(false);
  };
  const canSubmit = url.trim().length > 0 && token.trim().length > 0 && !busy;
  const sync = summarizeSync(syncStatus, syncError, syncAhead, syncBehind);

  const handleSubmit = async () => {
    if (!isTauri()) {
      setError('Sync requires the desktop app. The browser build is read-only for projects.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await attachRemote(url, token);
      if (result.kind === 'pushed' || result.kind === 'upToDate') {
        toast.success('Sync configured. Future commits push automatically.');
        setShow(false);
      } else if (result.kind === 'noRemote') {
        setError('Internal: remote was set but the next push reports no remote. Try again.');
      } else if (result.kind === 'nonFastForward') {
        setError(
          'The remote already has commits this project does not. Sync will pull next and offer in-app conflict resolution — or use Clone for existing remotes.',
        );
      } else if (result.kind === 'failed') {
        setError(result.failure.message);
      }
    } catch (e: unknown) {
      setError(String((e as { message?: string })?.message || e || 'Unknown error'));
    } finally {
      setBusy(false);
    }
  };

  const statusFooter = (
    <>
      <button type="button" onClick={onClose} className={CANCEL_BTN}>
        Close
      </button>
      <button type="button" onClick={() => { setError(null); setView('form'); }} className={QUIET_BTN}>
        Change remote…
      </button>
      <button
        type="button"
        onClick={() => {
          toast('Syncing…');
          void retrySync();
        }}
        style={CYAN}
        className={LIT_BTN}
      >
        Sync now
      </button>
    </>
  );

  const formFooter = (
    <>
      <button type="button" onClick={onClose} disabled={busy} className={CANCEL_BTN}>
        Cancel
      </button>
      {remoteUrl && (
        <button type="button" onClick={() => { setError(null); setView('status'); }} disabled={busy} className={QUIET_BTN}>
          Back
        </button>
      )}
      <button type="button" onClick={handleSubmit} disabled={!canSubmit} style={CYAN} className={LIT_BTN}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        {busy ? 'Testing…' : 'Test & save'}
      </button>
    </>
  );

  return (
    <ModalShell
      eyebrow="Project"
      title="GitHub sync"
      sub={view === 'status' ? sync.text : undefined}
      onClose={onClose}
      widthClass="max-w-lg"
      onPrimary={view === 'form' && canSubmit ? handleSubmit : undefined}
      footer={view === 'status' ? statusFooter : formFooter}
    >
      {view === 'status' ? (
        <StatusView
          sync={sync}
          remoteUrl={remoteUrl}
          branch={branch}
          ahead={syncAhead}
          behind={syncBehind}
          syncError={syncError}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[12px] text-hld-muted-text leading-relaxed">
            Sync this project to a private GitHub repository. Every commit will
            push automatically. The token stays in your OS keyring, not on disk.
          </p>
          <RemoteAuthFields
            url={url}
            onUrlChange={setUrl}
            token={token}
            onTokenChange={setToken}
            disabled={busy}
          />
          {error && <ErrorBlock message={error} />}
        </div>
      )}
    </ModalShell>
  );
};
