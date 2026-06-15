// Budget-aware packing of the master document + source library into the chosen
// model's usable input window. Replaces the fixed character caps the revision and
// suggest-directives flows used to apply blindly — which wasted ~99% of a 1M-token
// Gemini window AND silently truncated the exact passages the engine must quote
// verbatim. Reuses the analysis flow's reserves (context-budget.ts); pure + tested.

import type { SourceDocument } from '../../types';
import { OUTPUT_RESERVE_TOKENS, SCAFFOLD_MARGIN_TOKENS, estimateTokens } from './context-budget';

const CHARS_PER_TOKEN = 4;
/** Usable input budget when the model's window is unknown (e.g. a detected Ollama model). */
const FALLBACK_USABLE_TOKENS = 8000;
/** The master document is essential, but with sources present it must not eat the whole budget. */
const SECTION_BUDGET_FRACTION = 0.7;

const tokensToChars = (tokens: number): number => Math.max(0, Math.floor(tokens * CHARS_PER_TOKEN));

export interface BudgetedInput {
  sectionText: string;
  sources: SourceDocument[];
  /** True if the section or any source was trimmed to fit. */
  trimmed: boolean;
  estimatedTokens: number;
  usableTokens: number;
}

/**
 * Water-fill `budgetTokens` across sources: each gets a fair share, and a source
 * smaller than its share returns the surplus to be redistributed greedily to the
 * larger ones — so a single big source never starves the rest and small sources are
 * never needlessly cut. Returns each source's token allowance, in input order.
 */
const allocate = (sourceTokens: number[], budgetTokens: number): number[] => {
  const allowance = new Array(sourceTokens.length).fill(0);
  // Ascending size: small sources claim first and release their surplus to the rest.
  const order = sourceTokens.map((_, i) => i).sort((a, b) => sourceTokens[a] - sourceTokens[b]);
  let remaining = Math.max(0, budgetTokens);
  let left = order.length;
  for (const i of order) {
    const share = left > 0 ? Math.floor(remaining / left) : 0;
    const give = Math.min(sourceTokens[i], share);
    allowance[i] = give;
    remaining -= give;
    left -= 1;
  }
  return allowance;
};

/**
 * Pack the section + sources into the chosen model's usable input window. On a
 * large-window model (Gemini ~1M) everything fits and nothing is trimmed; on a small
 * window or with many large sources it trims gracefully and flags `trimmed` so the
 * caller can warn the user instead of silently dropping quotable text.
 */
export const budgetRevisionInput = (args: {
  sectionText: string;
  sources: SourceDocument[];
  contextWindow: number | null | undefined;
}): BudgetedInput => {
  const usableTokens = args.contextWindow
    ? Math.max(0, args.contextWindow - OUTPUT_RESERVE_TOKENS - SCAFFOLD_MARGIN_TOKENS)
    : FALLBACK_USABLE_TOKENS;

  // Section first — you cannot revise text you did not send. With sources present,
  // cap it so they get a share; with no sources, it may use the whole budget.
  const sectionTokens = estimateTokens(args.sectionText);
  const sectionCap = args.sources.length > 0
    ? Math.floor(usableTokens * SECTION_BUDGET_FRACTION)
    : usableTokens;
  const sectionAllowance = Math.min(sectionTokens, sectionCap);
  const sectionText =
    sectionAllowance < sectionTokens
      ? args.sectionText.slice(0, tokensToChars(sectionAllowance))
      : args.sectionText;

  const remaining = Math.max(0, usableTokens - estimateTokens(sectionText));
  const sourceTokens = args.sources.map((s) => estimateTokens(s.content));
  const allowances = allocate(sourceTokens, remaining);

  let trimmed = sectionText.length < args.sectionText.length;
  const sources = args.sources.map((s, i) => {
    if (allowances[i] >= sourceTokens[i]) return s;
    trimmed = true;
    return { ...s, content: s.content.slice(0, tokensToChars(allowances[i])) };
  });

  const estimatedTokens =
    estimateTokens(sectionText) + sources.reduce((sum, s) => sum + estimateTokens(s.content), 0);
  return { sectionText, sources, trimmed, estimatedTokens, usableTokens };
};

/** The single source-formatting block, shared by the revision + suggest flows. */
export const formatSourceBlock = (s: SourceDocument): string =>
  `--- [Source ID: ${s.id}] ${s.label} (${s.kind}) ---\n${s.content}`;

/** Format a (pre-budgeted) source list, or a placeholder when empty. */
export const formatSources = (sources: SourceDocument[], empty = '(none provided)'): string =>
  sources.length ? sources.map(formatSourceBlock).join('\n\n') : empty;
