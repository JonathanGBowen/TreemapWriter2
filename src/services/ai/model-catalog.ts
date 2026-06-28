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

/**
 * How a model expresses its reasoning allowance. Gemini 2.5 takes a numeric
 * `thinkingBudget`; Gemini 3 takes a coarse `thinkingLevel` ('low' | 'high').
 * The dispatch layer reads this to send the right field (see ai-provider.impl.ts).
 * Absent ⇒ legacy numeric-budget behavior.
 */
export type ThinkingStyle = 'budget' | 'level';

export interface CatalogModel {
  provider: ProviderId;
  id: string;
  /** Human label for the picker. */
  displayName: string;
  /** One short line; no full sentences where avoidable (HLD aesthetic). */
  desc: string;
  /** Whether a thinking knob is meaningful for this model at all. */
  supportsThinking: boolean;
  /** Budget applied when thinking is enabled (Gemini-only; 0 elsewhere). */
  defaultThinkingBudget: number;
  tier: ModelTier;
  /**
   * Approximate input context window in tokens. Used to guard whole-document
   * (root-level) calls against silent truncation. Optional: unknown windows
   * (e.g. detected Ollama models) are left unset and treated as "proceed but warn".
   */
  contextWindow?: number;
  /**
   * Which API field carries the thinking allowance for this model. Only read when
   * `supportsThinking`. Absent ⇒ treated as 'budget' (the legacy default).
   */
  thinking?: ThinkingStyle;
  /**
   * Whether the model honors a strict response JSON Schema. Default-assume true
   * (absent ⇒ supported). Seeded false for Gemma, which the Gemini API serves
   * without structured-output support — the client degrades to plain JSON mode.
   */
  supportsJsonSchema?: boolean;
  /**
   * Whether the model accepts an out-of-band system instruction. Default-assume
   * true (absent ⇒ supported). Seeded false for Gemma — the client folds the
   * system instruction into the prompt instead.
   */
  supportsSystemInstruction?: boolean;
  /**
   * Per-MINUTE request quota for this model, where the provider enforces one
   * (Gemini's free tier: 5/min for flash, 15/min for flash-lite & gemma). The
   * dispatch layer reads this to throttle outgoing calls so a burst flow doesn't
   * trip the per-minute 429 in the first place. Absent ⇒ no client-side throttle.
   */
  requestsPerMinute?: number;
}

/**
 * The ordered Gemini/Gemma list — the SINGLE source of truth for both the picker
 * rows and the default fallback ladder. The order here IS the ladder order
 * (strongest → weakest); `model-defaults.ts` derives `DEFAULT_FALLBACK_LADDER`
 * from this array, so the two can never drift. (Pro is omitted by design: its
 * daily free quota is too small to rely on. Flash models are the de-facto "heavy"
 * tier and run with maximum thinking; Gemma sits at the bottom as a last resort
 * and is served without system-instruction / structured-output support.)
 *
 * `requestsPerMinute` encodes Gemini's free-tier per-minute quota so the dispatch
 * layer can throttle proactively (5/min flash, 15/min flash-lite & gemma).
 */
export const GEMINI_CATALOG: CatalogModel[] = [
  {
    provider: 'gemini',
    id: 'gemini-flash-latest',
    displayName: 'Gemini Flash (latest)',
    desc: 'Strongest available. Heavy reasoning.',
    supportsThinking: true,
    defaultThinkingBudget: -1,
    // The de-facto "deep" tier now that Pro is gone — the DEPTH control's deepest
    // stop resolves here, with maximum thinking.
    tier: 'deep',
    contextWindow: 1_000_000,
    thinking: 'level',
    requestsPerMinute: 5,
  },
  {
    provider: 'gemini',
    id: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    desc: 'Balanced reasoning & speed.',
    supportsThinking: true,
    defaultThinkingBudget: -1,
    tier: 'balanced',
    contextWindow: 1_000_000,
    thinking: 'level',
    requestsPerMinute: 5,
  },
  {
    provider: 'gemini',
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    desc: 'Proven flash. General use.',
    supportsThinking: true,
    defaultThinkingBudget: -1,
    tier: 'balanced',
    contextWindow: 1_000_000,
    thinking: 'budget',
    requestsPerMinute: 5,
  },
  {
    provider: 'gemini',
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    desc: 'Fast. Quick checks.',
    supportsThinking: true,
    defaultThinkingBudget: 0,
    tier: 'fast',
    contextWindow: 1_000_000,
    thinking: 'level',
    requestsPerMinute: 15,
  },
  {
    provider: 'gemini',
    id: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    desc: 'Fastest. High-volume calls.',
    supportsThinking: true,
    defaultThinkingBudget: 0,
    tier: 'fast',
    contextWindow: 1_000_000,
    thinking: 'budget',
    requestsPerMinute: 15,
  },
  {
    provider: 'gemini',
    id: 'gemma-4-31b-it',
    displayName: 'Gemma 4 31B',
    desc: 'Open model. Last-resort fallback.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'fast',
    contextWindow: 131_072,
    supportsJsonSchema: false,
    supportsSystemInstruction: false,
    requestsPerMinute: 15,
  },
  {
    provider: 'gemini',
    id: 'gemma-4-26b-a4b-it',
    displayName: 'Gemma 4 26B',
    desc: 'Open model. Last-resort fallback.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'fast',
    contextWindow: 131_072,
    supportsJsonSchema: false,
    supportsSystemInstruction: false,
    requestsPerMinute: 15,
  },
];

/**
 * Seed catalog = the ordered Gemini list above, then the Anthropic GA models and
 * their Agent-SDK twins. Users add/edit/remove from here in the AI Settings modal;
 * Ollama rows are injected at runtime.
 */
export const DEFAULT_CATALOG: CatalogModel[] = [
  ...GEMINI_CATALOG,
  // --- Anthropic --- (thinking is adaptive/native; no numeric budget exposed)
  {
    provider: 'anthropic',
    id: 'claude-opus-4-8',
    displayName: 'Claude Opus 4.8',
    desc: 'Deepest Claude. Best for hard argument.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'deep',
    contextWindow: 200_000,
  },
  {
    provider: 'anthropic',
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    desc: 'Balanced Claude. Strong general use.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'balanced',
    contextWindow: 200_000,
  },
  {
    provider: 'anthropic',
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    desc: 'Fast Claude. Quick feedback.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'fast',
    contextWindow: 200_000,
  },
  // --- Claude Agent SDK --- (experimental; runs via the local Node helper and
  // your Max subscription. Same model ids as Anthropic; the transport differs.)
  {
    provider: 'agent-sdk',
    id: 'claude-opus-4-8',
    displayName: 'Opus 4.8 (Agent SDK)',
    desc: 'Deepest Claude, via your subscription.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'deep',
    contextWindow: 200_000,
  },
  {
    provider: 'agent-sdk',
    id: 'claude-sonnet-4-6',
    displayName: 'Sonnet 4.6 (Agent SDK)',
    desc: 'Balanced Claude, via your subscription.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'balanced',
    contextWindow: 200_000,
  },
  {
    provider: 'agent-sdk',
    id: 'claude-haiku-4-5',
    displayName: 'Haiku 4.5 (Agent SDK)',
    desc: 'Fast Claude, via your subscription.',
    supportsThinking: false,
    defaultThinkingBudget: 0,
    tier: 'fast',
    contextWindow: 200_000,
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
