import { get, set } from 'idb-keyval';
import type { ModelConfig } from './ai/model-types';
import type { CatalogModel } from './ai/model-catalog';
import { DEFAULT_CATALOG } from './ai/model-catalog';
import { DEFAULT_OLLAMA_BASE_URL } from './ai/clients';
import type { AnalysisSpell, PromptsConfig, RevisionInstruction } from '../types';

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
const SPRINT_COACH_STYLE_KEY = 'treemap_writer_sprint_coach_style';
const SPRINT_GOAL_MODEL_KEY = 'treemap_writer_sprint_goal_model';
const PROMPTS_GLOBAL_DEFAULT_KEY = 'treemap_writer_prompts_global_default';
const REVISION_INSTRUCTIONS_KEY = 'treemap_writer_revision_instructions';
const REVISION_INSTRUCTION_ACTIVE_KEY = 'treemap_writer_revision_instruction_active';

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
 * Living Sprints — the coach start protocol's two preferences. Both follow the
 * "last-selected becomes the default" rule: the coach phase persists the choice
 * the moment the writer flips it, so the next sprint opens on what they used
 * last. Defaults are the gentlest / best-evidence option for a first run.
 */
export type SprintCoachStyle = 'guided' | 'chat' | 'hybrid';
export type SprintGoalModelPref = 'woop' | 'plain';

const COACH_STYLES: SprintCoachStyle[] = ['guided', 'chat', 'hybrid'];
const GOAL_MODELS: SprintGoalModelPref[] = ['woop', 'plain'];

/** How the coach runs the start protocol. Default 'guided' (lowest overhead). */
export async function getSprintCoachStyle(): Promise<SprintCoachStyle> {
  const stored = await get<SprintCoachStyle>(SPRINT_COACH_STYLE_KEY);
  return stored && COACH_STYLES.includes(stored) ? stored : 'guided';
}

export async function setSprintCoachStyle(style: SprintCoachStyle): Promise<void> {
  await set(SPRINT_COACH_STYLE_KEY, style);
}

/** How the goal is framed. Default 'woop' (the report's best-validated option). */
export async function getSprintGoalModel(): Promise<SprintGoalModelPref> {
  const stored = await get<SprintGoalModelPref>(SPRINT_GOAL_MODEL_KEY);
  return stored && GOAL_MODELS.includes(stored) ? stored : 'woop';
}

export async function setSprintGoalModel(model: SprintGoalModelPref): Promise<void> {
  await set(SPRINT_GOAL_MODEL_KEY, model);
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

/**
 * User-created revision Instructions — a global library shared across projects,
 * like the spell library. The built-in defaults live in code
 * (`lib/defaultInstructions.ts`) and are NOT stored here; this holds only the
 * user's additions. Empty array when none saved.
 */
export async function getRevisionInstructions(): Promise<RevisionInstruction[]> {
  const stored = await get<RevisionInstruction[]>(REVISION_INSTRUCTIONS_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function setRevisionInstructions(list: RevisionInstruction[]): Promise<void> {
  await set(REVISION_INSTRUCTIONS_KEY, list);
}

/** The id of the active instruction (the one a sourceless pass uses). Null = built-in default. */
export async function getActiveRevisionInstructionId(): Promise<string | null> {
  const stored = await get<string>(REVISION_INSTRUCTION_ACTIVE_KEY);
  return typeof stored === 'string' ? stored : null;
}

export async function setActiveRevisionInstructionId(id: string): Promise<void> {
  await set(REVISION_INSTRUCTION_ACTIVE_KEY, id);
}
