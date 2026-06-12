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

const PUSH_DEBOUNCE_MS = 5_000;
const PULL_THROTTLE_MS = 60_000;

let initialized = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPullAt = 0;
let lastRevisionsLength = 0;
let storeUnsubscribe: (() => void) | null = null;

/**
 * Bootstrap sync automation. Called from App.tsx when a project loads.
 * Safe to call multiple times — subsequent calls are no-ops until teardown.
 */
export async function initSyncPolicy(): Promise<void> {
  if (initialized) return;
  initialized = true;

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

  // Pull on focus (throttled); flush on network reconnect.
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnline);
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
  initialized = false;
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastPullAt < PULL_THROTTLE_MS) return;
  void runPull();
}

/** On reconnect, pull then push so offline work lands without a new edit. */
function handleOnline() {
  void flush();
}

/** Pull latest, then push any unpushed commits. */
async function flush() {
  await runPull();
  await runPush();
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
  // Don't interfere with an in-flight operation.
  if (ui.syncStatus === 'pulling' || ui.syncStatus === 'pushing') return;
  ui.setSyncStatus('pulling');
  lastPullAt = Date.now();
  try {
    const result = await repository.syncPull();
    switch (result.kind) {
      case 'mergeRequired':
        flagError('Remote diverged. Resolve via your git client.');
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

async function runPush() {
  const ui = useStore.getState();
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
