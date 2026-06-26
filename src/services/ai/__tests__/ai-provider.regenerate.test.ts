// Characterization tests for the Parallel Editor's paragraph-rewrite flow. Pins the
// request (editable voice prompt, the analogy framing) and two contracts: the
// returned original_text is forced to the caller's input (so the splice is exact
// even if the model paraphrased it), and an unusable response yields null rather
// than silently blanking the paragraph.

import { describe, expect, it } from 'vitest';
import { regenerateParagraph } from '../ai-provider.regenerate';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { RegenerateParagraphInput } from '../../ai-provider';

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

const config = { ...DEFAULT_PROMPTS_CONFIG, regenerateParagraphPrompt: 'RP-SYS' };

const baseInput = (over: Partial<RegenerateParagraphInput> = {}): RegenerateParagraphInput => ({
  originalParagraph: 'Old para.',
  faithfulBullet: 'Old.',
  editedBullet: 'New idea.',
  voiceInstruction: 'plain voice',
  sectionTitle: 'Sec',
  config,
  ...over,
});

describe('regenerateParagraph', () => {
  it('sends the analogy framing and pins original_text to the caller input', async () => {
    const reqs: LLMRequest[] = [];
    const out = await regenerateParagraph(
      // The model "echoes" a paraphrase of the original; the flow must ignore it.
      mockClient(['{"original_text":"model paraphrase","proposed_text":"Rewritten para."}'], reqs),
      'model',
      0,
      baseInput(),
    );

    expect(reqs[0].systemInstruction).toBe('RP-SYS');
    expect(reqs[0].prompt).toContain('### ORIGINAL_PARAGRAPH ###');
    expect(reqs[0].prompt).toContain('Old para.');
    expect(reqs[0].prompt).toContain('### EDITED_BULLET ###');
    expect(reqs[0].prompt).toContain('New idea.');
    expect(reqs[0].prompt).toContain('plain voice');

    expect(out).toEqual({ original_text: 'Old para.', proposed_text: 'Rewritten para.' });
  });

  it('frames the insertion case and returns an empty original_text', async () => {
    const reqs: LLMRequest[] = [];
    const out = await regenerateParagraph(
      mockClient(['{"proposed_text":"A new paragraph."}'], reqs),
      'model',
      0,
      baseInput({ originalParagraph: '', faithfulBullet: '' }),
    );
    expect(reqs[0].prompt).toContain('INSERTION');
    expect(out).toEqual({ original_text: '', proposed_text: 'A new paragraph.' });
  });

  it('returns null when there is no usable proposed_text', async () => {
    const reqs: LLMRequest[] = [];
    const out = await regenerateParagraph(mockClient(['{}'], reqs), 'model', 0, baseInput());
    expect(out).toBeNull();
  });
});
