import { describe, expect, it } from 'vitest';
import {
  buildUserPrompt,
  normalizeStructuralParts,
  discoverStructuralParts,
} from '../ai-provider.structural-parts';
import { anchorFor } from '../../../lib/paragraph-helpers';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { DiscoverStructuralPartsInput } from '../../ai-provider';

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

const blocks = [
  { index: 0, text: 'Alpha opens the motivation for the study.', kind: 'prose' as const },
  { index: 1, text: 'Beta develops the central claim at length.', kind: 'prose' as const },
  { index: 2, text: 'Gamma raises an objection and answers it.', kind: 'prose' as const },
];

const inputFor = (over?: Partial<DiscoverStructuralPartsInput>): DiscoverStructuralPartsInput => ({
  blocks,
  documentTitle: 'Test Doc',
  config: DEFAULT_PROMPTS_CONFIG,
  ...over,
});

describe('buildUserPrompt', () => {
  it('numbers the blocks by array position and includes the schema + title', () => {
    const p = buildUserPrompt(inputFor());
    expect(p).toContain('SCHEMA:');
    expect(p).toContain('Test Doc');
    expect(p).toContain('"index": 0');
    expect(p).toContain('"index": 2');
    expect(p).toContain('Alpha opens');
  });
});

describe('normalizeStructuralParts', () => {
  it('anchors valid parts by block text, clamps confidence, leaves sectionIds empty', () => {
    const raw = { parts: [{ startBlock: 0, endBlock: 1, kind: 'motivation', claim: 'It motivates.', confidence: 2, rationale: 'joint' }] };
    const parts = normalizeStructuralParts(raw, blocks);
    expect(parts).toHaveLength(1);
    expect(parts[0].startAnchor).toBe(anchorFor(blocks[0].text));
    expect(parts[0].endAnchor).toBe(anchorFor(blocks[1].text));
    expect(parts[0].confidence).toBe(1); // clamped into 0..1
    expect(parts[0].sectionIds).toEqual([]); // mapped later, never by the model
    expect(parts[0].kind).toBe('motivation');
  });

  it('drops out-of-range and reversed-index parts (mirrors parseSegmentResponse)', () => {
    const raw = {
      parts: [
        { startBlock: 0, endBlock: 9, kind: 'k', claim: 'c', confidence: 1, rationale: '' }, // end out of range
        { startBlock: 5, endBlock: 6, kind: 'k', claim: 'c', confidence: 1, rationale: '' }, // start out of range
        { startBlock: 2, endBlock: 1, kind: 'k', claim: 'c', confidence: 1, rationale: '' }, // reversed
      ],
    };
    expect(normalizeStructuralParts(raw, blocks)).toHaveLength(0);
  });

  it('drops a part missing kind or claim', () => {
    const raw = {
      parts: [
        { startBlock: 0, endBlock: 0, kind: '', claim: 'c', confidence: 1, rationale: '' },
        { startBlock: 1, endBlock: 1, kind: 'k', claim: '', confidence: 1, rationale: '' },
      ],
    };
    expect(normalizeStructuralParts(raw, blocks)).toHaveLength(0);
  });

  it('drops a part whose block yields an empty anchor', () => {
    const blank = [{ index: 0, text: '   ', kind: 'prose' as const }];
    const raw = { parts: [{ startBlock: 0, endBlock: 0, kind: 'k', claim: 'c', confidence: 1, rationale: '' }] };
    expect(normalizeStructuralParts(raw, blank)).toHaveLength(0);
  });

  it('returns [] on junk (null / non-array parts / empty object)', () => {
    expect(normalizeStructuralParts(null, blocks)).toEqual([]);
    expect(normalizeStructuralParts({ parts: 'nope' }, blocks)).toEqual([]);
    expect(normalizeStructuralParts({}, blocks)).toEqual([]);
  });

  it('assigns content-stable ids (deterministic; content-based; suffixed on duplicates)', () => {
    const one = { parts: [{ startBlock: 0, endBlock: 1, kind: 'motivation', claim: 'It motivates.', confidence: 1, rationale: 'r' }] };
    const a = normalizeStructuralParts(one, blocks);
    const b = normalizeStructuralParts(one, blocks);
    expect(a[0].id).toBe(b[0].id); // deterministic across runs (survives re-discovery)

    // content-based: a different claim yields a different id (not positional)
    const diff = normalizeStructuralParts({ parts: [{ ...one.parts[0], claim: 'A wholly different claim.' }] }, blocks);
    expect(diff[0].id).not.toBe(a[0].id);

    // two identical parts in one batch → the second is suffixed, never collides
    const parts = normalizeStructuralParts({ parts: [one.parts[0], one.parts[0]] }, blocks);
    expect(parts).toHaveLength(2);
    expect(parts[0].id).not.toBe(parts[1].id);
    expect(parts[1].id).toBe(`${parts[0].id}-1`);
  });
});

describe('discoverStructuralParts', () => {
  it('builds a JSON request under the editable prompt and returns the parsed parts', async () => {
    const reqs: LLMRequest[] = [];
    const client = mockClient(
      [JSON.stringify({ parts: [{ startBlock: 0, endBlock: 2, kind: 'whole', claim: 'W', confidence: 0.8, rationale: 'r' }] })],
      reqs,
    );
    const parts = await discoverStructuralParts(client, 'm', 0, inputFor());
    expect(reqs[0].json).toBe(true);
    expect(reqs[0].systemInstruction).toBe(DEFAULT_PROMPTS_CONFIG.discoverStructuralPartsPrompt);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ kind: 'whole', claim: 'W', confidence: 0.8 });
    expect(parts[0].startAnchor).toBe(anchorFor(blocks[0].text));
    expect(parts[0].endAnchor).toBe(anchorFor(blocks[2].text));
  });

  it('returns [] when the model emits junk (never throws)', async () => {
    const reqs: LLMRequest[] = [];
    const client = mockClient(['not json at all'], reqs);
    await expect(discoverStructuralParts(client, 'm', 0, inputFor())).resolves.toEqual([]);
  });
});
