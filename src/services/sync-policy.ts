// Phase 4e — sync automation.
//
// Subscribes to commit events (revisions length increase), window focus, and
// network reconnect. Pushes are debounced 5s after the most recent commit;
// pulls happen on launch and on focus, throttled to once per 60s. On launch
// and on `online`, any unpushed local commits are flushed to the remote so
// offline work lands without waiting for the next edit.
//
// Error policy:
//   - Transient network failures (offline, DNS, refused) fail silent. They do
//     not latch; the ahead/behind counts keep the indicator honest and the
//     next launch/reconnect flush retries.
//   - Persistent failures (remote divergence, auth) LATCH in the sidebar dot
//     until a later sync succeeds. They do not auto-clear on a timer — a
//     divergence does not fix itself, and a 30s blip that hid it was worse
//     than a steady warning.
//
// The policy is a singleton: init when a project opens, teardown when it
// closes. Calling init twice without teardown is a no-op (idempotent).

import { useStore } from '../store';
import { repository } from './repository-registry';
import { setSecret } from './credentials';
import { isTauri } from './tauri-environment';
import { toast } from 'sonner';
import type { DiskSignature, PushOutcome } from '../types';

const PUSH_DEBOUNCE_MS = 5_000;
const PULL_THROTTLE_MS = 60_000;
// External-edit detection runs on focus and is a cheap local file read, so it
// gets its own short throttle rather than sharing the 60s pull throttle.
const EXTERNAL_CHECK_THROTTLE_MS = 3_000;

let initialized = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPullAt = 0;
let lastRevisionsLength = 0;
let storeUnsubscribe: (() => void) | null = null;
let lastExternalCheckAt = 0;
let checkingExternal = false;
// External-edit detection runs on every focus; a persistent read failure would
// spam toasts. Surface it once, then stay quiet until a check succeeds again.
let externalCheckErrorNotified = false;
// Last on-disk signature of project.md we observed, so an unchanged file skips
// the full read. Reset on project switch/close (teardown) so it never leaks
// across projects.
let lastMdSignature: DiskSignature | null = null;

/**
 * Bootstrap sync automation. Called from App.tsx when a project loads.
 * Safe to call multiple times — subsequent calls are no-ops until teardown.
 */
export async function initSyncPolicy(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // External-edit detection works for every open project, remote or not, so the
  // focus listener is registered before the remote gate below. Teardown removes
  // it unconditionally.
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const state = await repository.syncState();
  const ui = useStore.getState();
  if (!state.hasRemote) {
    ui.setSyncStatus('no-remote');
    return;
  }
  ui.setSyncStatus('idle');
  ui.setSyncError(null);
  ui.setSyncCounts(state.ahead, state.behind);

  // Initial sync: pull latest, then flush commits made offline last session.
  // Each op refreshes the ahead/behind counts in its finally.
  void flush();

  // Subscribe to commit events. `revisions.length` increases each time
  // `createSnapshot` lands a new commit. Refresh counts immediately so the
  // "unpushed" indicator lights during the debounce, before the push fires.
  lastRevisionsLength = useStore.getState().revisions.length;
  storeUnsubscribe = useStore.subscribe((s) => {
    if (s.revisions.length > lastRevisionsLength) {
      lastRevisionsLength = s.revisions.length;
      void refreshSyncCounts();
      schedulePush();
    }
  });

  // Flush on network reconnect. (Pull-on-focus is wired above via the
  // visibilitychange listener, which is registered for every project.)
  window.addEventListener('online', handleOnline);
}

/**
 * Rebind the policy to the repository's current remote state. Needed because
 * init gates its commit-watcher and reconnect listeners on hasRemote, so a
 * remote attached mid-session would otherwise never sync until relaunch.
 */
export async function restartSyncPolicy(): Promise<void> {
  teardownSyncPolicy();
  await initSyncPolicy();
}

/**
 * The one sanctioned way to attach (or re-attach) a remote to the open
 * project: store the PAT, point origin at the URL, validate with one push,
 * and rebind the policy. Callers: SyncConfigModal and createProjectWithRemote.
 *
 * The restart runs in `finally` — even when the validating push fails, the
 * remote is configured, so the policy must be live for the error to latch
 * honestly and for a later retry/pull to work without a relaunch. A diverged
 * remote (nonFastForward) flows into the normal pull path, which offers
 * in-app conflict resolution.
 */
export async function attachRemote(url: string, token: string): Promise<PushOutcome> {
  await setSecret('git', token.trim());
  await repository.configureRemote(url.trim());
  try {
    return await repository.syncPush();
  } finally {
    await restartSyncPolicy();
  }
}

/** Tear down event subscriptions. Called when the project closes. */
export function teardownSyncPolicy(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  if (storeUnsubscribe) storeUnsubscribe();
  storeUnsubscribe = null;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnline);
  useStore.getState().setSyncCounts(0, 0);
  lastExternalCheckAt = 0;
  checkingExternal = false;
  lastMdSignature = null;
  initialized = false;
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  // Cheap local check first: reconcile external edits to project.md before any
  // network pull mutates state. Runs whether or not a remote is configured.
  void checkExternalChanges();
  // The pull path applies only to remote projects.
  if (useStore.getState().syncStatus === 'no-remote') return;
  if (Date.now() - lastPullAt < PULL_THROTTLE_MS) return;
  void runPull();
}

