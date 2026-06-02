// Phase 3g — legacy IndexedDB backup → on-disk projects.
//
// The Phase 0 backup is a single JSON file produced by
// `src/lib/exportBackup.ts`. It contains every key in the user's
// `idb-keyval` store, including one `socratic_p_<id>` entry per project
// plus a `socratic_meta_v1` entry with the project list.
//
// This module is split into a PURE planning function and an EXECUTOR
// so the importer is unit-testable without touching Tauri:
//
//   plan(backup, targetDir) -> ImportCommand[]   ← pure; tested in vitest
//   executePlan(commands)   -> Promise<void>     ← invokes Tauri IPC
//
// Each project becomes a subfolder under the user-chosen `targetDir`,
// named by slugifying the project's display name. Revisions are replayed
// chronologically: each one writes the snapshot's content and creates a
// git commit. The final commit captures the project's current state with
// the message "Imported from legacy backup".

import { invoke } from '@tauri-apps/api/core';
import type {
  Persona,
  PromptsConfig,
  Snapshot,
  TestSuite,
} from '../../types';
import type { StoredProjectData } from '../../services/repository';

/** Phase 0 backup format from `src/lib/exportBackup.ts`. */
export interface BackupFile {
  schemaVersion: string;
  exportedAt: string;
  entries: Array<{ key: string; value: unknown }>;
}

export type SnapshotTrigger = 'manual' | 'autosave' | 'pre-ai-write';
export type AffectedScope = 'all' | { sectionIds: string[] };

export type ImportCommand =
  | { kind: 'project_create'; path: string; name: string }
  | { kind: 'project_write'; data: StoredProjectData }
  | {
      kind: 'snapshot_commit';
      message: string;
      trigger: SnapshotTrigger;
      affectedScope: AffectedScope;
    };

export interface ImportPlan {
  commands: ImportCommand[];
  /** Per-project summary the UI surfaces in the migration progress view. */
  projects: Array<{ name: string; folder: string; revisionCount: number }>;
}

/**
 * Build the import plan. Pure — no IPC, no fs, no random IDs.
 * Caller passes a stable base path; the importer derives one subfolder per
 * project. Subfolder collisions are resolved by appending a numeric suffix.
 */
export function plan(backup: BackupFile, targetDir: string): ImportPlan {
  const commands: ImportCommand[] = [];
  const projects: ImportPlan['projects'] = [];
  const usedFolders = new Set<string>();

  const projectEntries = backup.entries.filter((e) =>
    e.key.startsWith('socratic_p_'),
  );

  for (const entry of projectEntries) {
    const value = entry.value as Partial<LegacyProjectData> | undefined;
    if (!value || typeof value !== 'object') continue;

    const name = (value.projectName ?? 'Untitled Project').toString();
    const folderName = uniqueFolderName(slugify(name), usedFolders);
    usedFolders.add(folderName);
    const folder = joinPath(targetDir, folderName);

    commands.push({ kind: 'project_create', path: folder, name });

    const revisions = Array.isArray(value.revisions) ? value.revisions : [];
    // Replay revisions chronologically (oldest first).
    const sortedRevs = [...revisions].sort(
      (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
    );

    for (const rev of sortedRevs) {
      const data = revisionToStoredData(rev, value);
      commands.push({ kind: 'project_write', data });
      commands.push({
        kind: 'snapshot_commit',
        message: `replayed: ${rev.id ?? 'unknown'}`,
        trigger: normalizeTrigger(rev.trigger),
        affectedScope: normalizeScope(rev.affectedScope),
      });
    }

    // Final: current state + closing commit.
    const currentData = currentStateToStoredData(value);
    commands.push({ kind: 'project_write', data: currentData });
    commands.push({
      kind: 'snapshot_commit',
      message: 'Imported from legacy backup',
      trigger: 'manual',
      affectedScope: 'all',
    });

    projects.push({
      name,
      folder,
      revisionCount: sortedRevs.length,
    });
  }

  return { commands, projects };
}

/** Run a plan against the live Tauri backend. UI hooks in to report progress. */
export async function executePlan(
  plan: ImportPlan,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = plan.commands.length;
  let done = 0;
  for (const cmd of plan.commands) {
    await runCommand(cmd);
    done += 1;
    onProgress?.(done, total);
  }
}

// --- internals -----------------------------------------------------------

interface LegacyProjectData {
  projectName?: string;
  markdown?: string;
  localDraft?: string;
  testSuite?: TestSuite;
  hiddenSectionIds?: string[];
  activePersonaId?: string;
  customPersonas?: Persona[];
  promptsConfig?: PromptsConfig;
  interpolationConfig?: PromptsConfig; // legacy alias
  cachedCoachAdvice?: { inputHash: string; advice: string } | null;
  revisions?: Snapshot[];
  lastModified?: number;
  uiState?: StoredProjectData['uiState'];
}

async function runCommand(cmd: ImportCommand): Promise<void> {
  switch (cmd.kind) {
    case 'project_create':
      await invoke('project_create', { path: cmd.path, name: cmd.name });
      return;
    case 'project_write':
      await invoke('project_write', { data: cmd.data });
      return;
    case 'snapshot_commit':
      await invoke('snapshot_commit', {
        message: cmd.message,
        trigger: cmd.trigger,
        affectedScope: cmd.affectedScope,
      });
      return;
  }
}

function revisionToStoredData(
  rev: Snapshot,
  whole: Partial<LegacyProjectData>,
): StoredProjectData {
  return {
    projectName: whole.projectName,
    markdown: rev.markdown ?? '',
    testSuite: rev.testSuite ?? {},
    // Past snapshots had `interpolationConfig` (the pre-Phase-1 name);
    // normalize to `promptsConfig` on the way in.
    promptsConfig: rev.interpolationConfig ?? whole.promptsConfig,
    hiddenSectionIds: whole.hiddenSectionIds,
    activePersonaId: whole.activePersonaId,
    customPersonas: whole.customPersonas,
    uiState: whole.uiState,
  };
}

function currentStateToStoredData(
  whole: Partial<LegacyProjectData>,
): StoredProjectData {
  return {
    projectName: whole.projectName,
    markdown: whole.markdown ?? '',
    // The browser's "draft" split doesn't exist on disk; localDraft is dropped.
    testSuite: whole.testSuite ?? {},
    hiddenSectionIds: whole.hiddenSectionIds,
    activePersonaId: whole.activePersonaId,
    customPersonas: whole.customPersonas,
    promptsConfig: whole.promptsConfig ?? whole.interpolationConfig,
    uiState: whole.uiState,
  };
}

function normalizeTrigger(t: unknown): SnapshotTrigger {
  return t === 'manual' || t === 'autosave' || t === 'pre-ai-write'
    ? t
    : 'manual';
}

function normalizeScope(s: unknown): AffectedScope {
  if (s === 'all') return 'all';
  if (
    s &&
    typeof s === 'object' &&
    'sectionIds' in s &&
    Array.isArray((s as { sectionIds: unknown }).sectionIds)
  ) {
    const ids = (s as { sectionIds: unknown[] }).sectionIds.filter(
      (i): i is string => typeof i === 'string',
    );
    return { sectionIds: ids };
  }
  return 'all';
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'project'
  );
}

function uniqueFolderName(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** Cross-platform path join. The Tauri side accepts either separator on
 * Windows; we use forward slashes for consistency in tests. */
function joinPath(dir: string, name: string): string {
  const trimmed = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
  return `${trimmed}/${name}`;
}
