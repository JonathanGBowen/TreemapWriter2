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
import type { CatalogModel } from './model-catalog';
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

/**
 * Reconcile a persisted fallback ladder against the live catalog. Rungs whose model
 * is no longer in the catalog (e.g. a model id retired from an earlier default) are
 * dropped. If pruning empties a PREVIOUSLY NON-EMPTY ladder — i.e. it was entirely
 * stale — the default ladder is restored rather than leaving fallback inert. A
 * partially-stale ladder is pruned only (the user's order is otherwise kept), and
 * when nothing is pruned the SAME array reference is returned so the caller can
 * cheaply detect "unchanged" and skip a needless re-persist.
 */
export function reconcileFallbackLadder(
  persisted: ModelChoice[] | null | undefined,
  catalog: CatalogModel[],
): ModelChoice[] {
  if (!Array.isArray(persisted)) return [...DEFAULT_FALLBACK_LADDER];
  if (persisted.length === 0) return persisted;
  const live = new Set(catalog.map((m) => `${m.provider}:${m.id}`));
  const kept = persisted.filter((c) => live.has(`${c.provider}:${c.model}`));
  if (kept.length === persisted.length) return persisted; // nothing pruned — same ref
  return kept.length > 0 ? kept : [...DEFAULT_FALLBACK_LADDER];
}
