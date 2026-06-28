// Default fallback settings, DERIVED from the catalog.
//
// The ordered Gemini list in `model-catalog.ts` is the single source of truth for
// which Gemini models exist AND for the fallback order. This module turns that one
// list into the default ladder, so the catalog and the ladder can never drift
// apart (the bug this replaces: two hand-maintained copies of the same 7 models).
//
// Kept separate from `model-fallback.ts` so that module stays a pure leaf that
// imports only `model-types` — it owns the fallback POLICY (classification,
// cooldowns, candidate building); the default DATA lives here, next to its source.

import { GEMINI_CATALOG } from './model-catalog';
import type { FallbackSettings } from './model-fallback';
import type { ModelChoice } from './model-types';

/**
 * The default ladder: the catalog's Gemini list, in order, as bare model choices.
 * Strongest → weakest. Edit `GEMINI_CATALOG` (one list) and this follows.
 */
export const DEFAULT_FALLBACK_LADDER: ModelChoice[] = GEMINI_CATALOG.map((m) => ({
  provider: m.provider,
  model: m.id,
}));

export const DEFAULT_FALLBACK_SETTINGS: FallbackSettings = {
  enabled: true,
  ladder: DEFAULT_FALLBACK_LADDER,
};
