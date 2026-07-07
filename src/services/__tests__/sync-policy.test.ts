// @vitest-environment jsdom
//
// sync-policy is a side-effecting singleton (timers + window/document listeners
// + the zustand store + the repository). We mock all four seams and drive it
// with fake timers. jsdom supplies the document/window the init path listens on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  // A mutable fake of the UI store slice the policy reads and writes.
  const ui: Record<string, unknown> = {};
  const reset = () => {
    ui.syncStatus = 'idle';
    ui.syncError = null;
    ui.syncAhead = 0;
    ui.syncBehind = 0;
    ui.pendingMerge = null;
    ui.showExternalChangeModal = false;
    ui.activeProjectId = 'p1';
    ui.hasOpenProject = true;
    ui.revisions = [] as unknown[];
    ui.localContent = '';
    ui.markdown = '';
    ui.loadProject = vi.fn(() => Promise.resolve());
    ui.setSyncStatus = vi.fn((v: unknown) => { ui.syncStatus = v; });
    ui.setSyncError = vi.fn((v: unknown) => { ui.syncError = v; });
    ui.setSyncCounts = vi.fn((a: number, b: number) => { ui.syncAhead = a; ui.syncBehind = b; });
    ui.setPendingMerge = vi.fn((v: unknown) => { ui.pendingMerge = v; });
    ui.setShowConflictModal = vi.fn((v: unknown) => { ui.showConflictModal = v; });
    ui.setShowExternalChangeModal = vi.fn((v: unknown) => { ui.showExternalChangeModal = v; });
  };
  const listeners = new Set<(s: unknown) => void>();
  const repo = {
    syncState: vi.fn(),
    syncPull: vi.fn(),
    syncPush: vi.fn(),
    readMarkdownIfChanged: vi.fn(),
  };
  const toast = Object.assign(vi.fn(), { error: vi.fn() });
  return { ui, reset, listeners, repo, toast };
});

vi.mock('../../store', () => ({
  useStore: {
    getState: () => h.ui,
    subscribe: (fn: (s: unknown) => void) => {
      h.listeners.add(fn);
      return () => h.listeners.delete(fn);
    },
  },
}));
vi.mock('../repository-registry', () => ({ repository: h.repo }));
vi.mock('../tauri-environment', () => ({ isTauri: () => false }));
vi.mock('sonner', () => ({ toast: h.toast }));

import {
  initSyncPolicy,
  teardownSyncPolicy,
} from '../sync-policy';

// Flush all pending timers AND the promise chains they unblock.
const settle = async () => { await vi.runAllTimersAsync(); };
// Simulate a new commit landing (createSnapshot bumps revisions.length).
const commit = () => {
  (h.ui.revisions as unknown[]) = [...(h.ui.revisions as unknown[]), {}];
  h.listeners.forEach((fn) => fn(h.ui));
};

