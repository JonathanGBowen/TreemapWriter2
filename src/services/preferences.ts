import { get, set } from 'idb-keyval';
import type { ModelConfig } from './ai/model-types';
import type { CatalogModel } from './ai/model-catalog';
import { DEFAULT_CATALOG } from './ai/model-catalog';
import { DEFAULT_OLLAMA_BASE_URL } from './ai/clients';

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
