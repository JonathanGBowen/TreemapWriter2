import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';

// Shared, hoisted holder for whatever the (mocked) repository was last asked to
// persist. vi.hoisted runs before the vi.mock factories, dodging the TDZ trap.
const h = vi.hoisted(() => ({ lastSaved: null as Record<string, unknown> | null }));

// Keep the slice importable in isolation: stub the Tauri/UI side-effect imports
// and the repository registry (which would otherwise pull in the real repos).
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('../../services/tauri-environment', () => ({ isTauri: () => true }));
vi.mock('../../services/repository-registry', () => ({
  repository: {
    setProject: (_id: string, data: Record<string, unknown>) => {
      h.lastSaved = data;
      return Promise.resolve();
    },
    setMeta: () => Promise.resolve(),
    // Simulate the DESKTOP read: Rust drops local_draft (document.rs returns
    // local_draft: None), so a reload must re-hydrate localContent from the
    // persisted `markdown`. That is exactly the path that used to revert work.
    getProject: () =>
      Promise.resolve(h.lastSaved ? { ...h.lastSaved, localDraft: undefined } : null),
  },
}));

import { createProjectStateSlice, type ProjectStateSlice } from '../project-state';

const sliceCreator = createProjectStateSlice as unknown as StateCreator<ProjectStateSlice>;
const makeStore = () => create<ProjectStateSlice>()(sliceCreator);

// The slice reads cross-slice fields (markdown, localContent) that aren't part
// of ProjectStateSlice's type; expose them for assertions.
type AugState = ProjectStateSlice & { markdown: string; localContent: string };

// The minimal cross-slice state saveCurrentState / loadProject read via get().
const seed = (over: Record<string, unknown>) =>
  ({
    activeProjectId: 'p1',
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

const OLD = '# Old\n\nFrozen committed copy.';
const NEW = '# Old\n\nFrozen committed copy.\n\nHours of new writing the user just typed.';

describe('desktop draft persistence (regression: autosave must persist the live draft)', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    h.lastSaved = null;
    store = makeStore();
  });

  it('persists the live editor buffer, not the stale committed markdown', async () => {
    // Committed copy is stale; the user has typed NEW into the live buffer.
    store.setState(seed({ markdown: OLD, localContent: NEW }));

    await store.getState().saveCurrentState();

    // The bug was that `markdown` (== OLD) got written; the fix writes the live
    // buffer. Both the on-disk markdown and the draft must be the new text.
    expect(h.lastSaved?.markdown).toBe(NEW);
    expect(h.lastSaved?.localDraft).toBe(NEW);
    // In-memory committed copy converges so AI/word-count consumers stay current.
    expect((store.getState() as AugState).markdown).toBe(NEW);
  });

  it('survives a reload — loadProject restores the live text instead of reverting', async () => {
    store.setState(seed({ markdown: OLD, localContent: NEW }));
    await store.getState().saveCurrentState();

    // Simulate the wake-from-sleep WebView2 reload: re-read from the repository
    // (which, on desktop, returns no localDraft).
    await store.getState().loadProject('p1');

    expect((store.getState() as AugState).localContent).toBe(NEW); // pre-fix this was OLD
    expect((store.getState() as AugState).markdown).toBe(NEW);
  });

  it('guard: refuses to blank a non-empty saved doc with a transient empty buffer', async () => {
    const sentinel = { markdown: 'sentinel' };
    h.lastSaved = sentinel;
    store.setState(seed({ markdown: OLD, localContent: '   ' }));

    await store.getState().saveCurrentState();

    // No write happened — the empty buffer did not overwrite the saved doc.
    expect(h.lastSaved).toBe(sentinel);
  });

  it('round-trips the Doctor checklist (save payload → load path)', async () => {
    const checklist = {
      scopeKey: 'root',
      thesis: 'T',
      criticalIssue: 'The most critical issue is X.',
      roadmapTitle: 'Front-load',
      roadmapOutline: ['step'],
      tasks: [{ id: 'task-0', text: 'Do A', done: true, paragraphNumbers: [2], anchors: ['a'] }],
      createdAt: 1,
      sourceHash: 'h',
    };
    store.setState(seed({ markdown: OLD, localContent: OLD, doctorChecklist: checklist }));

    await store.getState().saveCurrentState();
    expect(h.lastSaved?.doctorChecklist).toEqual(checklist);

    // Blank it in memory, reload — the persisted copy (done flag included) returns.
    store.setState({ doctorChecklist: null } as unknown as Partial<ProjectStateSlice>);
    await store.getState().loadProject('p1');
    expect(
      (store.getState() as unknown as { doctorChecklist: typeof checklist }).doctorChecklist,
    ).toEqual(checklist);
  });
});
