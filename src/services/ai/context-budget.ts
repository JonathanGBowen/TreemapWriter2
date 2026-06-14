// Whole-document context budgeting.
//
// Root-level calls (spec Phase 0, document analysis, document evaluation) send the
// ENTIRE document to the model rather than the per-section character slices used
// elsewhere. The binding rule is "never silently truncate": before such a call we
// estimate the document's token cost and compare it to the chosen model's context
// window. Callers decide what to do on overflow (abort + warn for the explicit
// analyze/evaluate actions; degrade to an outline for the batch spec run).

import type { CatalogModel } from './model-catalog';
import { findCatalogModel } from './model-catalog';
import type { ProviderId } from './model-types';

/** Reserve room for the model's own output when computing usable input budget. */
const OUTPUT_RESERVE_TOKENS = 16000;
/** Headroom for prompt scaffolding (instructions, JSON wrappers, spec context). */
const SCAFFOLD_MARGIN_TOKENS = 4000;

/**
 * Rough token estimate. ~4 characters/token is the standard heuristic for English
 * prose; deliberately simple and dependency-free. We intentionally do NOT call a
 * tokenizer — this only needs to be good enough to catch genuine overflow.
 */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export interface ContextFit {
  /** Safe to send the full text? True when it fits, or the window is unknown. */
  ok: boolean;
  /** True only when the window is known AND the text exceeds the usable budget. */
  overflow: boolean;
  /** True when the model's context window is unknown (e.g. a detected Ollama model). */
  unknownWindow: boolean;
  estimatedTokens: number;
  contextWindow: number | null;
  usableTokens: number | null;
}

/**
 * Does `text` fit the chosen model's context window, leaving room for output and
 * prompt scaffolding? An unknown window yields `ok: true, unknownWindow: true` so
 * callers proceed but can warn.
 */
export const checkContextFit = (
  catalog: CatalogModel[],
  choice: { provider: ProviderId; model: string },
  text: string,
): ContextFit => {
  const estimatedTokens = estimateTokens(text);
  const contextWindow = findCatalogModel(catalog, choice.provider, choice.model)?.contextWindow ?? null;

  if (contextWindow == null) {
    return {
      ok: true,
      overflow: false,
      unknownWindow: true,
      estimatedTokens,
      contextWindow: null,
      usableTokens: null,
    };
  }

  const usableTokens = Math.max(0, contextWindow - OUTPUT_RESERVE_TOKENS - SCAFFOLD_MARGIN_TOKENS);
  const overflow = estimatedTokens > usableTokens;
  return {
    ok: !overflow,
    overflow,
    unknownWindow: false,
    estimatedTokens,
    contextWindow,
    usableTokens,
  };
};
