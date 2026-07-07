// Per-call model configuration + its hydration boundary.
//
// `DEFAULT_MODEL_CONFIG` maps each call kind onto the most natural model class.
// Gemini Pro is gone (its daily free quota is too small to rely on), so Flash is
// now the de-facto "heavy" tier and runs with MAXIMUM thinking. The mapping has
// three buckets:
//   A — heavy reasoning  → gemini-flash-latest, thinking on  (THINK = -1)
//   B — interactive/many → gemini-3-flash-preview, no thinking
//   C — trivial/numerous → gemini-3.1-flash-lite, no thinking
//
// `thinkingBudget` here is an INTENT flag, not a literal allowance: the dispatch
// layer (ai-provider.impl.ts) maximizes it per the chosen model's own convention
// (Gemini 2.5 → numeric budget; Gemini 3 → thinkingLevel 'high'), and clears it
// when a fallback lands on a model that can't think. So -1 means "think hard"
// and 0 means "don't"; the exact number is no longer load-bearing.

import type { AICallKind, ModelChoice, ModelConfig } from './model-types';

/** "Think hard" intent — the dispatch layer maps this to each model's max. */
const THINK = -1;
const NO_THINK = 0;

const g = (model: string, thinkingBudget: number): ModelChoice => ({
  provider: 'gemini',
  model,
  thinkingBudget,
});

// The three buckets' starting models.
const HEAVY = 'gemini-flash-latest';
const INTERACTIVE = 'gemini-3-flash-preview';
const TRIVIAL = 'gemini-3.1-flash-lite';

export const DEFAULT_MODEL_CONFIG: Record<AICallKind, ModelChoice> = {
  // --- C: trivial / very numerous (fastest, no thinking) ---
  runDiagnostic: g(TRIVIAL, NO_THINK),
  getContentSuggestions: g(TRIVIAL, NO_THINK),

  // --- B: interactive / numerous (flash, no thinking; must feel instant) ---
  generateSpecs: g(INTERACTIVE, NO_THINK),
  getCoachAdvice: g(INTERACTIVE, NO_THINK),
  // Streaming coach mirrors the coach default — same model, just yielded live.
  streamCoachAdvice: g(INTERACTIVE, NO_THINK),
  generatePersonas: g(INTERACTIVE, NO_THINK),
  // A sprint plan is short and the Brief must feel quick (>200ms rule).
  generateSprintPlan: g(INTERACTIVE, NO_THINK),
  // Live coach turn — must feel instant; streamed token-by-token.
  coachSprintTurn: g(INTERACTIVE, NO_THINK),
  // A single-step breakdown is tiny and must feel instant.
  decomposeSprintStep: g(INTERACTIVE, NO_THINK),

  // --- A: heavy reasoning (top flash, maximum thinking) ---
  estimateDependencies: g(HEAVY, THINK),
  refineSpec: g(HEAVY, THINK),
  analyzeSection: g(HEAVY, THINK),
  refactorAnalysis: g(HEAVY, THINK),
  continueDialogue: g(HEAVY, THINK),
  generateRevisions: g(HEAVY, THINK),
  // Distillation is reasoning-heavy but bounded; same heavy tier.
  generateReverseOutline: g(HEAVY, THINK),
  // A careful per-paragraph analogical rewrite — heavy tier.
  regenerateParagraph: g(HEAVY, THINK),
  // Gist Editor: voice-fidelity is the central risk, so the strongest tier.
  analyzeGist: g(HEAVY, THINK),
  composeGist: g(HEAVY, THINK),
  refreshGistSpan: g(HEAVY, THINK),
  refitGist: g(HEAVY, THINK),
  suggestDirectives: g(HEAVY, THINK),
  // Close exegesis of one source — faithful reconstruction is reasoning-heavy.
  exegeteSource: g(HEAVY, THINK),
  // Heavy reasoning over two whole drafts.
  compareVersions: g(HEAVY, THINK),
  // Spec test — part: move-by-move A/B against the held rubric for one section.
  runSpecTestSection: g(HEAVY, THINK),
  // Spec test — whole: the tF/center-of-gravity verdict. The load-bearing judgment.
  runSpecTestWhole: g(HEAVY, THINK),
  // Atmospheric reading over a whole draft.
  analyzeAtmosphere: g(HEAVY, THINK),
  // Collaborative per-level spec development — a conversational reasoning turn.
  developSpecLevel: g(HEAVY, THINK),
  // Articulation: finding the natural joints is reasoning-heavy structural work.
  segmentSpan: g(HEAVY, THINK),
  // StructuralPart discovery: one whole-document pass reconstructing the moves
  // and their configuration — the heaviest whole-document reasoning.
  discoverStructuralParts: g(HEAVY, THINK),
  // Gestalt whole/part ops — focused reasoning over one section.
  reconstructWhole: g(HEAVY, THINK),
  proposeRecenterings: g(HEAVY, THINK),
  // Local multi-turn tool-using agent — sustained reasoning across turns. The
  // user can repoint this at a local Ollama model in the Local Agent settings.
  runAgent: g(HEAVY, THINK),
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
