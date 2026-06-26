// Characterization tests for the Gist re-fit flow (Prompt D). Pins the request
// (locked system prompt, fidelity temperature, the new cap + anchor-terms table)
// and the {fits:false} → null contract the caller relies on to fall back a grain.

import { describe, expect, it } from 'vitest';
import { refitGist } from '../ai-provider.gist-refit';
import { GIST_TEMPERATURE } from '../ai-provider.gist-analysis';
import { getPromptText } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { RefitGistInput } from '../../ai-provider';

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

const input: RefitGistInput = {
  grain: [{ id: 'f1', text: 'a long span of text' }],
  anchorTermsBySpan: { f1: ['term'] },
  newCap: 5,
};

describe('refitGist', () => {
  it('returns the tighter grain and sends the cap + anchor table under the locked prompt', async () => {
    const reqs: LLMRequest[] = [];
    const out = await refitGist(
      mockClient(['{"spans":[{"id":"f1","text":"tight"}]}'], reqs),
      'model',
      0,
      input,
    );

    expect(reqs[0].systemInstruction).toBe(getPromptText('gistRefitPrompt'));
    expect(reqs[0].temperature).toBe(GIST_TEMPERATURE);
    expect(reqs[0].prompt).toContain('NEW HARD CAP: 5');
    expect(reqs[0].prompt).toContain('f1: term');
    expect(out).toEqual([{ id: 'f1', text: 'tight' }]);
  });

  it('returns null when the model reports it cannot fit', async () => {
    const reqs: LLMRequest[] = [];
    const out = await refitGist(mockClient(['{"fits":false}'], reqs), 'model', 0, input);
    expect(out).toBeNull();
  });
});
