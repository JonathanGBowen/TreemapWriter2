// Characterization tests for the Parallel Editor's reverse-outline flow. Pins the
// request (editable system prompt, the indexed paragraph framing) and the 1:1
// alignment contract: one bullet per input block in document order, non-prose
// blocks echoed verbatim, a missed prose block left blank (never a dropped row).

import { describe, expect, it } from 'vitest';
import { generateReverseOutline } from '../ai-provider.reverse-outline';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { GenerateReverseOutlineInput } from '../../ai-provider';

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

const config = { ...DEFAULT_PROMPTS_CONFIG, generateReverseOutlinePrompt: 'RO-SYS' };

const input: GenerateReverseOutlineInput = {
  sectionTitle: 'Sec',
  blocks: [
    { index: 0, text: 'Para zero.', kind: 'prose' },
    { index: 1, text: '## Heading', kind: 'heading' },
  ],
  config,
};

describe('generateReverseOutline', () => {
  it('distils prose, echoes a heading verbatim, and keeps 1:1 alignment', async () => {
    const reqs: LLMRequest[] = [];
    const out = await generateReverseOutline(
      mockClient(['{"bullets":[{"index":0,"sentence":"Distilled."}]}'], reqs),
      'model',
      0,
      input,
    );

    expect(reqs[0].systemInstruction).toBe('RO-SYS');
    expect(reqs[0].prompt).toContain('### SECTION: Sec ###');
    expect(reqs[0].prompt).toContain('[0]');
    expect(reqs[0].prompt).toContain('[1]');

    expect(out).toEqual([
      { index: 0, kind: 'prose', sentence: 'Distilled.' },
      { index: 1, kind: 'heading', sentence: '## Heading' },
    ]);
  });

  it('leaves a missed prose block blank while still echoing the heading', async () => {
    const reqs: LLMRequest[] = [];
    const out = await generateReverseOutline(mockClient(['{"bullets":[]}'], reqs), 'model', 0, input);
    expect(out[0].sentence).toBe('');
    expect(out[1].sentence).toBe('## Heading');
  });
});
