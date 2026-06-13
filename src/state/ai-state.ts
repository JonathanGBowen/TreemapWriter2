import type { StateCreator } from 'zustand';
import { DEFAULT_PROMPTS_CONFIG } from '../lib/constants';
import type { Persona, PromptsConfig } from '../types';
import type { AppState } from '.';
import type { ModelConfig } from '../services/ai/model-types';
import type { CatalogModel } from '../services/ai/model-catalog';
import { DEFAULT_CATALOG, ollamaCatalogModel } from '../services/ai/model-catalog';
import { DEFAULT_OLLAMA_BASE_URL } from '../services/ai/clients';
import * as prefs from '../services/preferences';
import { setOllamaBaseUrl as applyOllamaBaseUrl, detectOllamaModels } from '../services/ai-provider-registry';

/**
 * AI configuration: which persona is active, custom personas, the prompts used
 * for AI flows, and the per-call model configuration.
 *
 * Per-project (persisted in the project file): `promptsConfig`, `modelConfig`.
 * Global (persisted in app preferences, shared across projects, NEVER in the
 * git-tracked project file): `globalModelDefault`, `modelCatalog`,
 * `ollamaBaseUrl`. API keys live in the OS keyring, not here.
 */
export interface AIStateSlice {
  activePersonaId: string;
  customPersonas: Persona[];
  promptsConfig: PromptsConfig;
  cachedCoachAdvice: { inputHash: string; advice: string } | null;

  /** Per-project per-kind model overrides. Sparse; resolves against the global default. */
  modelConfig: ModelConfig;
  /** Global default model config that seeds new projects (one "default model" knob). */
  globalModelDefault: ModelConfig;
  /** Editable model catalog (Gemini + Anthropic seed + detected Ollama models). */
  modelCatalog: CatalogModel[];
  /** Per-machine Ollama endpoint. */
  ollamaBaseUrl: string;

  setActivePersonaId: (id: string) => void;
  setCustomPersonas: (personas: Persona[] | ((prev: Persona[]) => Persona[])) => void;
  setPromptsConfig: (config: PromptsConfig) => void;
  setCachedCoachAdvice: (advice: { inputHash: string; advice: string } | null) => void;

  setModelConfig: (config: ModelConfig) => void;
  setGlobalModelDefault: (config: ModelConfig) => void;
  setModelCatalog: (catalog: CatalogModel[]) => void;
  setOllamaBaseUrl: (url: string) => void;
  /** Load global AI prefs from storage and refresh the Ollama catalog. Call once at boot. */
  hydrateAIPreferences: () => Promise<void>;
  /** Re-query the local Ollama server and merge its models into the catalog. */
  refreshOllamaCatalog: () => Promise<void>;
}

export const createAIStateSlice: StateCreator<AppState, [], [], AIStateSlice> = (set, get) => ({
  activePersonaId: 'default',
  customPersonas: [],
  promptsConfig: DEFAULT_PROMPTS_CONFIG,
  cachedCoachAdvice: null,

  modelConfig: {},
  globalModelDefault: {},
  modelCatalog: DEFAULT_CATALOG,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,

  setActivePersonaId: (id) => set({ activePersonaId: id }),
  setCustomPersonas: (personas) =>
    set((state) => ({
      customPersonas: typeof personas === 'function' ? personas(state.customPersonas) : personas,
    })),
  setPromptsConfig: (config) => set({ promptsConfig: config }),
  setCachedCoachAdvice: (advice) => set({ cachedCoachAdvice: advice }),

  setModelConfig: (config) => set({ modelConfig: config }),

  setGlobalModelDefault: (config) => {
    set({ globalModelDefault: config });
    void prefs.setGlobalModelDefault(config);
  },

  setModelCatalog: (catalog) => {
    set({ modelCatalog: catalog });
    void prefs.setModelCatalog(catalog);
  },

  setOllamaBaseUrl: (url) => {
    set({ ollamaBaseUrl: url });
    applyOllamaBaseUrl(url);
    void prefs.setOllamaBaseUrl(url);
  },

  hydrateAIPreferences: async () => {
    const [globalModelDefault, modelCatalog, ollamaBaseUrl] = await Promise.all([
      prefs.getGlobalModelDefault(),
      prefs.getModelCatalog(),
      prefs.getOllamaBaseUrl(),
    ]);
    set({ globalModelDefault, modelCatalog, ollamaBaseUrl });
    applyOllamaBaseUrl(ollamaBaseUrl);
    // Non-blocking: surface locally-installed Ollama models if the server is up.
    void get().refreshOllamaCatalog();
  },

  refreshOllamaCatalog: async () => {
    try {
      const names = await detectOllamaModels(get().ollamaBaseUrl);
      const nonOllama = get().modelCatalog.filter((m) => m.provider !== 'ollama');
      const merged = [...nonOllama, ...names.map(ollamaCatalogModel)];
      get().setModelCatalog(merged);
    } catch {
      // Ollama not running / unreachable — leave the catalog as-is.
    }
  },
});
