// Glass Box revision generation, split out of ai-provider.impl.ts to keep that
// file under the line cap (mirrors ai-provider.specs.ts). Provider-agnostic: it
// builds the prompt, calls the injected LLMClient, and validates the response.

import { safeJsonParse } from '../../lib/utils';
import { buildRevisionsRequestText, normalizeRevisions } from '../../lib/revision-helpers';
import type { GenerateRevisionsInput } from '../ai-provider';
import type { RevisionProposal } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

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
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  // A valid-but-empty array is "no grounded edit", not a failure; null is junk.
  const proposals = normalizeRevisions(safeJsonParse(text || '', null), {
    sectionLabel: input.sectionTitle,
    fallbackSourceId: input.sources.length === 1 ? input.sources[0].id : undefined,
  });
  if (proposals === null) throw new Error('Revision proposals could not be parsed.');
  return proposals;
}
