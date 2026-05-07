import { entries } from 'idb-keyval';

/**
 * Phase 0 migration insurance. Reads every IndexedDB entry and triggers a
 * single JSON download. Use before Phase 3 to capture the legacy storage
 * shape; the importer will round-trip this file into the new layout.
 *
 * Deliberately self-contained: no store, no React, no other app code.
 */
export async function exportAllProjects(): Promise<void> {
  const all = await entries<IDBValidKey, unknown>();
  const payload = {
    schemaVersion: 'twriter-backup/v1',
    exportedAt: new Date().toISOString(),
    entries: all.map(([key, value]) => ({ key: String(key), value })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `twriter-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
