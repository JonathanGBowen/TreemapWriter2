import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';

// Per-id "disk" plus an ordered call log, so we can assert that a switch FLUSHES
// the current project before it LOADS the next. vi.hoisted runs before the mock
// factories, dodging the TDZ trap.
const h = vi.hoisted(() => ({
  calls: [] as string[],
  saved: {} as Record<string, Record<string, unknown>>,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('../../services/tauri-environment', () => ({ isTauri: () => true }));
vi.mock('../../services/repository-registry', () => ({
  repository: {
    setProject: (id: string, data: Record<string, unknown>) => {
      h.calls.push(`set:${id}`);
      h.saved[id] = data;
      return Promise.resolve();
    },
    getProject: (id: string) => {
      h.calls.push(`get:${id}`);
      return Promise.resolve(h.saved[id] ?? null);
    },
    deleteProject: (id: string) => {
      h.calls.push(`del:${id}`);
      return Promise.resolve();
    },
    setMeta: () => Promise.resolve(),
    getMeta: () => Promise.resolve([]),
  },
}));

import { createProjectStateSlice, type ProjectStateSlice } from '../project-state';

const sliceCreator = createProjectStateSlice as unknown as StateCreator<ProjectStateSlice>;
const makeStore = () => create<ProjectStateSlice>()(sliceCreator);

// The slice reads cross-slice fields that aren't part of ProjectStateSlice's
// type; the seed supplies the minimal set saveCurrentState / loadProject touch.
const seed = (over: Record<string, unknown>) =>
  ({
    activeProjectId: 'pA',
    hasOpenProject: true,
    pendingMerge: false,
    projectName: 'Test',
    markdown: '',
    localContent: '',
    testSuite: {},
    hiddenSectionIds: [],
    activePersonaId: 'default',
    customPersonas: [],
    promptsConfig: undefined,
    modelConfig: undefined,
    cachedCoachAdvice: null,
    revisions: [],
    projectList: [],
    sidebarWidth: 280,
    testsPanelWidth: 320,
    focusMode: false,
    selectedId: null,
    activeLineIndex: null,
    ...over,
  }) as unknown as Partial<ProjectStateSlice>;

describe('switchProject (data-safety: flush current before loading next)', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    h.calls = [];
    h.saved = {};
    store = makeStore();
  });

  it('persists the current project before loading the next', async () => {
    h.saved['pB'] = { projectName: 'B', markdown: '# B', localDraft: '# B' };
    store.setState(seed({ activeProjectId: 'pA', markdown: '# A old', localContent: '# A new edits' }));

    const ok = await store.getState().switchProject('pB');

    expect(ok).toBe(true);
    // The current project's LIVE buffer was flushed (not the stale markdown)...
    expect(h.saved['pA']?.markdown).toBe('# A new edits');
    // ...and that flush happened BEFORE the next project was read.
    expect(h.calls.indexOf('set:pA')).toBeGreaterThanOrEqual(0);
    expect(h.calls.indexOf('set:pA')).toBeLessThan(h.calls.indexOf('get:pB'));
    expect(store.getState().activeProjectId).toBe('pB');
  });

  it('does not flush when switching to the already-active project', async () => {
    h.saved['pA'] = { projectName: 'A', markdown: '# A', localDraft: '# A' };
    store.setState(seed({ activeProjectId: 'pA', markdown: '# A', localContent: '# A edits' }));

    await store.getState().switchProject('pA');

    expect(h.calls).not.toContain('set:pA');
  });
});

describe('deleteProject (auto-switch is surfaced, never silent)', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    h.calls = [];
    h.saved = {};
    store = makeStore();
  });

  it('deleting the active project loads the next and toasts the switch', async () => {
    const { toast } = await import('sonner');
    h.saved['pB'] = { projectName: 'B', markdown: '# B', localDraft: '# B' };
    store.setState(
      seed({
        activeProjectId: 'pA',
        projectList: [
          { id: 'pA', name: 'A', lastModified: 1, wordCount: 0 },
          { id: 'pB', name: 'B', lastModified: 2, wordCount: 1 },
        ],
      }),
    );

    await store.getState().deleteProject('pA');

    expect(store.getState().activeProjectId).toBe('pB');
    expect(toast.success).toHaveBeenCalled();
  });

  it('deleting the last project falls back to the demo with a toast', async () => {
    const { toast } = await import('sonner');
    store.setState(
      seed({
        activeProjectId: 'pA',
        projectList: [{ id: 'pA', name: 'A', lastModified: 1, wordCount: 0 }],
      }),
    );

    await store.getState().deleteProject('pA');

    expect(toast.message).toHaveBeenCalled();
    // The demo became the active project rather than leaving a broken no-project state.
    expect(store.getState().activeProjectId).toBeTruthy();
  });
});
