// Phase 4e — sync automation.
//
// Subscribes to commit events (revisions length increase) and window focus
// events. Pushes are debounced 5s after the most recent commit; pulls happen
// on launch and on focus, throttled to once per 60s. Transient network
// errors fail silent; persistent errors surface in the sidebar dot for 30s
// then auto-clear so the indicator doesn't sit pinned red.
//
// The policy is a singleton: init when a project opens, teardown when it
// closes. Calling init twice without teardown is a no-op (idempotent).

import { useStore } from '../store';
import { repository } from './repository-registry';

const PUSH_DEBOUNCE_MS = 5_000;
const PULL_THROTTLE_MS = 60_000;
const ERROR_CLEAR_MS = 30_000;

let initialized = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let errorClearTimer: ReturnType<typeof setTimeout> | null = null;
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

  // Initial pull on launch.
  void runPull();

  // Subscribe to commit events. `revisions.length` increases each time
  // `createSnapshot` lands a new commit.
  lastRevisionsLength = useStore.getState().revisions.length;
  storeUnsubscribe = useStore.subscribe((s) => {
    if (s.revisions.length > lastRevisionsLength) {
      lastRevisionsLength = s.revisions.length;
      schedulePush();
    }
  });

  // Pull on window/tab focus, throttled to PULL_THROTTLE_MS.
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/** Tear down event subscriptions. Called when the project closes. */
export function teardownSyncPolicy(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  if (errorClearTimer) clearTimeout(errorClearTimer);
  errorClearTimer = null;
  if (storeUnsubscribe) storeUnsubscribe();
  storeUnsubscribe = null;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  initialized = false;
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastPullAt < PULL_THROTTLE_MS) return;
  void runPull();
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
  ui.setSyncError(null);
  lastPullAt = Date.now();
  try {
    const result = await repository.syncPull();
    switch (result.kind) {
      case 'mergeRequired':
        flagError('Remote diverged. Resolve via your git client.');
        return;
      case 'workingTreeDirty':
        // Silent: autosave will commit soon; we'll retry on next focus.
        ui.setSyncStatus('idle');
        return;
      case 'noRemote':
        ui.setSyncStatus('no-remote');
        return;
      default:
        ui.setSyncStatus('idle');
    }
  } catch (e) {
    handleErr('pull', e);
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
  ui.setSyncError(null);
  try {
    const result = await repository.syncPush();
    switch (result.kind) {
      case 'nonFastForward':
        flagError('Local diverged from remote. Pull or resolve manually.');
        return;
      case 'noRemote':
        ui.setSyncStatus('no-remote');
        return;
      default:
        ui.setSyncStatus('idle');
    }
  } catch (e) {
    handleErr('push', e);
  }
}

function handleErr(op: 'pull' | 'push', e: unknown) {
  const ui = useStore.getState();
  const msg = String((e as { message?: string })?.message ?? e ?? 'unknown');
  const lower = msg.toLowerCase();
  const transient =
    lower.includes('timeout') ||
    lower.includes('could not resolve') ||
    lower.includes('network is unreachable') ||
    lower.includes('connection refused') ||
    lower.includes('temporary failure');
  if (transient) {
    ui.setSyncStatus('idle');
    return;
  }
  flagError(`${op} failed: ${msg}`);
}

function flagError(message: string) {
  const ui = useStore.getState();
  ui.setSyncStatus('error');
  ui.setSyncError(message);
  if (errorClearTimer) clearTimeout(errorClearTimer);
  errorClearTimer = setTimeout(() => {
    errorClearTimer = null;
    const cur = useStore.getState();
    if (cur.syncStatus === 'error') {
      cur.setSyncStatus('idle');
      cur.setSyncError(null);
    }
  }, ERROR_CLEAR_MS);
}
