// Characterization tests for the "Suggest a directive" flow. Pins the persona-
// templated system instruction (rendered from the registry template), the master-
// document + sources framing, the drop-the-blank normalization, and the
// unparseable → throw contract.

import { describe, expect, it } from 'vitest';
import { suggestDirectives } from '../ai-provider.suggest-directives';
import type { LLMClient, LLMRequest } from '../clients';
import type { SuggestDirectivesInput } from '../../ai-provider';
import type { SourceDocument } from '../../../types';

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

const source: SourceDocument = {
  id: 's1',
  role: 'bibliographic',
  kind: 'Reading',
  label: 'Smith 2020',
  glyph: '§',
  content: 'The cat sat on the mat.',
};

const input: SuggestDirectivesInput = {
  sectionTitle: 'Sec',
  sectionText: 'Body text.',
  sources: [source],
  personaName: 'Advisor',
  personaInstruction: 'Be rigorous.',
};

describe('suggestDirectives', () => {
  it('renders the persona into the system prompt, frames the document + sources, and drops blank entries', async () => {
    const reqs: LLMRequest[] = [];
    const out = await suggestDirectives(
      mockClient(['{"directives":[{"title":"T1","directive":"D1"},{"title":"","directive":""}]}'], reqs),
      'model',
      0,
      input,
    );

    expect(reqs[0].systemInstruction).toContain('Advisor');
    expect(reqs[0].prompt).toContain('### MASTER_DOCUMENT ###');
    expect(reqs[0].prompt).toContain('Body text.');
    expect(reqs[0].prompt).toContain('### SOURCE_DOCUMENTS ###');
    expect(reqs[0].prompt).toContain('Smith 2020');

    // The blank suggestion is dropped; the usable one survives.
    expect(out).toEqual([{ title: 'T1', directive: 'D1' }]);
  });

  it('throws when the response is unparseable', async () => {
    const reqs: LLMRequest[] = [];
    await expect(
      suggestDirectives(mockClient(['not json'], reqs), 'model', 0, input),
    ).rejects.toThrow(/could not be parsed/i);
  });
});
