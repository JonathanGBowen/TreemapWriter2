import type { StateCreator } from 'zustand';
import { DEFAULT_PROMPTS_CONFIG } from '../lib/constants';
import type { Persona, PromptsConfig } from '../types';
import type { AppState } from '.';

/**
 * AI configuration: which persona is active, custom personas the user has
 * defined, the prompts (config) used for AI flows, and any cached advice.
 *
 * `promptsConfig` is persisted with the project; the rest is per-project
 * domain data too. This slice does NOT own the in-flight request state
 * (that lives in `ui-state` as `isProcessing` / `isInterpolating`).
 */
export interface AIStateSlice {
  activePersonaId: string;
  customPersonas: Persona[];
  promptsConfig: PromptsConfig;
  cachedCoachAdvice: { inputHash: string; advice: string } | null;

  setActivePersonaId: (id: string) => void;
  setCustomPersonas: (personas: Persona[] | ((prev: Persona[]) => Persona[])) => void;
  setPromptsConfig: (config: PromptsConfig) => void;
  setCachedCoachAdvice: (advice: { inputHash: string; advice: string } | null) => void;
}

export const createAIStateSlice: StateCreator<AppState, [], [], AIStateSlice> = (set) => ({
  activePersonaId: 'default',
  customPersonas: [],
  promptsConfig: DEFAULT_PROMPTS_CONFIG,
  cachedCoachAdvice: null,

  setActivePersonaId: (id) => set({ activePersonaId: id }),
  setCustomPersonas: (personas) =>
    set((state) => ({
      customPersonas: typeof personas === 'function' ? personas(state.customPersonas) : personas,
    })),
  setPromptsConfig: (config) => set({ promptsConfig: config }),
  setCachedCoachAdvice: (advice) => set({ cachedCoachAdvice: advice }),
});
