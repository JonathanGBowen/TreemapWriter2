// Gist Editor — Stage A (analysis). Provider-agnostic: it tags each segment with
// its id + heading, calls the injected LLMClient under a structured-output schema,
// and re-aligns the result to the known segment ids. The output is inspectable
// intermediate state (persisted; it powers tooltips + per-span regeneration).
// Split out of ai-provider.impl.ts to keep that file under the line cap.

import { safeJsonParse } from '../../lib/utils';
import { normalizeGistAnalysis } from '../../lib/gist-normalize';
import type { AnalyzeGistInput } from '../ai-provider';
import type { GistAnalysis } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

/** Fidelity dominates; flavour needs only slight latitude (design §8). */
export const GIST_TEMPERATURE = 0.25;

const analysisJsonSchema = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          core_claims: { type: 'array', items: { type: 'string' } },
          move: { type: 'string' },
          anchor_terms: { type: 'array', items: { type: 'string' } },
          force: { type: 'string' },
          transition: { type: 'string' },
          weight: { type: 'number' },
        },
        required: ['id', 'core_claims', 'move', 'anchor_terms', 'force', 'transition', 'weight'],
      },
    },
    thesis: { type: 'string' },
    style: {
      type: 'object',
      properties: {
        person: { type: 'string' },
        register: { type: 'string' },
        cadence: { type: 'string' },
        signature_moves: { type: 'string' },
      },
      required: ['person', 'register', 'cadence', 'signature_moves'],
    },
  },
  required: ['segments', 'thesis', 'style'],
};

const SCHEMA_TEXT = [
  'Return ONLY a JSON object of this shape (no markdown fences):',
  '{ "segments": [ { "id": string, "core_claims": string[], "move": string,',
  '  "anchor_terms": string[], "force": "asserted"|"hedged"|"entertained"|"denied",',
  '  "transition": string, "weight": 1..5 } ],',
  '  "thesis": string,',
  '  "style": { "person": string, "register": string, "cadence": string, "signature_moves": string } }',
  'Use exactly the segment ids given below, one analysis object per segment.',
].join('\n');

const buildUserPrompt = (input: AnalyzeGistInput): string => {
  const body = input.segments
    .map((s) => `[SEG id="${s.id}" heading="${s.heading}"]\n${s.text}`)
    .join('\n\n');
  return ['SCHEMA:', SCHEMA_TEXT, '', `DOCUMENT (title: ${input.documentTitle}):`, body].join('\n');
};

export async function analyzeGist(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: AnalyzeGistInput,
): Promise<GistAnalysis> {
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: input.config.gistAnalysisPrompt,
    json: true,
    responseJsonSchema: analysisJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: GIST_TEMPERATURE,
  });
  // Never throws; fills any segment the model missed with a minimal default so
  // composition always has full coverage.
  return normalizeGistAnalysis(safeJsonParse(text || '', null), input.segments.map((s) => s.id));
}
