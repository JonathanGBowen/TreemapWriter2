// StructuralPart discovery, provider-agnostic — the whole-document sibling of
// Articulation (ai-provider.segment.ts). Where Articulation descends the heading
// tree one level at a time and proposes heading EDITS, this makes ONE pass over
// the whole document and reconstructs the argument's structural-functional PARTS
// (the moves it makes), INDEPENDENT of the heading grid.
//
// Mirrors ai-provider.gist-analysis.ts in shape (a JSON schema + buildUserPrompt
// over numbered blocks + a single generateText({json:true}) + a tolerant
// normalize-or-return-[]). The parse mirrors parseSegmentResponse exactly: the
// model emits BLOCK INDICES (more reliable than raw anchors), and we derive
// startAnchor/endAnchor via anchorFor(block.text), dropping any part whose
// indices are out of range or whose anchor is empty. `sectionIds` is left empty
// here — it is computed deterministically later (lib/structural-part-helpers).
// Never throws; returns [] on junk; nothing is fabricated.

import type { DiscoverStructuralPartsInput } from '../ai-provider';
import type { StructuralPart } from '../../types';
import { safeJsonParse } from '../../lib/utils';
import { anchorFor } from '../../lib/paragraph-helpers';
import type { LLMClient } from './clients';

/** Output ceiling for Anthropic (Gemini/Ollama ignore it). */
const MAX_OUTPUT_TOKENS = 8000;

const partsJsonSchema = {
  type: 'object',
  properties: {
    parts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startBlock: { type: 'number' },
          endBlock: { type: 'number' },
          kind: { type: 'string' },
          claim: { type: 'string' },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['startBlock', 'endBlock', 'kind', 'claim', 'confidence', 'rationale'],
      },
    },
  },
  required: ['parts'],
};

const SCHEMA_TEXT = [
  'Return ONLY a JSON object of this shape (no markdown fences):',
  '{ "parts": [ { "startBlock": number, "endBlock": number, "kind": string,',
  '  "claim": string, "confidence": 0..1, "rationale": string } ] }',
  'startBlock/endBlock are inclusive indices into the BLOCKS list below (endBlock >= startBlock).',
].join('\n');

const preview = (text: string, n = 480): string => (text.length > n ? `${text.slice(0, n)}…` : text);

export const buildUserPrompt = (input: DiscoverStructuralPartsInput): string => {
  // Renumber to array position so the emitted indices line up with the array the
  // parse layer indexes into (mirrors segment.ts's spanBlocks).
  const body = input.blocks.map((b, i) => ({ index: i, kind: b.kind, text: preview(b.text) }));
  return [
    'SCHEMA:',
    SCHEMA_TEXT,
    '',
    `DOCUMENT (title: ${input.documentTitle}):`,
    'BLOCKS (numbered in reading order; a part runs from its startBlock through its endBlock, inclusive):',
    JSON.stringify(body, null, 2),
  ].join('\n');
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any, fallback: number): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const str = (v: any): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Parse one raw response into StructuralParts. Tolerant, mirrors
 * parseSegmentResponse: for each emitted part, round the block indices, drop any
 * that are out of range or reversed, derive verbatim anchors from the blocks, and
 * drop a part whose anchor is empty. `sectionIds` is always [] here. Returns []
 * on junk (never throws). `blocks[i].text` is indexed by array position, so the
 * caller must pass the SAME block array buildUserPrompt numbered.
 */
export function normalizeStructuralParts(
  raw: unknown,
  blocks: { index: number; text: string }[],
): StructuralPart[] {
  const data = (raw ?? {}) as any;
  const rawParts: any[] = Array.isArray(data?.parts) ? data.parts : [];
  const out: StructuralPart[] = [];
  rawParts.forEach((p, i) => {
    const startBlock = Math.round(num(p?.startBlock, -1));
    const endBlock = Math.round(num(p?.endBlock, -1));
    if (startBlock < 0 || startBlock >= blocks.length) return; // out of range
    if (endBlock < startBlock || endBlock >= blocks.length) return; // reversed / out of range
    const kind = str(p?.kind);
    const claim = str(p?.claim);
    if (!kind || !claim) return;
    const startAnchor = anchorFor(blocks[startBlock].text);
    const endAnchor = anchorFor(blocks[endBlock].text);
    if (!startAnchor || !endAnchor) return; // unanchorable — drop, never fabricate
    out.push({
      id: `part-${i}`,
      kind,
      claim,
      startAnchor,
      endAnchor,
      sectionIds: [],
      confidence: Math.max(0, Math.min(1, num(p?.confidence, 0.5))),
      rationale: str(p?.rationale),
    });
  });
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Discover the document's structural-functional parts in one whole-document pass.
 * A single generateText call + a tolerant normalize (never throws). Mirrors
 * `analyzeGist`.
 */
export async function discoverStructuralParts(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: DiscoverStructuralPartsInput,
): Promise<StructuralPart[]> {
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: input.config.discoverStructuralPartsPrompt,
    json: true,
    responseJsonSchema: partsJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return normalizeStructuralParts(safeJsonParse(text || '', null), input.blocks);
}