/** On reconnect, pull then push so offline work lands without a new edit. */
function handleOnline() {
  void flush();
}

/**
 * True when an external check should be skipped — a merge/modal is in progress,
 * no project is open, a check is already running, or we checked too recently.
 * Split out so the detection routine itself stays under the complexity limit.
 */
function shouldSkipExternalCheck(): boolean {
  const ui = useStore.getState();
  if (ui.pendingMerge) return true;
  if (ui.showExternalChangeModal) return true;
  if (!ui.activeProjectId) return true;
  if (isTauri() && !ui.hasOpenProject) return true;
  if (checkingExternal) return true;
  if (Date.now() - lastExternalCheckAt < EXTERNAL_CHECK_THROTTLE_MS) return true;
  return false;
}

/**
 * Detect whether project.md changed on disk outside the app and reconcile.
 * Compares the on-disk bytes against the live editor buffer: if they match
 * (the common case — and the brief window mid-autosave where disk is written
 * before `markdown` converges) there is nothing to do. A genuine external edit
 * is auto-reloaded when the in-app buffer has no unsaved edits, or routed to a
 * prompt modal when it does. No-op in the browser and while a merge is pending.
 */
export async function checkExternalChanges(): Promise<void> {
  if (shouldSkipExternalCheck()) return;
  checkingExternal = true;
  lastExternalCheckAt = Date.now();
  try {
    // Cheap stat first: the full file comes back only when its signature
    // (mtime+size) differs from what we last saw, so an unchanged file is a
    // ~16-byte response rather than the whole document.
    const { signature, content } = await repository.readMarkdownIfChanged(lastMdSignature);
    lastMdSignature = signature;
    externalCheckErrorNotified = false; // a successful read re-arms the one-shot warning
    if (content === null) return; // unchanged since last check, or no file (browser/unborn)
    const { localContent, markdown } = useStore.getState();
    // Fast-path bail: the live buffer already equals disk. Covers the autosave
    // write window (disk updates before `markdown`), which a content-only
    // comparison would otherwise misread as an external edit.
    if (content === localContent) return;
    if (content === markdown) return; // defensive; implied false by the line above
    if (localContent === markdown) {
      // No unsaved in-app edits: load the external version silently.
      await reloadDocument();
      toast('Reloaded external changes to project.md');
    } else {
      // Unsaved in-app edits would be lost by a blind reload — let the user pick.
      useStore.getState().setShowExternalChangeModal(true);
    }
  } catch (e) {
    console.error('external-change check failed', e);
    if (!externalCheckErrorNotified) {
      externalCheckErrorNotified = true;
      toast.error("Couldn't check project.md for outside changes. If you edit it elsewhere, reload manually.");
    }
  } finally {
    checkingExternal = false;
  }
}

/** Pull latest, then push any unpushed commits. */
async function flush() {
  await runPull();
  await runPush();
}

/**
 * User-initiated retry from the sidebar indicator. Re-attempts a pull+push; a
 * latched error lifts via succeed() if it works now (e.g. the network came
 * back). No-op clearing — a still-broken remote simply re-latches.
 */
export async function retrySync(): Promise<void> {
  await flush();
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void runPush();
  }, PUSH_DEBOUNCE_MS);
}

async function runPull() {
  const ui = useStore.getState();
  // Sync is paused while a conflict awaits in-app resolution.
  if (ui.pendingMerge) return;
  // Don't interfere with an in-flight operation.
  if (ui.syncStatus === 'pulling' || ui.syncStatus === 'pushing') return;
  ui.setSyncStatus('pulling');
  lastPullAt = Date.now();
  try {
    const result = await repository.syncPull();
    switch (result.kind) {
      case 'merged':
        // Divergent histories merged cleanly and were committed on the Rust
        // side. Reload so in-memory state matches the new project.md on disk —
        // otherwise the next autosave would overwrite the merge.
        await reloadDocument();
        succeed();
        break;
      case 'mergeRequired':
        // Defensive self-heal: the resolve command requires theirCommit + baseHead.
        // If a divergent pull reports a conflict without them (e.g. an out-of-date
        // desktop binary whose wire format predates the camelCase fix), do NOT open
        // the modal — submitting it would hard-crash `sync_resolve_merge` with
        // "missing required key theirCommit". Flag an actionable error instead.
        if (!result.theirCommit || !result.baseHead) {
          flagError(
            'A merge conflict was detected, but the remote reference is incomplete. ' +
              'Update the desktop app to the latest version, then pull again.',
          );
          break;
        }
        // Latch the conflict and open the resolution modal. runPull/runPush
        // short-circuit on pendingMerge, so sync stays paused until resolved.
        ui.setPendingMerge({
          theirCommit: result.theirCommit,
          baseHead: result.baseHead,
          conflicts: result.conflicts,
        });
        ui.setSyncStatus('conflict');
        ui.setSyncError(
          `Merge conflict in ${result.conflicts.length} file${
            result.conflicts.length === 1 ? '' : 's'
          } — resolve in app.`,
        );
        ui.setShowConflictModal(true);
        break;
      case 'unrelatedHistories':
        flagError('Local and remote share no history. Resolve via your git client.');
        break;
      case 'workingTreeDirty':
        // Silent: autosave will commit soon; we retry on next focus. Keep any
        // latched error visible rather than masking it as idle.
        settle();
        break;
      case 'noRemote':
        ui.setSyncStatus('no-remote');
        break;
      default:
        succeed();
    }
  } catch (e) {
    handleErr('pull', e);
  } finally {
    void refreshSyncCounts();
  }
}

