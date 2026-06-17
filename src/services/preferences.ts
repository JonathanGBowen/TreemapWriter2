import { get, set } from 'idb-keyval';
import type { ModelConfig } from './ai/model-types';
import type { CatalogModel } from './ai/model-catalog';
import { DEFAULT_CATALOG } from './ai/model-catalog';
import { DEFAULT_OLLAMA_BASE_URL } from './ai/clients';
import type { AnalysisSpell, PromptsConfig } from '../types';

/**
 * Global, app-level preferences that are NOT tied to a specific project.
 * The tutorial flag, plus the AI model defaults that are deliberately global:
 * the editable model catalog, the per-machine Ollama endpoint, and the default
 * model config that seeds new projects. API keys do NOT live here — they belong
 * in the OS keyring (see credentials.ts), never in app prefs or project files.
 *
 * Intentionally separate from the Repository — preferences are shared across
 * projects and survive project deletion.
 */

const TUTORIAL_SEEN_KEY = 'treemap_writer_tutorial_seen';
const MODELS_GLOBAL_DEFAULT_KEY = 'treemap_writer_models_global_default';
const MODELS_CATALOG_KEY = 'treemap_writer_models_catalog';
const OLLAMA_BASE_URL_KEY = 'treemap_writer_ollama_base_url';
const SPELLS_KEY = 'treemap_writer_spells';
const SPRINT_CUES_KEY = 'treemap_writer_sprint_cues';
const PROMPTS_GLOBAL_DEFAULT_KEY = 'treemap_writer_prompts_global_default';

export async function hasSeenTutorial(): Promise<boolean> {
  return Boolean(await get(TUTORIAL_SEEN_KEY));
}

export async function markTutorialSeen(): Promise<void> {
  await set(TUTORIAL_SEEN_KEY, true);
}

/** Default per-kind model config that seeds new projects. Empty = "use built-ins". */
export async function getGlobalModelDefault(): Promise<ModelConfig> {
  const stored = await get<ModelConfig>(MODELS_GLOBAL_DEFAULT_KEY);
  return stored && typeof stored === 'object' ? stored : {};
}

export async function setGlobalModelDefault(config: ModelConfig): Promise<void> {
  await set(MODELS_GLOBAL_DEFAULT_KEY, config);
}

/** Editable model catalog; falls back to the seed if nothing is stored. */
export async function getModelCatalog(): Promise<CatalogModel[]> {
  const stored = await get<CatalogModel[]>(MODELS_CATALOG_KEY);
  return Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_CATALOG;
}

export async function setModelCatalog(catalog: CatalogModel[]): Promise<void> {
  await set(MODELS_CATALOG_KEY, catalog);
}

export async function getOllamaBaseUrl(): Promise<string> {
  const stored = await get<string>(OLLAMA_BASE_URL_KEY);
  return typeof stored === 'string' && stored.length > 0 ? stored : DEFAULT_OLLAMA_BASE_URL;
}

export async function setOllamaBaseUrl(url: string): Promise<void> {
  await set(OLLAMA_BASE_URL_KEY, url);
}

/**
 * User-created analytical "spells" (lenses). A global library shared across all
 * projects, like the model catalog — the built-in defaults live in code
 * (`lib/defaultSpells.ts`) and are NOT stored here. Empty array when none saved.
 */
export async function getSpells(): Promise<AnalysisSpell[]> {
  const stored = await get<AnalysisSpell[]>(SPELLS_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function setSpells(spells: AnalysisSpell[]): Promise<void> {
  await set(SPELLS_KEY, spells);
}

/**
 * Living Sprints: whether the optional ambient hue + transition "ding" are on.
 * Global, off by default (the quiet HLD surface is the default; cues are a
 * sensory aid the writer opts into). Honored alongside `prefers-reduced-motion`.
 */
export async function getSprintCuesEnabled(): Promise<boolean> {
  return Boolean(await get(SPRINT_CUES_KEY));
}

export async function setSprintCuesEnabled(enabled: boolean): Promise<void> {
  await set(SPRINT_CUES_KEY, enabled);
}

/**
 * User-level prompt overrides — the global tier shared across all projects. The
 * built-in defaults live in code (the prompt registry), so this is stored SPARSE
 * (only the fields the user changed); `{}` means "use built-ins everywhere".
 * Resolution: built-in defaults ◁ this ◁ per-project overrides.
 */
export async function getGlobalPromptsDefault(): Promise<Partial<PromptsConfig>> {
  const stored = await get<Partial<PromptsConfig>>(PROMPTS_GLOBAL_DEFAULT_KEY);
  return stored && typeof stored === 'object' ? stored : {};
}

export async function setGlobalPromptsDefault(config: Partial<PromptsConfig>): Promise<void> {
  await set(PROMPTS_GLOBAL_DEFAULT_KEY, config);
}
