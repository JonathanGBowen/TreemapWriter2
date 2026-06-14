// Glass Box revision generation, split out of ai-provider.impl.ts to keep that
// file under the line cap (mirrors ai-provider.specs.ts). Provider-agnostic: it
// builds the prompt, calls the injected LLMClient, and validates the response.

import { safeJsonParse } from '../../lib/utils';
import { buildRevisionsRequestText, normalizeRevisions } from '../../lib/revision-helpers';
import type { GenerateRevisionsInput } from '../ai-provider';
import type { RevisionProposal } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

const REVISION_TYPES = [
  'Addition',
  'Replacement',
  'Deletion',
  'Rewording',
  'Citation',
  'Tone Adjustment',
  'Flow Improvement',
  'Assembly',
];

/**
 * Structured-output schema. Gemini is constrained to this exact shape, so the
 * proposals always come back with the right field names — the reliable approach
 * the prototype's bare JSON mode lacked.
 */
const REVISIONS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          revision_type: { type: 'string', enum: REVISION_TYPES },
          original_text: { type: 'string' },
          proposed_text: { type: 'string' },
          rationale: { type: 'string' },
          source_id: { type: 'string' },
          verbatim_source_quote: { type: 'string' },
          confidence_score: { type: 'number' },
        },
        required: [
          'revision_type',
          'original_text',
          'proposed_text',
          'rationale',
          'source_id',
          'verbatim_source_quote',
          'confidence_score',
        ],
      },
    },
  },
  required: ['proposals'],
};

export async function generateRevisions(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: GenerateRevisionsInput,
): Promise<RevisionProposal[]> {
  const prompt = buildRevisionsRequestText({
    prompt: input.config.generateRevisionsPrompt,
    sectionTitle: input.sectionTitle,
    sectionText: input.sectionText,
    directive: input.directive,
    mode: input.mode,
    subMode: input.subMode,
    sources: input.sources,
  });

  const text = await client.generateText({
    model,
    prompt,
    json: true,
    responseJsonSchema: REVISIONS_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  // A valid-but-empty array is "no grounded edit", not a failure; null is junk.
  const proposals = normalizeRevisions(safeJsonParse(text || '', null), {
    sectionLabel: input.sectionTitle,
    fallbackSourceId: input.sources.length === 1 ? input.sources[0].id : undefined,
  });
  if (proposals === null) {
    // Surface the raw response so an unparseable shape is diagnosable in devtools.
    console.warn('[generateRevisions] unparseable model response:', (text || '').slice(0, 2000));
    throw new Error('Revision proposals could not be parsed.');
  }
  if (proposals.length === 0) {
    // Distinguish "model genuinely returned none" from "every item was filtered".
    console.warn('[generateRevisions] no usable proposals. Raw response:', (text || '').slice(0, 2000));
  }
  return proposals;
}
