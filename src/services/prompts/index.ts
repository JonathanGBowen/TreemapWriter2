// Public barrel for prompts. The INVENTORY lives in ./registry.ts; this file
// derives the runtime config artifacts from it and exposes the tier-resolution
// helpers. Nothing here hand-maintains a prompt list — that would re-introduce
// the drift the registry exists to kill.

import type { PromptsConfig } from '../../types';
import { EDITABLE_PROMPTS } from './registry';

export {
  PROMPT_REGISTRY,
  EDITABLE_PROMPTS,
  getPromptEntry,
  getPromptText,
} from './registry';
export type {
  PromptEntry,
  PromptVariable,
  PromptCategory,
  PromptEditability,
  EditablePromptKey,
} from './registry';
export { interpolate, renderPrompt } from './interpolate';

import type { EditablePromptKey } from './registry';

/** Built-in defaults — the bottom tier. Derived from the editable registry entries. */
export const DEFAULT_PROMPTS_CONFIG: PromptsConfig = Object.fromEntries(
  EDITABLE_PROMPTS.map((e) => [e.key, e.defaultText]),
) as PromptsConfig;

/**
 * Resolve the effective prompts config from the three tiers. Later tiers win:
 * built-in defaults ◁ global user overrides ◁ per-project overrides. Both
 * override layers are sparse (only the fields they actually change), so a global
 * edit shows through for any field a project hasn't overridden.
 */
export const resolvePromptsConfig = (
  project?: Partial<PromptsConfig> | null,
  global?: Partial<PromptsConfig> | null,
): PromptsConfig => ({
  ...DEFAULT_PROMPTS_CONFIG,
  ...(global ?? {}),
  ...(project ?? {}),
});

/**
 * Hydration boundary for persisted configs (project files, snapshots, the demo)
 * that may predate newer prompt fields or store a full blob. Merging over the
 * defaults guarantees every field is populated. This is the two-tier
 * (defaults ◁ raw) special case of `resolvePromptsConfig`; existing callers that
 * don't know about the global tier keep working unchanged.
 */
export const normalizePromptsConfig = (
  raw?: Partial<PromptsConfig> | null,
): PromptsConfig => resolvePromptsConfig(raw, undefined);

/**
 * Reduce a (possibly full) config to a SPARSE override: only the fields whose
 * value differs from `base`. This is how a project/global override is derived
 * from an effective config, and how legacy full blobs collapse to `{}` when they
 * never actually customized anything (letting the global tier show through).
 */
export const diffPromptsConfig = (
  candidate: Partial<PromptsConfig> | null | undefined,
  base: PromptsConfig,
): Partial<PromptsConfig> => {
  const out: Partial<PromptsConfig> = {};
  if (!candidate) return out;
  (Object.keys(candidate) as (keyof PromptsConfig)[]).forEach((k) => {
    const value = candidate[k];
    if (value !== undefined && value !== base[k]) out[k] = value;
  });
  return out;
};

/** Which tier owns a prompt's effective value. */
export type PromptTier = 'default' | 'global' | 'project';

/**
 * Provenance of a prompt's effective value, given the (sparse) project and
 * global override layers. A key present in an override layer means that layer
 * owns it (project wins over global wins over the built-in default).
 */
export const promptSource = (
  key: EditablePromptKey,
  project?: Partial<PromptsConfig> | null,
  global?: Partial<PromptsConfig> | null,
): PromptTier =>
  project && key in project ? 'project' : global && key in global ? 'global' : 'default';
