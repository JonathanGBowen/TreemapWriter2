// Phase 3h — first-launch migration modal.
//
// Subscribes to `showMigrationModal` (added to ui-state). Auto-opened by
// `use-legacy-migration` when warranted; can be dismissed by the user
// without importing.
//
// Three flows:
//   1. Import from a JSON backup file the user picks via Tauri dialog.
//   2. Import directly from this Tauri webview's IDB (if any
//      socratic_p_* keys exist — rare; only post-Phase-2-pre-Phase-3 builds).
//   3. Skip — record the state so we don't ask again.

import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { Archive, FolderOpen, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../store';
import { isTauri } from '../../services/tauri-environment';
import {
  executePlan,
  plan as planImport,
  type BackupFile,
} from './importer';
import {
  markMigrationDone,
  markMigrationSkipped,
  snapshotLocalIdbAsBackup,
} from './use-legacy-migration';

type Phase = 'choose' | 'picking-target' | 'running' | 'done' | 'error';

export const MigrationModal: React.FC = () => {
  const isOpen = useStore((s) => s.showMigrationModal);
  const setShow = useStore((s) => s.setShowMigrationModal);
  const [phase, setPhase] = useState<Phase>('choose');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string[]>([]);

  if (!isOpen) return null;

  const onClose = () => setShow(false);

  const skip = () => {
    markMigrationSkipped();
    onClose();
  };

  const importFromFile = async () => {
    setError(null);
    setPhase('picking-target');
    try {
      const filePath = await openDialog({
        title: 'Pick a TreemapWriter backup file',
        multiple: false,
        directory: false,
        filters: [{ name: 'TreemapWriter backup', extensions: ['json'] }],
      });
      if (!filePath || Array.isArray(filePath)) {
        setPhase('choose');
        return;
      }
      const text = await readTextFile(filePath);
      const backup = JSON.parse(text) as BackupFile;
      await runImport(backup);
    } catch (err) {
      setError(formatError(err));
      setPhase('error');
    }
  };

  const importFromLocalIdb = async () => {
    setError(null);
    setPhase('picking-target');
    try {
      const backup = await snapshotLocalIdbAsBackup();
      await runImport(backup);
    } catch (err) {
      setError(formatError(err));
      setPhase('error');
    }
  };

  const runImport = async (backup: BackupFile) => {
    const targetDir = await openDialog({
      title: 'Pick a folder where TreemapWriter should put your projects',
      multiple: false,
      directory: true,
    });
    if (!targetDir || Array.isArray(targetDir)) {
      setPhase('choose');
      return;
    }
    const built = planImport(backup, targetDir);
    if (built.projects.length === 0) {
      toast.message('No legacy projects found in that backup.');
      setPhase('choose');
      return;
    }
    setProgress({ done: 0, total: built.commands.length });
    setPhase('running');
    await executePlan(built, (done, total) => setProgress({ done, total }));
    setSummary(built.projects.map((p) => `${p.name} → ${p.folder}`));
    setPhase('done');
    markMigrationDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05090d]/80 backdrop-blur-sm">
      <div className="bg-hld-surface border border-hld-cyan/30 rounded-lg shadow-xl w-full max-w-md p-6 mx-4 font-sans">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Archive
              size={16}
              className="text-hld-cyan"
            />
            <h3 className="text-hld-text font-bold text-sm uppercase tracking-wider font-mono">
              Welcome to TreemapWriter
            </h3>
          </div>
          {phase !== 'running' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-hld-text"
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {phase === 'choose' && (
          <>
            <p className="text-[12px] text-hld-muted mb-4 leading-relaxed">
              Your dissertation now lives on disk as plain markdown plus
              git history. If you have projects in an older browser-only
              build, import them now.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={importFromFile}
                className="flex items-center gap-2 p-3 border border-hld-cyan/30 hover:bg-hld-cyan/5 rounded text-[12px] text-hld-text"
              >
                <FolderOpen size={14} className="shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="font-mono uppercase tracking-wider text-[10px] text-hld-cyan">
                    Import from backup file
                  </span>
                  <span className="text-[10px] opacity-70">
                    Pick the .json file you saved with the Backup button.
                  </span>
                </div>
              </button>
              {/* The local-IDB path reads the *webview's* IndexedDB, which on the
                  desktop build is effectively always empty (browser-only projects
                  live in the browser's IDB, a different storage origin). Showing it
                  here only misleads, so it's hidden on desktop; the backup-file path
                  above is the real migration route. */}
              {!isTauri() && (
                <button
                  onClick={importFromLocalIdb}
                  className="flex items-center gap-2 p-3 border border-hld-yellow/30 hover:bg-hld-yellow/5 rounded text-[12px] text-hld-text"
                >
                  <Archive size={14} className="shrink-0" />
                  <div className="flex flex-col items-start">
                    <span className="font-mono uppercase tracking-wider text-[10px] text-hld-yellow">
                      Import from this device&rsquo;s cache
                    </span>
                    <span className="text-[10px] opacity-70">
                      Use only if you ran an early desktop build that wrote
                      projects into the app&rsquo;s local cache.
                    </span>
                  </div>
                </button>
              )}
              <button
                onClick={skip}
                className="flex items-center gap-2 p-3 border border-hld-border hover:bg-hld-surface2 rounded text-[12px] text-hld-muted"
              >
                <span className="font-mono uppercase tracking-wider text-[10px]">
                  Skip — start fresh
                </span>
              </button>
            </div>
          </>
        )}

        {phase === 'picking-target' && (
          <p className="text-[12px] text-hld-muted">
            Waiting for folder pick&hellip;
          </p>
        )}

        {phase === 'running' && (
          <>
            <p className="text-[12px] text-hld-muted mb-2">
              Importing projects&hellip; do not close this window.
            </p>
            <div className="w-full h-1 bg-hld-surface2 rounded overflow-hidden">
              <div
                className="h-1 bg-hld-cyan transition-all"
                style={{
                  width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-[10px] mt-2 font-mono text-hld-muted">
              {progress.done} / {progress.total} commands
            </p>
          </>
        )}

        {phase === 'done' && (
          <>
            <p className="text-[12px] text-hld-green mb-3 font-mono uppercase tracking-wider">
              Import complete
            </p>
            <ul className="text-[11px] text-hld-muted mb-4 max-h-40 overflow-y-auto space-y-1">
              {summary.map((line) => (
                <li key={line} className="font-mono">
                  {line}
                </li>
              ))}
            </ul>
            <button
              onClick={onClose}
              className="w-full p-2 border border-hld-green/40 hover:bg-hld-green/10 rounded text-[12px] font-mono uppercase tracking-wider text-hld-green"
            >
              Done
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="text-[12px] text-hld-magenta mb-3 font-mono uppercase tracking-wider">
              Import failed
            </p>
            <pre className="text-[10px] text-hld-muted whitespace-pre-wrap bg-hld-surface2 p-2 rounded mb-3 max-h-40 overflow-y-auto">
              {error}
            </pre>
            <button
              onClick={() => setPhase('choose')}
              className="w-full p-2 border border-hld-border hover:bg-hld-surface2 rounded text-[12px] font-mono uppercase tracking-wider"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

function formatError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ''}`;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}
