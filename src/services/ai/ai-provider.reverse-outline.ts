// Parallel Editor flow #1 — reverse-outline generation. Provider-agnostic: it
// emits the paragraphs pre-numbered, calls the injected LLMClient under a
// structured-output schema, and re-aligns the result 1:1 to the input blocks.
// Split out of ai-provider.impl.ts to keep that file under the line cap (mirrors
// ai-provider.revisions.ts).

import { safeJsonParse } from '../../lib/utils';
import { normalizeReverseOutline } from '../../lib/parallel-helpers';
import type { GenerateReverseOutlineInput } from '../ai-provider';
import type { ReverseOutlineBullet } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

/**
 * Structured-output schema. Gemini is pinned to this exact shape so the bullets
 * always come back with `index` + `sentence` — the reliable path the prototype's
 * bare JSON mode lacked. The normalizer re-aligns by `index` and fills any gap, so
 * a dropped or misnumbered bullet can never break the 1:1 column alignment.
 */
const reverseOutlineJsonSchema = {
  type: 'object',
  properties: {
    bullets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          sentence: { type: 'string' },
        },
        required: ['index', 'sentence'],
      },
    },
  },
  required: ['bullets'],
};

const KIND_HINT: Record<string, string> = {
  prose: 'prose',
  heading: 'heading — echo verbatim',
  list: 'list — echo verbatim',
  code: 'code — echo verbatim',
};

const buildUserPrompt = (input: GenerateReverseOutlineInput): string => {
  const body = input.blocks
    .map((b) => `[${b.index}] (${KIND_HINT[b.kind] ?? b.kind})\n${b.text}`)
    .join('\n\n');
  return [
    `### SECTION: ${input.sectionTitle} ###`,
    '',
    '### PARAGRAPHS ###',
    body,
    '',
    'Return ONLY the JSON object defined by the schema (a "bullets" array). Produce exactly one bullet per paragraph index above, in order: a single faithful one-sentence DISTILLATION for each prose paragraph, and the block text echoed verbatim for any heading/list/code block.',
  ].join('\n');
};

export async function generateReverseOutline(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: GenerateReverseOutlineInput,
): Promise<ReverseOutlineBullet[]> {
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: input.config.generateReverseOutlinePrompt,
    json: true,
    responseJsonSchema: reverseOutlineJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  // The normalizer never throws and always returns one bullet per input block:
  // non-prose echoed, a missed prose block left blank for the UI to flag.
  return normalizeReverseOutline(safeJsonParse(text || '', null), input.blocks);
}
