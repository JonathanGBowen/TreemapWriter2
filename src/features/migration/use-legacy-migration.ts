// Phase 3h — first-launch migration flow.
//
// On Tauri launch, decide whether to show the MigrationModal. Decision
// rules:
//
//   - If the migration state is already "done" or "skipped" → no.
//   - If running in the browser (not Tauri) → no.
//   - If the Rust recent-projects DB has rows → no (user already has
//     projects on disk).
//   - Otherwise → yes. The modal offers two paths:
//       (a) Import from a JSON backup file (Phase 0 export)
//       (b) Import from this Tauri webview's own IndexedDB (rare —
//           only if the user ran an early Tauri build that wrote
//           socratic_p_* keys to the webview's IDB)
//       (c) Skip and start fresh.
//
// State is tracked in localStorage (key `twriter.migration.state`). Two
// permitted values: 'done' | 'skipped'. Anything else means "ask".

import { entries as idbEntries } from 'idb-keyval';
import { useEffect, useState } from 'react';
import { isTauri } from '../../services/tauri-environment';
import { repository } from '../../services/repository-registry';

const STATE_KEY = 'twriter.migration.state';

export type MigrationState = 'pending' | 'done' | 'skipped';

export interface LegacyDetection {
  /** Always at least 0. Number of `socratic_p_*` entries in the local IDB. */
  webviewIdbProjectCount: number;
  /** Whether the migration modal should auto-open on this launch. */
  shouldPrompt: boolean;
  /** Stored migration state, default `'pending'`. */
  state: MigrationState;
}

export function useLegacyMigration(): LegacyDetection {
  const [detection, setDetection] = useState<LegacyDetection>({
    webviewIdbProjectCount: 0,
    shouldPrompt: false,
    state: readState(),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = readState();
      if (state !== 'pending' || !isTauri()) {
        if (!cancelled) {
          setDetection({
            webviewIdbProjectCount: 0,
            shouldPrompt: false,
            state,
          });
        }
        return;
      }

      const idbCount = await countLegacyIdb();
      const recent = await repository.getMeta();
      const shouldPrompt = recent.length === 0;

      if (!cancelled) {
        setDetection({
          webviewIdbProjectCount: idbCount,
          shouldPrompt,
          state,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return detection;
}

export function markMigrationDone(): void {
  localStorage.setItem(STATE_KEY, 'done');
}

export function markMigrationSkipped(): void {
  localStorage.setItem(STATE_KEY, 'skipped');
}

function readState(): MigrationState {
  const v = localStorage.getItem(STATE_KEY);
  return v === 'done' || v === 'skipped' ? v : 'pending';
}

async function countLegacyIdb(): Promise<number> {
  try {
    const all = await idbEntries<IDBValidKey, unknown>();
    return all.filter(([k]) => String(k).startsWith('socratic_p_')).length;
  } catch {
    return 0;
  }
}

/**
 * Read every `socratic_p_*` entry from the local Tauri-webview IDB and
 * synthesize a backup-file-shaped object the importer can consume. Only
 * relevant for users who ran an early Tauri build (Phase 2) before
 * Phase 3 swapped the repository.
 */
export async function snapshotLocalIdbAsBackup(): Promise<{
  schemaVersion: string;
  exportedAt: string;
  entries: Array<{ key: string; value: unknown }>;
}> {
  const all = await idbEntries<IDBValidKey, unknown>();
  return {
    schemaVersion: 'twriter-backup/v1',
    exportedAt: new Date().toISOString(),
    entries: all.map(([key, value]) => ({ key: String(key), value })),
  };
}