/**
 * A merge (clean auto-merge or a resolved conflict) rewrote project.md on disk.
 * Reload the project so the in-memory document, specs, and revisions match —
 * and keep the commit-watcher baseline in step so it doesn't fire a redundant
 * push for commits already on the remote.
 */
async function reloadDocument(): Promise<void> {
  const store = useStore.getState();
  const id = store.activeProjectId;
  if (!id) return;
  try {
    await store.loadProject(id);
  } catch (e) {
    console.error('reload after sync failed', e);
  }
  lastRevisionsLength = useStore.getState().revisions.length;
}

/**
 * Reload the open project from disk, discarding the in-memory buffer. Shared by
 * the external-change auto-reload path and the "Reload from disk" modal action;
 * delegates to reloadDocument so the commit-watcher baseline stays in step.
 */
export async function reloadFromDisk(): Promise<void> {
  await reloadDocument();
}

/**
 * Called by the conflict modal after `syncResolveMerge` returns `resolved`.
 * Clears the latched conflict, reloads the merged document, then pushes the
 * merge commit. Resolution is user-driven from the modal, so this is exported
 * rather than living in the automation loop.
 */
export async function onMergeResolved(): Promise<void> {
  const store = useStore.getState();
  store.setShowConflictModal(false);
  store.setPendingMerge(null);
  await reloadDocument();
  succeed();
  void refreshSyncCounts();
  await runPush();
}

/**
 * Called by the conflict modal when resolution comes back `stale` (HEAD moved
 * or the tree dirtied under the modal). Clears the stale conflict and re-pulls;
 * a fresh `mergeRequired` reopens the modal with current data.
 */
export async function retryPull(): Promise<void> {
  useStore.getState().setPendingMerge(null);
  await runPull();
}

async function runPush() {
  const ui = useStore.getState();
  // Sync is paused while a conflict awaits in-app resolution.
  if (ui.pendingMerge) return;
  if (ui.syncStatus === 'pulling' || ui.syncStatus === 'pushing') {
    // Reschedule rather than collide.
    schedulePush();
    return;
  }
  ui.setSyncStatus('pushing');
  try {
    const result = await repository.syncPush();
    switch (result.kind) {
      case 'nonFastForward':
        flagError('Local diverged from remote. Pull or resolve manually.');
        break;
      case 'noRemote':
        ui.setSyncStatus('no-remote');
        break;
      default:
        succeed();
    }
  } catch (e) {
    handleErr('push', e);
  } finally {
    void refreshSyncCounts();
  }
}

/** Refresh ahead/behind from the purely-local git state. Best-effort. */
async function refreshSyncCounts() {
  try {
    const s = await repository.syncState();
    useStore.getState().setSyncCounts(s.ahead, s.behind);
  } catch {
    // Counts are advisory; a failed query just leaves the last values in place.
  }
}

/** A real success: lift any latched error and return to idle. */
function succeed() {
  const ui = useStore.getState();
  ui.setSyncStatus('idle');
  ui.setSyncError(null);
}

/** A soft no-op: keep a latched error visible, otherwise idle. */
function settle() {
  const ui = useStore.getState();
  ui.setSyncStatus(ui.syncError ? 'error' : 'idle');
}

function handleErr(op: 'pull' | 'push', e: unknown) {
  const msg = String((e as { message?: string })?.message ?? e ?? 'unknown');
  const lower = msg.toLowerCase();
  const transient =
    lower.includes('timeout') ||
    lower.includes('could not resolve') ||
    lower.includes("couldn't resolve") ||
    lower.includes('failed to resolve') ||
    lower.includes('network is unreachable') ||
    lower.includes('connection refused') ||
    lower.includes('failed to connect') ||
    lower.includes("couldn't connect") ||
    lower.includes('could not connect') ||
    lower.includes('temporary failure') ||
    lower.includes('no such host') ||
    lower.includes('offline');
  if (transient) {
    // Offline / flaky network: not worth latching. The ahead/behind counts
    // already show unpushed work; we flush again on reconnect or launch.
    settle();
    return;
  }
  flagError(`${op} failed: ${msg}`);
}

/**
 * Latch a persistent error in the indicator. Unlike transient failures, this
 * does NOT auto-clear on a timer — divergence and auth failures do not fix
 * themselves. The latch lifts when a later pull/push succeeds (see succeed()).
 */
function flagError(message: string) {
  const ui = useStore.getState();
  ui.setSyncStatus('error');
  ui.setSyncError(message);
}
