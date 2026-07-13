import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';

// createProjectWithRemote's recovery contract: once the local project exists,
// attach/publish failures are PARTIAL SUCCESS (project stays open, guidance
// toast, return true) — never a throw that strands the user, and never a
// rollback that deletes their data. vi.hoisted dodges the mock-factory TDZ.
const h = vi.hoisted(() => ({
  pickedFolder: '/tmp/newproj' as string | null,
  attachRemote: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: () => Promise.resolve(h.pickedFolder) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('../../services/tauri-environment', () => ({ isTauri: () => true }));
vi.mock('../../services/credentials', () => ({ setSecret: vi.fn() }));
// Intercepts the thunk's dynamic import of sync-policy.
vi.mock('../../services/sync-policy', () => ({ attachRemote: h.attachRemote }));
vi.mock('../../services/repository-registry', () => ({
  repository: {
    createProjectAt: (name: string) =>
      Promise.resolve({ id: 'new1', name, lastModified: 1, wordCount: 0 }),
    getProject: () => Promise.resolve({ projectName: 'newproj', markdown: '', localDraft: '' }),
    getMeta: () => Promise.resolve([]),
    setMeta: () => Promise.resolve(),
    setProject: () => Promise.resolve(),
  },
}));

import { createProjectStateSlice, type ProjectStateSlice } from '../project-state';

const sliceCreator = createProjectStateSlice as unknown as StateCreator<ProjectStateSlice>;
const makeStore = () => create<ProjectStateSlice>()(sliceCreator);

describe('createProjectWithRemote (publish failure = partial success, not a throw)', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(async () => {
    vi.clearAllMocks();
    h.pickedFolder = '/tmp/newproj';
    store = makeStore();
  });

  it('returns false without creating anything when the picker is cancelled', async () => {
    h.pickedFolder = null;
    const ok = await store.getState().createProjectWithRemote('https://x/y.git', 't');
    expect(ok).toBe(false);
    expect(h.attachRemote).not.toHaveBeenCalled();
  });

  it('happy path: attaches through sync-policy and toasts success', async () => {
    const { toast } = await import('sonner');
    h.attachRemote.mockResolvedValue({ kind: 'pushed', commits: 1 });
    const ok = await store.getState().createProjectWithRemote('https://x/y.git', 'tok');
    expect(ok).toBe(true);
    // The policy-owned orchestration is used — not raw repo/keyring calls —
    // so the sync watchers rebind to the new remote (the dormancy fix).
    expect(h.attachRemote).toHaveBeenCalledWith('https://x/y.git', 'tok');
    expect(toast.success).toHaveBeenCalled();
    expect(store.getState().activeProjectId).toBe('new1');
  });

  it('nonFastForward: project survives, error toast points at Clone/sync indicator', async () => {
    const { toast } = await import('sonner');
    h.attachRemote.mockResolvedValue({ kind: 'nonFastForward' });
    const ok = await store.getState().createProjectWithRemote('https://x/y.git', 'tok');
    expect(ok).toBe(true);
    expect(store.getState().activeProjectId).toBe('new1');
    const msg = String((toast.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(msg).toMatch(/already has commits/i);
    expect(msg).toMatch(/clone/i);
  });

  it('attach throws (bad token): project survives, toast routes to the Sync modal', async () => {
    const { toast } = await import('sonner');
    h.attachRemote.mockRejectedValue(new Error('authentication required'));
    const ok = await store.getState().createProjectWithRemote('https://x/y.git', 'tok');
    expect(ok).toBe(true);
    expect(store.getState().activeProjectId).toBe('new1');
    const msg = String((toast.error as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(msg).toMatch(/publishing failed: authentication required/i);
    expect(msg).toMatch(/sync/i);
  });
});
