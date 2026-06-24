// Gist Editor — single-span refresh (Prompt C). Regenerates exactly one stale span
// in place, taking the handoff from its immutable neighbours. Returns the new span
// or null (the caller leaves the old span standing and surfaces a toast).

import { safeJsonParse } from '../../lib/utils';
import { normalizeGistSpan } from '../../lib/gist-normalize';
import { getPromptText } from '../prompts';
import type { RefreshGistSpanInput } from '../ai-provider';
import type { GistSpan } from '../../types';
import type { LLMClient } from './clients';
import { GIST_TEMPERATURE } from './ai-provider.gist-analysis';

const MAX_OUTPUT_TOKENS = 4000;

const spanJsonSchema = {
  type: 'object',
  properties: { id: { type: 'string' }, text: { type: 'string' } },
  required: ['id', 'text'],
};

const buildUserPrompt = (input: RefreshGistSpanInput): string =>
  [
    `PREVIOUS SPAN (immutable): ${input.prevSpan?.trim() || 'NONE'}`,
    `NEXT SPAN (immutable): ${input.nextSpan?.trim() || 'NONE'}`,
    `BUDGET: ${input.budget} words (±15%).`,
    '',
    'SEGMENT ANALYSIS:',
    JSON.stringify(input.analysis),
    '',
    'SEGMENT SOURCE:',
    input.segmentSource,
    '',
    `Return ONLY JSON: { "id": "${input.segmentId}", "text": "..." }.`,
  ].join('\n');

export async function refreshGistSpan(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: RefreshGistSpanInput,
): Promise<GistSpan | null> {
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: getPromptText('gistRefreshSpanPrompt'),
    json: true,
    responseJsonSchema: spanJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: GIST_TEMPERATURE,
  });
  return normalizeGistSpan(safeJsonParse(text || '', null));
}
