// Gist Editor — Stage B (composition). Writes the three grains (g0 / coarse / fine)
// from the Stage-A analysis under the measured word budgets. The validate-and-retry
// loop lives in the workspace hook (it owns the budgets + ids + fit measurement);
// this flow is a single call, so the hook can call it twice with `retryReason` set.

import { safeJsonParse } from '../../lib/utils';
import { normalizeGistComposition } from '../../lib/gist-normalize';
import type { ComposeGistInput } from '../ai-provider';
import type { GistComposition } from '../../types';
import type { LLMClient } from './clients';
import { GIST_TEMPERATURE } from './ai-provider.gist-analysis';

const MAX_OUTPUT_TOKENS = 16000;

const compositionJsonSchema = {
  type: 'object',
  properties: {
    g0: { type: 'string' },
    coarse: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] },
    },
    fine: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] },
    },
  },
  required: ['g0', 'coarse', 'fine'],
};

const SCHEMA_TEXT =
  'Return ONLY this JSON (no fences): { "g0": string, "coarse": [{ "id": string, "text": string }], "fine": [{ "id": string, "text": string }] }.';

const buildUserPrompt = (input: ComposeGistInput): string => {
  const perSpan = input.fineIds
    .map((id) => `${id}: ${input.perSpanBudgets[id] ?? 8}`)
    .join('; ');
  const parts = [
    'SCHEMA:',
    SCHEMA_TEXT,
    '',
    'ANALYSIS:',
    JSON.stringify(input.analysis),
    '',
    'BUDGETS:',
    `g0 ≤ ${input.budgets.g0} words.`,
    `coarse: total cap ${input.budgets.coarse}; spans in document order for sections ${input.coarseIds.join(', ')}.`,
    `fine: total cap ${input.budgets.fine}; per-span targets: ${perSpan}.`,
    '',
    'HOUSE EXEMPLAR (when present, match its manner over the generic exemplar):',
    input.houseExemplar?.trim() || 'none',
  ];
  if (input.retryReason?.trim()) {
    parts.push('', `CORRECTION — the previous attempt failed these gates; fix them and keep every rule: ${input.retryReason.trim()}`);
  }
  return parts.join('\n');
};

export async function composeGist(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: ComposeGistInput,
): Promise<GistComposition> {
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: input.config.gistCompositionPrompt,
    json: true,
    responseJsonSchema: compositionJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: GIST_TEMPERATURE,
  });
  // Missing spans come back empty (the validation gate flags them) — never dropped.
  return normalizeGistComposition(safeJsonParse(text || '', null), { coarse: input.coarseIds, fine: input.fineIds });
}
