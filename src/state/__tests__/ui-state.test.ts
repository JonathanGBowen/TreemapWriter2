import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createUIStateSlice, type UIStateSlice } from '../ui-state';

const sliceCreator = createUIStateSlice as unknown as StateCreator<UIStateSlice>;
const makeStore = () => create<UIStateSlice>()(sliceCreator);

describe('ui-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('defaults match the ADHD-friendly intent (focus + ambient cue on, no remote)', () => {
    const s = store.getState();
    expect(s.focusMode).toBe(true);
    expect(s.ambientCueEnabled).toBe(true);
    expect(s.syncStatus).toBe('no-remote');
    expect(s.pendingMerge).toBeNull();
    expect(s.activeTab).toBe('editor');
  });

  it('setSyncCounts updates both ahead and behind together', () => {
    store.getState().setSyncCounts(3, 2);
    expect(store.getState().syncAhead).toBe(3);
    expect(store.getState().syncBehind).toBe(2);
  });

  it('setSyncStatus / setSyncError drive the indicator independently', () => {
    store.getState().setSyncStatus('error');
    store.getState().setSyncError('remote diverged');
    expect(store.getState().syncStatus).toBe('error');
    expect(store.getState().syncError).toBe('remote diverged');
  });

  it('panel-width setters persist their value', () => {
    store.getState().setSidebarWidth(400);
    store.getState().setTestsPanelWidth(300);
    expect(store.getState().sidebarWidth).toBe(400);
    expect(store.getState().testsPanelWidth).toBe(300);
  });

  it('modal flags toggle in isolation', () => {
    store.getState().setShowProjectModal(true);
    expect(store.getState().showProjectModal).toBe(true);
    expect(store.getState().showRunModal).toBe(false);
    store.getState().setShowProjectModal(false);
    expect(store.getState().showProjectModal).toBe(false);
  });

  it('the sprint surface is one flag plus a mode, defaulting to draft', () => {
    const s = store.getState();
    expect(s.showSprintModal).toBe(false);
    expect(s.sprintMode).toBe('content');
    s.setSprintMode('goal');
    expect(store.getState().sprintMode).toBe('goal');
    s.setShowSprintModal(true);
    expect(store.getState().showSprintModal).toBe(true);
  });

  it('the command palette has its own flag', () => {
    expect(store.getState().showCommandPalette).toBe(false);
    store.getState().setShowCommandPalette(true);
    expect(store.getState().showCommandPalette).toBe(true);
  });
});
