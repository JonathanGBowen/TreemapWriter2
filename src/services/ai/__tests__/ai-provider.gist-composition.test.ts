// Characterization tests for the Gist Stage-B composition flow. Pins the request
// (editable system prompt, fidelity temperature, budgets + per-span targets in the
// prompt, the one corrective-retry CORRECTION block) and the output contract: a
// missing span comes back as empty text rather than being silently dropped, so the
// caller's validation gate can flag it.

import { describe, expect, it } from 'vitest';
import { composeGist } from '../ai-provider.gist-composition';
import { GIST_TEMPERATURE } from '../ai-provider.gist-analysis';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { ComposeGistInput } from '../../ai-provider';
import type { GistAnalysis } from '../../../types';

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

const config = { ...DEFAULT_PROMPTS_CONFIG, gistCompositionPrompt: 'GIST-C-SYS' };

const analysis: GistAnalysis = {
  segments: [],
  thesis: 'T',
  style: { person: 'first person', register: 'plain', cadence: 'mixed', signature_moves: '' },
};

const baseInput = (over: Partial<ComposeGistInput> = {}): ComposeGistInput => ({
  analysis,
  coarseIds: ['c1'],
  fineIds: ['f1', 'f2'],
  budgets: { total: 100, target: 90, g0: 10, coarse: 40, fine: 90 },
  perSpanBudgets: { f1: 8, f2: 10 },
  config,
  ...over,
});

describe('composeGist', () => {
  it('sends budgets + per-span targets and re-aligns spans, leaving a missing one empty', async () => {
    const reqs: LLMRequest[] = [];
    const responses = [
      JSON.stringify({ g0: 'thesis gist', coarse: [{ id: 'c1', text: 'C' }], fine: [{ id: 'f1', text: 'F1' }] }),
    ];

    const out = await composeGist(mockClient(responses, reqs), 'model', 0, baseInput());

    expect(reqs[0].systemInstruction).toBe('GIST-C-SYS');
    expect(reqs[0].temperature).toBe(GIST_TEMPERATURE);
    expect(reqs[0].prompt).toContain('BUDGETS:');
    expect(reqs[0].prompt).toContain('f1: 8');
    expect(reqs[0].prompt).toContain('f2: 10');
    expect(reqs[0].prompt).toContain('c1');

    expect(out.g0).toBe('thesis gist');
    expect(out.coarse).toEqual([{ id: 'c1', text: 'C' }]);
    // f2 was missing → empty span (flagged by the gate), not dropped.
    expect(out.fine).toEqual([{ id: 'f1', text: 'F1' }, { id: 'f2', text: '' }]);
  });

  it('appends the CORRECTION block on a retry', async () => {
    const reqs: LLMRequest[] = [];
    await composeGist(mockClient(['{}'], reqs), 'model', 0, baseInput({ retryReason: 'too long' }));
    expect(reqs[0].prompt).toContain('CORRECTION');
    expect(reqs[0].prompt).toContain('too long');
  });
});
