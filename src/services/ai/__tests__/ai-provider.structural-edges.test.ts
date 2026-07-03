import { describe, expect, it } from 'vitest';
import {
  buildUserPrompt,
  discoverStructuralEdges,
  normalizeStructuralEdges,
} from '../ai-provider.structural-edges';
import { edgeId } from '../../../lib/structural-graph-helpers';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { DiscoverStructuralEdgesInput } from '../../ai-provider';

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

const parts = [
  { id: 'pA', kind: 'motivation', claim: 'The problem is real.' },
  { id: 'pB', kind: 'claim', claim: 'The thesis follows.' },
  { id: 'pC', kind: 'objection', claim: 'But one might object.' },
];

const inputFor = (over?: Partial<DiscoverStructuralEdgesInput>): DiscoverStructuralEdgesInput => ({
  parts,
  documentTitle: 'Test Doc',
  config: DEFAULT_PROMPTS_CONFIG,
  ...over,
});

describe('buildUserPrompt', () => {
  it('numbers the parts by array position and includes the schema + title', () => {
    const p = buildUserPrompt(inputFor());
    expect(p).toContain('SCHEMA:');
    expect(p).toContain('Test Doc');
    expect(p).toContain('The problem is real.');
  });
});

describe('normalizeStructuralEdges', () => {
  it('maps part indices to ids and stamps discovered/proposed', () => {
    const raw = { edges: [{ fromPart: 0, toPart: 1, kind: 'grounds', confidence: 0.9, rationale: 'A grounds B' }] };
    const out = normalizeStructuralEdges(raw, parts);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: edgeId('grounds', 'pA', 'pB'),
      kind: 'grounds',
      fromPartId: 'pA',
      toPartId: 'pB',
      origin: 'discovered',
      status: 'proposed',
    });
    expect(out[0].confidence).toBeCloseTo(0.9);
  });

  it('drops out-of-range endpoints, self-edges, and unknown kinds', () => {
    const raw = {
      edges: [
        { fromPart: 0, toPart: 9, kind: 'grounds', confidence: 1, rationale: '' }, // out of range
        { fromPart: 1, toPart: 1, kind: 'grounds', confidence: 1, rationale: '' }, // self
        { fromPart: 0, toPart: 2, kind: 'supports', confidence: 1, rationale: '' }, // bad kind
      ],
    };
    expect(normalizeStructuralEdges(raw, parts)).toEqual([]);
  });

  it('collapses a symmetric edge stated in both directions to one', () => {
    const raw = {
      edges: [
        { fromPart: 0, toPart: 1, kind: 'requires', confidence: 1, rationale: '' },
        { fromPart: 1, toPart: 0, kind: 'requires', confidence: 1, rationale: '' },
      ],
    };
    const out = normalizeStructuralEdges(raw, parts);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('requires');
  });

  it('returns [] on junk', () => {
    expect(normalizeStructuralEdges(null, parts)).toEqual([]);
    expect(normalizeStructuralEdges({ nope: 1 }, parts)).toEqual([]);
    expect(normalizeStructuralEdges({ edges: 'x' }, parts)).toEqual([]);
  });
});

describe('discoverStructuralEdges', () => {
  it('short-circuits to [] when there are fewer than two parts (no call made)', async () => {
    const reqs: LLMRequest[] = [];
    const client = mockClient(['{"edges":[]}'], reqs);
    const out = await discoverStructuralEdges(client, 'm', undefined, inputFor({ parts: [parts[0]] }));
    expect(out).toEqual([]);
    expect(reqs).toHaveLength(0);
  });

  it('calls the client with the edges prompt and normalizes the response', async () => {
    const reqs: LLMRequest[] = [];
    const client = mockClient(['{"edges":[{"fromPart":0,"toPart":2,"kind":"answers","confidence":0.8,"rationale":"B answers C"}]}'], reqs);
    const out = await discoverStructuralEdges(client, 'm', undefined, inputFor());
    expect(reqs).toHaveLength(1);
    expect(reqs[0].json).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('answers');
    expect(out[0].id).toBe(edgeId('answers', 'pA', 'pC'));
  });
});
