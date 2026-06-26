// Characterization tests for the spec-anchored A/B whole-test flows. Pins how each
// bakes its prompt (the draft overlay prepended by default; the editable base baked
// into the prompt, not a separate systemInstruction; rubric + both versions / the
// skeleton + mesh delta), the deterministic delta derivation, and the unparseable →
// null contract.

import { describe, expect, it } from 'vitest';
import { runSpecTestSection, runSpecTestWhole, __test } from '../ai-provider.spec-test';
import { DEFAULT_PROMPTS_CONFIG, getPromptText } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { SpecTestSectionInput, SpecTestWholeInput } from '../../ai-provider';

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

const config = { ...DEFAULT_PROMPTS_CONFIG, specTestPrompt: 'PART-SYS', specTestWholePrompt: 'WHOLE-SYS' };

const sectionInput = (over: Partial<SpecTestSectionInput> = {}): SpecTestSectionInput => ({
  sectionTitle: 'Intro',
  spec: {
    function: 'argue',
    mainClaim: 'The held claim.',
    requiredMoves: [{ id: 'move-0', description: 'State the claim' }],
    incomingContext: [],
    outgoingCommitments: [],
  },
  structuralSurround: 'SURROUND-BLOCK',
  proseA: 'Alpha text.',
  proseB: 'Beta text.',
  config,
  ...over,
});

const validSection = JSON.stringify({
  moveDeltas: [
    {
      moveId: 'move-0',
      moveDescription: 'State the claim',
      statusA: 'missing',
      statusB: 'present',
      advanceA: 'recapitulative',
      advanceB: 'productive',
      receipts: [{ quote: 'Beta text.', side: 'b' }],
    },
  ],
  wholeSignature: { a: 'partial', b: 'aligned' },
  truth: 'whole-true',
  direction: 'improved',
  summary: 'B now states the claim.',
});

describe('runSpecTestSection', () => {
  it('bakes base + draft overlay + the held rubric + both versions into the prompt', async () => {
    const reqs: LLMRequest[] = [];
    const result = await runSpecTestSection(mockClient([validSection], reqs), 'model', 0, sectionInput());

    expect(reqs[0].systemInstruction).toBeUndefined();
    expect(reqs[0].prompt).toContain('PART-SYS');
    expect(reqs[0].prompt).toContain(getPromptText('specTestModeDraft'));
    expect(reqs[0].prompt).toContain('SURROUND-BLOCK');
    expect(reqs[0].prompt).toContain('State the claim');
    expect(reqs[0].prompt).toContain('### VERSION A — "Intro" (earlier) ###');
    expect(reqs[0].prompt).toContain('Alpha text.');
    expect(reqs[0].prompt).toContain('### VERSION B — "Intro" (later) ###');
    expect(reqs[0].prompt).toContain('Beta text.');

    // A missing→present move is a deterministic 'gained' (not taken from the model).
    expect(result?.moveDeltas[0].delta).toBe('gained');
    expect(result?.truth).toBe('whole-true');
    expect(result?.wholeSignature).toEqual({ a: 'partial', b: 'aligned' });
  });

  it('omits the draft overlay in final mode', async () => {
    const reqs: LLMRequest[] = [];
    await runSpecTestSection(mockClient([validSection], reqs), 'model', 0, sectionInput({ mode: 'final' }));
    expect(reqs[0].prompt).not.toContain(getPromptText('specTestModeDraft'));
  });

  it('returns null when the response carries no usable section result', async () => {
    const reqs: LLMRequest[] = [];
    const result = await runSpecTestSection(mockClient(['{}'], reqs), 'model', 0, sectionInput());
    expect(result).toBeNull();
  });
});

const wholeInput = (over: Partial<SpecTestWholeInput> = {}): SpecTestWholeInput => ({
  documentClaim: 'DOC-CLAIM',
  skeletonA: 'SKELETON-A',
  skeletonB: 'SKELETON-B',
  changedProse: 'CHANGED-PROSE',
  meshDeltaText: 'MESH-DELTA',
  config,
  ...over,
});

const validWhole = JSON.stringify({
  truth: 'tF',
  direction: 'regressed',
  centerOfGravity: 'The weight shifted off the thesis.',
  verdict: 'Each part read better; the whole paid for it.',
  recenteringVector: 'Restore the join to chapter 4.',
});

describe('runSpecTestWhole', () => {
  it('bakes base + the role-skeletons + the mesh delta into the prompt', async () => {
    const reqs: LLMRequest[] = [];
    const result = await runSpecTestWhole(mockClient([validWhole], reqs), 'model', 0, wholeInput());

    expect(reqs[0].prompt).toContain('WHOLE-SYS');
    expect(reqs[0].prompt).toContain('DOC-CLAIM');
    expect(reqs[0].prompt).toContain('SKELETON-A');
    expect(reqs[0].prompt).toContain('SKELETON-B');
    expect(reqs[0].prompt).toContain('MESH-DELTA');

    expect(result?.truth).toBe('tF');
    expect(result?.recenteringVector).toBe('Restore the join to chapter 4.');
  });

  it('returns null when the response has no verdict', async () => {
    const reqs: LLMRequest[] = [];
    const result = await runSpecTestWhole(mockClient(['{}'], reqs), 'model', 0, wholeInput());
    expect(result).toBeNull();
  });
});

describe('deriveDelta (deterministic, not model-supplied)', () => {
  const { deriveDelta } = __test;
  it('ranks status gains and losses', () => {
    expect(deriveDelta('missing', 'present')).toBe('gained');
    expect(deriveDelta('present', 'missing')).toBe('regressed');
    expect(deriveDelta('partial', 'present')).toBe('gained');
  });
  it('flags a present move that fell from productive to recapitulative as deflated', () => {
    expect(deriveDelta('present', 'present', 'productive', 'recapitulative')).toBe('deflated');
    expect(deriveDelta('present', 'present', 'productive', 'productive')).toBe('held');
  });
});
