import type { StateCreator } from 'zustand';
import { DEFAULT_PROMPTS_CONFIG, resolvePromptsConfig, diffPromptsConfig } from '../lib/constants';
import type { AnalysisSpell, Persona, PromptsConfig, ReadingMode, RevisionInstruction } from '../types';
import { DEFAULT_INSTRUCTION_ID } from '../lib/defaultInstructions';
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
 * Per-project (persisted in the project file): `projectPromptsOverride`,
 * `modelConfig`. Global (persisted in app preferences, shared across projects,
 * NEVER in the git-tracked project file): `globalPromptsConfig`,
 * `globalModelDefault`, `modelCatalog`, `ollamaBaseUrl`. API keys live in the OS
 * keyring, not here.
 *
 * `promptsConfig` is the EFFECTIVE config AI flows read — resolved from three
 * tiers (built-in defaults ◁ global ◁ per-project), recomputed whenever any tier
 * changes. The two override layers are stored sparse so a global edit shows
 * through for any field a project hasn't overridden.
 */
export interface AIStateSlice {
  activePersonaId: string;
  customPersonas: Persona[];
  /** Effective (resolved) prompts the AI flows consume. Never persisted directly. */
  promptsConfig: PromptsConfig;
  /** Per-project sparse override (persisted in the project file). */
  projectPromptsOverride: Partial<PromptsConfig>;
  /** Global user sparse override (persisted in app preferences). */
  globalPromptsConfig: Partial<PromptsConfig>;
  cachedCoachAdvice: { inputHash: string; advice: string } | null;

  /**
   * User-created analytical lenses ("spells"). Global library (persisted in app
   * preferences, shared across projects), like the model catalog. The built-in
   * defaults live in code (`lib/defaultSpells.ts`) and are NOT stored here.
   */
  customSpells: AnalysisSpell[];
  /** Which lens the next Analysis run uses. Session-only (never persisted); null = plain reconstruction. */
  activeSpellId: string | null;

  /**
   * User-created revision Instructions (the grounding stance for a sourceless
   * revision pass). Global library (persisted in app preferences), like spells;
   * the built-in defaults live in code (`lib/defaultInstructions.ts`).
   */
  revisionInstructions: RevisionInstruction[];
  /** Which instruction a sourceless pass uses. Persisted globally; defaults to the built-in. */
  activeRevisionInstructionId: string;
  /** Reading stance for Analysis (incl. refactor): 'draft' (default) vs 'final'. Session-only. */
  analysisMode: ReadingMode;
  /** Reading stance for the Diagnostic: 'draft' (default) vs 'final'. Session-only. */
  diagnosticMode: ReadingMode;

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
  /** Set the effective config (e.g. from the editor UI); derives + stores the per-project override. */
  setPromptsConfig: (config: PromptsConfig) => void;
  /** Set the per-project sparse override directly (e.g. on project load / snapshot restore). */
  setProjectPromptsOverride: (override: Partial<PromptsConfig>) => void;
  /** Set the global sparse override; writes through to preferences. */
  setGlobalPromptsConfig: (config: Partial<PromptsConfig>) => void;
  setCachedCoachAdvice: (advice: { inputHash: string; advice: string } | null) => void;

  /** Replace (or update) the global spell library; writes through to preferences. */
  setCustomSpells: (spells: AnalysisSpell[] | ((prev: AnalysisSpell[]) => AnalysisSpell[])) => void;
  setActiveSpellId: (id: string | null) => void;
  /** Replace (or update) the global instruction library; writes through to preferences. */
  setRevisionInstructions: (
    list: RevisionInstruction[] | ((prev: RevisionInstruction[]) => RevisionInstruction[]),
  ) => void;
  /** Select the active sourceless-pass instruction; writes through to preferences. */
  setActiveRevisionInstructionId: (id: string) => void;
  setAnalysisMode: (m: ReadingMode) => void;
  setDiagnosticMode: (m: ReadingMode) => void;

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
  projectPromptsOverride: {},
  globalPromptsConfig: {},
  cachedCoachAdvice: null,

  customSpells: [],
  activeSpellId: null,
  revisionInstructions: [],
  activeRevisionInstructionId: DEFAULT_INSTRUCTION_ID,
  analysisMode: 'draft',
  diagnosticMode: 'draft',

  modelConfig: {},
  globalModelDefault: {},
  modelCatalog: DEFAULT_CATALOG,
  ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL,

  setActivePersonaId: (id) => set({ activePersonaId: id }),
  setCustomPersonas: (personas) =>
    set((state) => ({
      customPersonas: typeof personas === 'function' ? personas(state.customPersonas) : personas,
    })),
  setPromptsConfig: (config) =>
    set((s) => ({
      promptsConfig: config,
      // The override is what this project changes relative to (defaults ◁ global),
      // so a future global edit still propagates to fields the project left alone.
      projectPromptsOverride: diffPromptsConfig(
        config,
        resolvePromptsConfig(undefined, s.globalPromptsConfig),
      ),
    })),
  setProjectPromptsOverride: (override) =>
    set((s) => ({
      projectPromptsOverride: override,
      promptsConfig: resolvePromptsConfig(override, s.globalPromptsConfig),
    })),
  setGlobalPromptsConfig: (config) => {
    set((s) => ({
      globalPromptsConfig: config,
      promptsConfig: resolvePromptsConfig(s.projectPromptsOverride, config),
    }));
    void prefs.setGlobalPromptsDefault(config);
  },
  setCachedCoachAdvice: (advice) => set({ cachedCoachAdvice: advice }),

  setCustomSpells: (spells) => {
    const next = typeof spells === 'function' ? spells(get().customSpells) : spells;
    set({ customSpells: next });
    void prefs.setSpells(next);
  },
  setActiveSpellId: (id) => set({ activeSpellId: id }),

  setRevisionInstructions: (list) => {
    const next = typeof list === 'function' ? list(get().revisionInstructions) : list;
    set({ revisionInstructions: next });
    void prefs.setRevisionInstructions(next);
  },
  setActiveRevisionInstructionId: (id) => {
    set({ activeRevisionInstructionId: id });
    void prefs.setActiveRevisionInstructionId(id);
  },

  setAnalysisMode: (m) => set({ analysisMode: m }),
  setDiagnosticMode: (m) => set({ diagnosticMode: m }),

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
    const [
      globalModelDefault,
      modelCatalog,
      ollamaBaseUrl,
      customSpells,
      globalPromptsConfig,
      revisionInstructions,
      activeRevisionInstructionId,
    ] = await Promise.all([
      prefs.getGlobalModelDefault(),
      prefs.getModelCatalog(),
      prefs.getOllamaBaseUrl(),
      prefs.getSpells(),
      prefs.getGlobalPromptsDefault(),
      prefs.getRevisionInstructions(),
      prefs.getActiveRevisionInstructionId(),
    ]);
    // Re-resolve the effective config against the just-loaded global tier — a
    // project may already be open by the time prefs hydrate.
    set((s) => ({
      globalModelDefault,
      modelCatalog,
      ollamaBaseUrl,
      customSpells,
      globalPromptsConfig,
      revisionInstructions,
      activeRevisionInstructionId: activeRevisionInstructionId ?? s.activeRevisionInstructionId,
      promptsConfig: resolvePromptsConfig(s.projectPromptsOverride, globalPromptsConfig),
    }));
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