describe('sync-policy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.reset();
    h.listeners.clear();
    h.repo.syncState.mockResolvedValue({ hasRemote: true, ahead: 0, behind: 0 });
    h.repo.syncPull.mockResolvedValue({ kind: 'noop' });
    h.repo.syncPush.mockResolvedValue({ kind: 'ok' });
    h.repo.readMarkdownIfChanged.mockResolvedValue({ signature: null, content: null });
  });
  afterEach(() => {
    teardownSyncPolicy();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('no-remote: sets the status and never pulls', async () => {
    h.repo.syncState.mockResolvedValue({ hasRemote: false, ahead: 0, behind: 0 });
    await initSyncPolicy();
    await settle();
    expect(h.ui.syncStatus).toBe('no-remote');
    expect(h.repo.syncPull).not.toHaveBeenCalled();
  });

  it('remote: seeds counts and flushes (pull then push) on launch', async () => {
    h.repo.syncState.mockResolvedValue({ hasRemote: true, ahead: 2, behind: 1 });
    await initSyncPolicy();
    await settle();
    expect(h.ui.setSyncCounts).toHaveBeenCalledWith(2, 1);
    expect(h.repo.syncPull).toHaveBeenCalled();
    expect(h.repo.syncPush).toHaveBeenCalled();
    expect(h.ui.syncStatus).toBe('idle');
  });

  it('debounce: rapid commits coalesce into a single push after 5s', async () => {
    await initSyncPolicy();
    await settle(); // let the launch flush settle
    h.repo.syncPush.mockClear();

    commit();
    commit();
    commit();
    // Nothing should have pushed yet (still inside the debounce window).
    expect(h.repo.syncPush).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.repo.syncPush).toHaveBeenCalledTimes(1);
  });

  it('transient network error fails silent — no latched error', async () => {
    h.repo.syncPull.mockRejectedValue(new Error('Connection refused'));
    await initSyncPolicy();
    await settle();
    // settle() leaves status idle and, crucially, no error message latched.
    expect(h.ui.syncStatus).toBe('idle');
    expect(h.ui.syncError).toBeNull();
  });

  it('persistent push failure (non-fast-forward) latches an error', async () => {
    h.repo.syncPush.mockResolvedValue({ kind: 'nonFastForward' });
    await initSyncPolicy();
    await settle();
    expect(h.ui.syncStatus).toBe('error');
    expect(String(h.ui.syncError)).toMatch(/diverged/i);
  });

  it('unrelated histories on pull latches an error', async () => {
    h.repo.syncPull.mockResolvedValue({ kind: 'unrelatedHistories' });
    // Unrelated histories also block the follow-up push, so the latch stays up
    // through the full flush (pull then push) rather than being cleared.
    h.repo.syncPush.mockResolvedValue({ kind: 'nonFastForward' });
    await initSyncPolicy();
    await settle();
    expect(h.ui.syncStatus).toBe('error');
    // The unrelated-history diagnosis was surfaced (pull's flagError fired).
    const errorCalls = (h.ui.setSyncError as ReturnType<typeof vi.fn>).mock.calls;
    expect(errorCalls.flat().some((m) => /history/i.test(String(m)))).toBe(true);
  });

  it('mergeRequired latches the conflict and opens the resolution modal', async () => {
    h.repo.syncPull.mockResolvedValue({
      kind: 'mergeRequired',
      theirCommit: 'abc',
      baseHead: 'def',
      conflicts: [{ path: 'project.md' }],
    });
    await initSyncPolicy();
    await settle();
    expect(h.ui.setPendingMerge).toHaveBeenCalledWith(
      expect.objectContaining({ theirCommit: 'abc', baseHead: 'def' }),
    );
    expect(h.ui.syncStatus).toBe('conflict');
    expect(h.ui.setShowConflictModal).toHaveBeenCalledWith(true);
  });

  it('mergeRequired missing theirCommit self-heals: no modal, an actionable error', async () => {
    // Defends against a stale/mismatched binary whose wire format lacks theirCommit.
    // Opening the modal would let the user submit an undefined ref and hard-crash
    // sync_resolve_merge, so the policy flags an actionable error instead.
    h.repo.syncPull.mockResolvedValue({
      kind: 'mergeRequired',
      theirCommit: undefined,
      baseHead: undefined,
      conflicts: [{ path: 'project.md' }],
    });
    h.repo.syncPush.mockResolvedValue({ kind: 'nonFastForward' });
    await initSyncPolicy();
    await settle();
    expect(h.ui.setPendingMerge).not.toHaveBeenCalled();
    expect(h.ui.setShowConflictModal).not.toHaveBeenCalledWith(true);
    expect(h.ui.syncStatus).toBe('error');
    const errorCalls = (h.ui.setSyncError as ReturnType<typeof vi.fn>).mock.calls;
    expect(errorCalls.flat().some((m) => /update the desktop app/i.test(String(m)))).toBe(true);
  });

  it('init is idempotent — a second call before teardown is a no-op', async () => {
    await initSyncPolicy();
    await settle();
    h.repo.syncState.mockClear();
    await initSyncPolicy(); // already initialized
    expect(h.repo.syncState).not.toHaveBeenCalled();
  });

  it('teardown zeroes the ahead/behind counts so nothing leaks across projects', async () => {
    await initSyncPolicy();
    await settle();
    (h.ui.setSyncCounts as ReturnType<typeof vi.fn>).mockClear();
    teardownSyncPolicy();
    expect(h.ui.setSyncCounts).toHaveBeenCalledWith(0, 0);
  });
});
