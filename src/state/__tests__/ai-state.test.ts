import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';

// Mock the persistence + registry side-effects so the slice imports in isolation.
// preferences is mocked wholesale; we assert the write-through setters fire.
vi.mock('../../services/preferences', () => ({
  DEFAULT_AGENT_SDK_MODEL: 'claude-opus-4-8',
  setGlobalPromptsDefault: vi.fn(() => Promise.resolve()),
  setSpells: vi.fn(() => Promise.resolve()),
  setRevisionInstructions: vi.fn(() => Promise.resolve()),
  setActiveRevisionInstructionId: vi.fn(() => Promise.resolve()),
  setGlobalModelDefault: vi.fn(() => Promise.resolve()),
  setModelCatalog: vi.fn(() => Promise.resolve()),
  setOllamaBaseUrl: vi.fn(() => Promise.resolve()),
  setAgentModeEnabled: vi.fn(() => Promise.resolve()),
  setAgentSidecarUrl: vi.fn(() => Promise.resolve()),
  setAgentSdkModel: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/ai-provider-registry', () => ({
  setOllamaBaseUrl: vi.fn(),
  setAgentSidecarUrl: vi.fn(),
  detectOllamaModels: vi.fn(() => Promise.resolve([])),
}));

import { createAIStateSlice, type AIStateSlice } from '../ai-state';
import { DEFAULT_PROMPTS_CONFIG } from '../../lib/constants';
import * as prefs from '../../services/preferences';
import type { PromptsConfig } from '../../types';

const sliceCreator = createAIStateSlice as unknown as StateCreator<AIStateSlice>;
const makeStore = () => create<AIStateSlice>()(sliceCreator);

// A stable editable prompt key to exercise the tier logic against.
const KEY = Object.keys(DEFAULT_PROMPTS_CONFIG)[0] as keyof PromptsConfig;

describe('ai-state prompts tier resolution', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
  });

  it('setPromptsConfig stores an EMPTY override when the config equals the defaults', () => {
    store.getState().setPromptsConfig({ ...DEFAULT_PROMPTS_CONFIG });
    // Sparse diff vs (defaults ◁ global) collapses an unchanged config to {}.
    expect(store.getState().projectPromptsOverride).toEqual({});
  });

  it('setPromptsConfig keeps only the changed field in the sparse override', () => {
    const edited: PromptsConfig = { ...DEFAULT_PROMPTS_CONFIG, [KEY]: 'CUSTOM TEXT' };
    store.getState().setPromptsConfig(edited);
    expect(store.getState().projectPromptsOverride).toEqual({ [KEY]: 'CUSTOM TEXT' });
    expect(store.getState().promptsConfig[KEY]).toBe('CUSTOM TEXT');
  });

  it('a global edit shows through where the project has not overridden', () => {
    store.getState().setGlobalPromptsConfig({ [KEY]: 'GLOBAL TEXT' });
    expect(store.getState().promptsConfig[KEY]).toBe('GLOBAL TEXT');
    // Write-through to preferences fired.
    expect(prefs.setGlobalPromptsDefault).toHaveBeenCalledWith({ [KEY]: 'GLOBAL TEXT' });
  });

  it('a project override wins over a global override for the same field', () => {
    store.getState().setGlobalPromptsConfig({ [KEY]: 'GLOBAL TEXT' });
    store.getState().setProjectPromptsOverride({ [KEY]: 'PROJECT TEXT' });
    expect(store.getState().promptsConfig[KEY]).toBe('PROJECT TEXT');
  });
});

describe('ai-state write-through setters', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
  });

  it('setCustomSpells persists the new library and supports the updater form', () => {
    store.getState().setCustomSpells([{ id: 'sp1' } as never]);
    expect(store.getState().customSpells).toHaveLength(1);
    store.getState().setCustomSpells((prev) => [...prev, { id: 'sp2' } as never]);
    expect(store.getState().customSpells).toHaveLength(2);
    expect(prefs.setSpells).toHaveBeenCalledTimes(2);
  });

  it('setAgentModeEnabled flips state and writes through', () => {
    expect(store.getState().agentModeEnabled).toBe(false);
    store.getState().setAgentModeEnabled(true);
    expect(store.getState().agentModeEnabled).toBe(true);
    expect(prefs.setAgentModeEnabled).toHaveBeenCalledWith(true);
  });

  it('setActiveSpellId is session-only (no preference write)', () => {
    store.getState().setActiveSpellId('lens-x');
    expect(store.getState().activeSpellId).toBe('lens-x');
  });
});
