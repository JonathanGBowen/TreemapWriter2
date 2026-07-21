// DEPTH control ↔ multi-provider model resolution.
//
// The overhauled Generate-Specs / Run-Diagnostic modals present a 2- or 3-stop
// DEPTH control (fast / balanced / deep) instead of a raw model picker. DEPTH
// is "how deep should THIS run go" — it must NOT hardcode Gemini ids, because
// the provider is the user's standing choice (set in AI settings). So DEPTH
// maps to a model *tier* within whatever provider the resolved ModelChoice
// already names. Deep additionally turns on thinking where the model supports
// a numeric budget.
//
// Pure module: no React, no SDK. Catalog comes from the store at the call site.

import type { CatalogModel, ModelTier } from '../../../services/ai/model-catalog';
import type { ModelChoice } from '../../../services/ai/model-types';

const TIER_ORDER: ModelTier[] = ['fast', 'balanced', 'deep'];

/** Tiers ordered by nearness to `target` (target first), for graceful fallback
 *  when a provider's catalog is missing the exact tier (e.g. a single Ollama model). */
function tierPreference(target: ModelTier): ModelTier[] {
  const idx = TIER_ORDER.indexOf(target);
  return [...TIER_ORDER].sort(
    (a, b) => Math.abs(TIER_ORDER.indexOf(a) - idx) - Math.abs(TIER_ORDER.indexOf(b) - idx),
  );
}

/** Pick the catalog model for a tier, preferring `preferredId` when it already
 *  sits at the target tier (so re-selecting the current depth is a no-op). */
function pickForTier(
  providerModels: CatalogModel[],
  preferredId: string,
  tier: ModelTier,
): CatalogModel | undefined {
  for (const t of tierPreference(tier)) {
    const ofTier = providerModels.filter((m) => m.tier === t);
    if (ofTier.length === 0) continue;
    return ofTier.find((m) => m.id === preferredId) ?? ofTier[0];
  }
  return undefined;
}

/** Resolve a DEPTH selection to a concrete ModelChoice within the base provider. */
export function resolveDepthChoice(
  catalog: CatalogModel[],
  base: ModelChoice,
  tier: ModelTier,
): ModelChoice {
  const providerModels = catalog.filter((m) => m.provider === base.provider);
  const pick = pickForTier(providerModels, base.model, tier);
  if (!pick) return base; // provider has no catalog rows — leave the choice untouched
  return {
    provider: base.provider,
    model: pick.id,
    thinkingBudget: tier === 'deep' && pick.supportsThinking ? pick.defaultThinkingBudget : 0,
  };
}

/** The tier of the currently-selected model (for initialising the DEPTH stop). */
export function tierOf(catalog: CatalogModel[], choice: ModelChoice): ModelTier {
  return catalog.find((m) => m.provider === choice.provider && m.id === choice.model)?.tier ?? 'balanced';
}

/** The display name DEPTH would resolve to at `tier` — used as the stop's fine-print. */
export function depthModelLabel(catalog: CatalogModel[], base: ModelChoice, tier: ModelTier): string {
  const providerModels = catalog.filter((m) => m.provider === base.provider);
  return pickForTier(providerModels, base.model, tier)?.displayName ?? base.model;
}
