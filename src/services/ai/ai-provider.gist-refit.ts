// Gist Editor — re-fit compression (Prompt D). Compresses a grain to a tighter cap
// WITHOUT returning to source (deletion before tightening; claims + anchor terms
// survive). Returns the tighter grain, or null when the model emits { "fits": false }
// so the caller falls back to a coarser grain. No structured schema: the {fits:false}
// branch is a union the tolerant normalizer handles instead.

import { safeJsonParse } from '../../lib/utils';
import { normalizeGistRefit } from '../../lib/gist-normalize';
import { getPromptText } from '../prompts';
import type { RefitGistInput } from '../ai-provider';
import type { GistSpan } from '../../types';
import type { LLMClient } from './clients';
import { GIST_TEMPERATURE } from './ai-provider.gist-analysis';

const MAX_OUTPUT_TOKENS = 8000;

const buildUserPrompt = (input: RefitGistInput): string => {
  const anchorTable = input.grain
    .map((s) => `${s.id}: ${(input.anchorTermsBySpan[s.id] ?? []).join(', ') || '(none)'}`)
    .join('\n');
  return [
    `NEW HARD CAP: ${input.newCap} words total.`,
    'CURRENT GRAIN:',
    JSON.stringify(input.grain),
    'ANCHOR TERMS BY SPAN (must survive):',
    anchorTable,
  ].join('\n');
};

export async function refitGist(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: RefitGistInput,
): Promise<GistSpan[] | null> {
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: getPromptText('gistRefitPrompt'),
    json: true,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: GIST_TEMPERATURE,
  });
  // null on {fits:false} or an unusable response → caller drops a grain.
  return normalizeGistRefit(safeJsonParse(text || '', null), input.grain.map((s) => s.id));
}
