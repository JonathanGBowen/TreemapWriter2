// Per-call model configuration + its hydration boundary.
//
// `DEFAULT_MODEL_CONFIG` reproduces the EXACT model ids and thinking budgets
// the app used before this change (the old module-level constants in
// gemini-provider.ts and the modal defaults), so a project with no saved
// config behaves identically to before.

import type { AICallKind, ModelChoice, ModelConfig } from './model-types';

const g = (model: string, thinkingBudget: number): ModelChoice => ({
  provider: 'gemini',
  model,
  thinkingBudget,
});

/**
 * Built-in fallback for every call kind. Mirrors the pre-refactor behavior:
 *   - specs/diagnostic/coach/suggestions/personas: flash-tier, no thinking
 *   - dependencies/refine/analysis/refactor/dialogue: pro, with the old budgets
 */
export const DEFAULT_MODEL_CONFIG: Record<AICallKind, ModelChoice> = {
  generateSpecs: g('gemini-3-flash-preview', 0),
  runDiagnostic: g('gemini-3.1-flash-lite-preview', 0),
  estimateDependencies: g('gemini-3.1-pro-preview', 1024),
  getCoachAdvice: g('gemini-3-flash-preview', 0),
  // Streaming coach mirrors the coach default — same model, just yielded live.
  streamCoachAdvice: g('gemini-3-flash-preview', 0),
  getContentSuggestions: g('gemini-3.1-flash-lite-preview', 0),
  generatePersonas: g('gemini-3-flash-preview', 0),
  refineSpec: g('gemini-3.1-pro-preview', 16000),
  analyzeSection: g('gemini-3.1-pro-preview', 16000),
  refactorAnalysis: g('gemini-3.1-pro-preview', 16000),
  continueDialogue: g('gemini-3.1-pro-preview', 8192),
  generateRevisions: g('gemini-3.1-pro-preview', 4000),
  // Distillation is reasoning-heavy but bounded; mirror the revision engine's tier.
  generateReverseOutline: g('gemini-3.1-pro-preview', 4000),
  // A careful per-paragraph analogical rewrite — same pro-tier as the revision engine.
  regenerateParagraph: g('gemini-3.1-pro-preview', 4000),
  // Gist Editor: voice-fidelity is the central risk, so the strongest tier. Analysis
  // is reasoning-heavy; composition writes the three grains; refresh/re-fit are bounded.
  analyzeGist: g('gemini-3.1-pro-preview', 8192),
  composeGist: g('gemini-3.1-pro-preview', 8192),
  refreshGistSpan: g('gemini-3.1-pro-preview', 2048),
  refitGist: g('gemini-3.1-pro-preview', 2048),
  suggestDirectives: g('gemini-3.1-pro-preview', 2048),
  // Light/fast: a sprint plan is short and the Brief must feel quick (>200ms rule).
  generateSprintPlan: g('gemini-3-flash-preview', 0),
  // Live coach turn — must feel instant; flash, streamed token-by-token.
  coachSprintTurn: g('gemini-3-flash-preview', 0),
  // A single-step breakdown is tiny and must feel instant — flash, no thinking.
  decomposeSprintStep: g('gemini-3-flash-preview', 0),
  // Heavy reasoning over two whole drafts — mirror analyzeSection's pro-tier budget.
  compareVersions: g('gemini-3.1-pro-preview', 16000),
  // Atmospheric reading over a whole draft — same pro-tier budget as analyzeSection.
  analyzeAtmosphere: g('gemini-3.1-pro-preview', 16000),
  // Collaborative per-level spec development — a conversational reasoning turn,
  // so it mirrors continueDialogue's pro-tier budget.
  developSpecLevel: g('gemini-3.1-pro-preview', 8192),
  // Gestalt whole/part ops — focused reasoning over one section; pro-tier, bounded.
  reconstructWhole: g('gemini-3.1-pro-preview', 4000),
  proposeRecenterings: g('gemini-3.1-pro-preview', 4000),
};

/**
 * Hydration boundary for a persisted per-project ModelConfig.
 *
 * UNLIKE `normalizePromptsConfig` (which fully populates over defaults), this
 * deliberately keeps the config SPARSE — it only drops malformed entries. A
 * missing kind must stay missing so resolution can fall through to the global
 * default before reaching the built-in default. Populating here would pin every
 * project to the built-ins and defeat the global default.
 */
export function normalizeModelConfig(
  raw: Partial<ModelConfig> | null | undefined,
): ModelConfig {
  if (!raw || typeof raw !== 'object') return {};
  const out: ModelConfig = {};
  for (const [kind, choice] of Object.entries(raw)) {
    if (!isValidChoice(choice)) continue;
    out[kind as AICallKind] = {
      provider: choice.provider,
      model: choice.model,
      ...(typeof choice.thinkingBudget === 'number'
        ? { thinkingBudget: choice.thinkingBudget }
        : {}),
    };
  }
  return out;
}

function isValidChoice(c: unknown): c is ModelChoice {
  if (!c || typeof c !== 'object') return false;
  const choice = c as Record<string, unknown>;
  return (
    (choice.provider === 'gemini' ||
      choice.provider === 'anthropic' ||
      choice.provider === 'ollama' ||
      choice.provider === 'agent-sdk') &&
    typeof choice.model === 'string' &&
    choice.model.length > 0
  );
}
