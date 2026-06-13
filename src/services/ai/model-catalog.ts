// The editable model catalog — the single source of truth for "which models
// can the user pick". Replaces the four duplicated `MODELS` arrays that used
// to live inside individual modals.
//
// Obsolescence is fixed structurally: this seed is just defaults. The real
// catalog lives in global preferences and is user-editable in the AI Settings
// modal, so a model id going stale is a one-click fix, not a code change.
// Ollama models are NOT seeded here — they are auto-detected at runtime from
// the local server's GET /api/tags.

import type { ProviderId } from './model-types';

/** A coarse speed/depth bucket, used only for the picker glyph + ordering. */
export type ModelTier = 'fast' | 'balanced' | 'deep';

export interface CatalogModel {
  provider: ProviderId;
  id: string;
  /** Human label for the picker. */
  displayName: string;
  /** One short line; no full sentences where avoidable (HLD aesthetic). */
  desc: string;
  /** Whether a numeric thinking-budget knob is meaningful for this model. */
  supportsThinking: boolean;
  /** Budget applied when thinking is enabled (Gemini-only; 0 elsewhere). */
  defaultThinkingBudget: number;
  tier: ModelTier;
}

/**
 * Seed catalog. Gemini ids are the union of the four legacy modal arrays;
 * Anthropic ids are the current GA models. Users add/edit/remove from here in
 * the AI Settings modal; Ollama rows are injected at runtime.
 */
export const DEFAULT_CATALOG: CatalogModel[] = [
  // --- Gemini ---
  {
    provider: 'gemini',
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    desc: 'Deepest reasoning. Best for complex logic.',
    supportsThinking: true,
    defaultThinkingBudget: 16000,
    tier: 'deep',
  },
  {
    provider: 'gemini',
    id: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    desc: 'Balanced reasoning & speed.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'balanced',
  },
  {
    provider: 'gemini',
    id: 'gemini-3.1-flash-lite-preview',
    displayName: 'Gemini Flash Lite',
    desc: 'Fastest. Quick checks.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'fast',
  },
  {
    provider: 'gemini',
    id: 'gemini-flash-latest',
    displayName: 'Gemini Flash',
    desc: 'Fast. Standard reasoning.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'fast',
  },
  // --- Anthropic --- (thinking is adaptive/native; no numeric budget exposed)
  {
    provider: 'anthropic',
    id: 'claude-opus-4-8',
    displayName: 'Claude Opus 4.8',
    desc: 'Deepest Claude. Best for hard argument.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'deep',
  },
  {
    provider: 'anthropic',
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    desc: 'Balanced Claude. Strong general use.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'balanced',
  },
  {
    provider: 'anthropic',
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    desc: 'Fast Claude. Quick feedback.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'fast',
  },
];

/** Look up catalog metadata for a provider+model, if known. */
export function findCatalogModel(
  catalog: CatalogModel[],
  provider: ProviderId,
  id: string,
): CatalogModel | undefined {
  return catalog.find((m) => m.provider === provider && m.id === id);
}

/** Build an Ollama catalog row from a model name reported by /api/tags. */
export function ollamaCatalogModel(name: string): CatalogModel {
  return {
    provider: 'ollama',
    id: name,
    displayName: name,
    desc: 'Local model (Ollama).',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'balanced',
  };
}
