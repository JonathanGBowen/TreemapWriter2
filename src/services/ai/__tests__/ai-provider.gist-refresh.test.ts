// Characterization tests for the single-span Gist refresh flow (Prompt C). Pins the
// request (locked system prompt, fidelity temperature, the budget + the immutable
// neighbour handoff) and the unusable-response → null contract.

import { describe, expect, it } from 'vitest';
import { refreshGistSpan } from '../ai-provider.gist-refresh';
import { GIST_TEMPERATURE } from '../ai-provider.gist-analysis';
import { getPromptText } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { RefreshGistSpanInput } from '../../ai-provider';
import type { GistSegmentAnalysis } from '../../../types';

const mockClient = (responses: string[], reqs: LLMRequest[]): LLMClient => {
  let i = 0;
  return {
    generateText: async (req) => {
      reqs.push(req);
      return responses[i++] ?? '{}';
    },
    streamText: async function* () {},
  };
};

const segmentAnalysis: GistSegmentAnalysis = {
  id: 'f1',
  core_claims: ['c'],
  move: 'assert',
  anchor_terms: ['a'],
  force: 'asserted',
  transition: '',
  weight: 2,
};

const input: RefreshGistSpanInput = {
  segmentId: 'f1',
  segmentSource: 'the source text',
  analysis: segmentAnalysis,
  budget: 10,
  prevSpan: 'prev',
  nextSpan: 'next',
};

describe('refreshGistSpan', () => {
  it('returns the new span and frames the budget + id under the locked prompt', async () => {
    const reqs: LLMRequest[] = [];
    const out = await refreshGistSpan(
      mockClient(['{"id":"f1","text":"fresh span"}'], reqs),
      'model',
      0,
      input,
    );

    expect(reqs[0].systemInstruction).toBe(getPromptText('gistRefreshSpanPrompt'));
    expect(reqs[0].temperature).toBe(GIST_TEMPERATURE);
    expect(reqs[0].prompt).toContain('BUDGET: 10 words');
    expect(reqs[0].prompt).toContain('"id": "f1"');
    expect(out).toEqual({ id: 'f1', text: 'fresh span' });
  });

  it('returns null when the span has no usable text', async () => {
    const reqs: LLMRequest[] = [];
    const out = await refreshGistSpan(mockClient(['{}'], reqs), 'model', 0, input);
    expect(out).toBeNull();
  });
});
