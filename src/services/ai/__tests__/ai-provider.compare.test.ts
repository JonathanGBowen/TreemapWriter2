// Characterization tests for the Version Compare flow. Pins how it composes the
// prompt (the draft-mode overlay prepended by default, the editable base prompt
// baked in — not sent as a separate systemInstruction — and both labelled drafts)
// and the unparseable → throw contract. normalizeComparison's tolerance is covered
// in lib/__tests__/compareHelpers.test.ts.

import { describe, expect, it } from 'vitest';
import { compareVersions } from '../ai-provider.compare';
import { DEFAULT_PROMPTS_CONFIG, getPromptText } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { CompareVersionsInput } from '../../ai-provider';

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

const config = { ...DEFAULT_PROMPTS_CONFIG, compareVersionsPrompt: 'CMP-SYS' };

const baseInput = (over: Partial<CompareVersionsInput> = {}): CompareVersionsInput => ({
  labelA: 'v1',
  labelB: 'v2',
  markdownA: '# A\nAlpha text.',
  markdownB: '# A\nBeta text.',
  config,
  ...over,
});

const validResponse = JSON.stringify({
  direction: 'improved',
  verdict: 'B is sharper.',
  conceptualDrift: 'minimal',
  improvements: [],
  losses: [],
  moveChanges: [],
  sectionNotes: [],
});

describe('compareVersions', () => {
  it('bakes the base prompt + draft overlay into the prompt and feeds both labelled drafts', async () => {
    const reqs: LLMRequest[] = [];
    const result = await compareVersions(mockClient([validResponse], reqs), 'model', 0, baseInput());

    // The compare flow bakes its instruction into the prompt — no separate system msg.
    expect(reqs[0].systemInstruction).toBeUndefined();
    expect(reqs[0].prompt).toContain('CMP-SYS');
    expect(reqs[0].prompt).toContain(getPromptText('compareModeDraft'));
    expect(reqs[0].prompt).toContain('### VERSION A — v1 (earlier) ###');
    expect(reqs[0].prompt).toContain('Alpha text.');
    expect(reqs[0].prompt).toContain('### VERSION B — v2 (later) ###');
    expect(reqs[0].prompt).toContain('Beta text.');

    expect(result.direction).toBe('improved');
    expect(result.verdict).toBe('B is sharper.');
  });

  it('omits the draft overlay in final mode', async () => {
    const reqs: LLMRequest[] = [];
    await compareVersions(mockClient([validResponse], reqs), 'model', 0, baseInput({ mode: 'final' }));
    expect(reqs[0].prompt).not.toContain(getPromptText('compareModeDraft'));
  });

  it('throws when the response carries no usable comparison', async () => {
    const reqs: LLMRequest[] = [];
    await expect(
      compareVersions(mockClient(['{}'], reqs), 'model', 0, baseInput()),
    ).rejects.toThrow(/could not be parsed/i);
  });
});
