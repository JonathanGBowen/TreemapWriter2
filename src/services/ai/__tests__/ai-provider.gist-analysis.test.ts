// Characterization tests for the Gist Stage-A analysis flow. Pins the request it
// sends (the editable system prompt, the fidelity temperature, the [SEG ...] tag
// framing) and the contract its output guarantees callers: exactly one analysis
// per input segment id (re-aligned, never dropped), with the move/force/weight
// coercion the composition stage relies on. The normalizer's own field handling is
// covered in lib/__tests__/gist-normalize.test.ts.

import { describe, expect, it } from 'vitest';
import { analyzeGist, GIST_TEMPERATURE } from '../ai-provider.gist-analysis';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { AnalyzeGistInput } from '../../ai-provider';

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

const config = { ...DEFAULT_PROMPTS_CONFIG, gistAnalysisPrompt: 'GIST-A-SYS' };

const input: AnalyzeGistInput = {
  documentTitle: 'Doc',
  segments: [
    { id: 's1', heading: 'H1', text: 'Body one.' },
    { id: 's2', heading: 'H2', text: 'Body two.' },
  ],
  config,
};

describe('analyzeGist', () => {
  it('sends the editable system prompt, fidelity temperature, and SEG-tagged segments', async () => {
    const reqs: LLMRequest[] = [];
    const responses = [
      JSON.stringify({
        segments: [
          {
            id: 's1',
            core_claims: ['c'],
            move: 'argue',
            anchor_terms: ['x'],
            force: 'hedged',
            transition: 'then',
            weight: 4,
          },
        ],
        thesis: 'T',
        style: { person: 'third person', register: 'formal', cadence: 'long', signature_moves: 'sig' },
      }),
    ];

    const out = await analyzeGist(mockClient(responses, reqs), 'model', 0, input);

    expect(reqs[0].systemInstruction).toBe('GIST-A-SYS');
    expect(reqs[0].temperature).toBe(GIST_TEMPERATURE);
    expect(reqs[0].prompt).toContain('[SEG id="s1" heading="H1"]');
    expect(reqs[0].prompt).toContain('Body one.');
    expect(reqs[0].prompt).toContain('title: Doc');

    // One analysis per input id, in order. The covered segment keeps the model's
    // values; the missed one is filled with the minimal default (never dropped).
    expect(out.segments.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(out.segments[0]).toMatchObject({
      id: 's1',
      move: 'argue',
      force: 'hedged',
      weight: 4,
      core_claims: ['c'],
      anchor_terms: ['x'],
    });
    expect(out.segments[1]).toMatchObject({
      id: 's2',
      move: 'assert',
      force: 'asserted',
      weight: 2,
      core_claims: [],
    });
    expect(out.thesis).toBe('T');
    expect(out.style.person).toBe('third person');
  });

  it('coerces an out-of-vocabulary move/force and clamps the weight', async () => {
    const reqs: LLMRequest[] = [];
    const responses = [
      JSON.stringify({
        segments: [
          { id: 's1', core_claims: [], move: 'nonsense', anchor_terms: [], force: 'bogus', transition: '', weight: 99 },
          { id: 's2', core_claims: [], move: 'assert', anchor_terms: [], force: 'asserted', transition: '', weight: 3 },
        ],
        thesis: 'T',
        style: { person: 'p', register: 'r', cadence: 'c', signature_moves: 's' },
      }),
    ];

    const out = await analyzeGist(mockClient(responses, reqs), 'model', 0, input);
    expect(out.segments[0].move).toBe('assert');
    expect(out.segments[0].force).toBe('asserted');
    expect(out.segments[0].weight).toBe(5);
  });
});
