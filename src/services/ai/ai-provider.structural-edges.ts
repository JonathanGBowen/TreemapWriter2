// StructuralEdge discovery, provider-agnostic — the W₁ edge-set (Arpeggio Phase 2),
// the sibling of ai-provider.structural-parts.ts. Where that faculty reconstructs
// the argument's PARTS (the nodes), this proposes the typed functional relations
// AMONG them (the edges) — the seven kinds, no more. It runs over the discovered
// parts (id/kind/claim only; the prose already lives in the parts), and the model
// emits part INDICES (more reliable than ids), which the normalize maps back to ids.
//
// Advisory by construction: every edge comes back origin 'discovered', status
// 'proposed', accepted or rejected by the writer downstream — never auto-committed.
// Tolerant: drops out-of-range / self / bad-kind / duplicate edges; returns [] on
// junk; never throws, never fabricates.

import type { DiscoverStructuralEdgesInput } from '../ai-provider';
import type { StructuralEdge, StructuralEdgeKind } from '../../types';
import { safeJsonParse } from '../../lib/utils';
import { edgeId } from '../../lib/structural-graph-helpers';
import type { LLMClient } from './clients';

/** Output ceiling for Anthropic (Gemini/Ollama ignore it). */
const MAX_OUTPUT_TOKENS = 6000;

const EDGE_KINDS: StructuralEdgeKind[] = [
  'grounds',
  'requires',
  'qualifies',
  'opposes',
  'exemplifies',
  'defines',
  'answers',
];
const KIND_SET = new Set<string>(EDGE_KINDS);

const edgesJsonSchema = {
  type: 'object',
  properties: {
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fromPart: { type: 'number' },
          toPart: { type: 'number' },
          kind: { type: 'string' },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['fromPart', 'toPart', 'kind', 'confidence', 'rationale'],
      },
    },
  },
  required: ['edges'],
};

const SCHEMA_TEXT = [
  'Return ONLY a JSON object of this shape (no markdown fences):',
  '{ "edges": [ { "fromPart": number, "toPart": number, "kind": string,',
  '  "confidence": 0..1, "rationale": string } ] }',
  'fromPart/toPart are indices into the PARTS list below. `kind` is exactly one of:',
  'grounds (a supports b), requires (a and b mutually determine each other),',
  'qualifies (a qualifies b), opposes (a and b stand in deliberate tension),',
  'exemplifies (a is an example of b), defines (a defines a term b uses),',
  'answers (a answers objection b). Propose an edge ONLY where the relation is real;',
  'omit uncertain ones. Do not relate a part to itself.',
].join('\n');

export const buildUserPrompt = (input: DiscoverStructuralEdgesInput): string => {
  const body = input.parts.map((p, i) => ({ index: i, kind: p.kind, claim: p.claim }));
  return [
    'SCHEMA:',
    SCHEMA_TEXT,
    '',
    `ARGUMENT (title: ${input.documentTitle}):`,
    'PARTS (numbered; propose the typed functional relations AMONG them, by index):',
    JSON.stringify(body, null, 2),
  ].join('\n');
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any, fallback: number): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const str = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Parse one raw response into StructuralEdges. Tolerant: rounds the part indices,
 * drops any out of range / self-referential / with an unknown kind, maps indices to
 * part ids, mints the content-stable `edgeId` (so a duplicate proposal collapses),
 * and stamps origin 'discovered' / status 'proposed'. Returns [] on junk; the
 * caller must pass the SAME parts array `buildUserPrompt` numbered.
 */
export function normalizeStructuralEdges(
  raw: unknown,
  parts: { id: string }[],
): StructuralEdge[] {
  const data = (raw ?? {}) as any;
  const rawEdges: any[] = Array.isArray(data?.edges) ? data.edges : [];
  const out: StructuralEdge[] = [];
  const seen = new Set<string>();
  rawEdges.forEach((e) => {
    const from = Math.round(num(e?.fromPart, -1));
    const to = Math.round(num(e?.toPart, -1));
    if (from < 0 || from >= parts.length) return; // out of range
    if (to < 0 || to >= parts.length) return; // out of range
    if (from === to) return; // no self-edges
    const kind = str(e?.kind).toLowerCase();
    if (!KIND_SET.has(kind)) return; // unknown kind — drop, never coerce
    const fromPartId = parts[from].id;
    const toPartId = parts[to].id;
    const id = edgeId(kind as StructuralEdgeKind, fromPartId, toPartId);
    if (seen.has(id)) return; // duplicate (incl. a symmetric edge stated both ways)
    seen.add(id);
    out.push({
      id,
      kind: kind as StructuralEdgeKind,
      fromPartId,
      toPartId,
      origin: 'discovered',
      status: 'proposed',
      confidence: clamp01(num(e?.confidence, 0.5)),
      rationale: str(e?.rationale),
    });
  });
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Discover the typed relations among the argument's parts in one pass. A single
 * generateText call + a tolerant normalize (never throws). Mirrors
 * `discoverStructuralParts`.
 */
export async function discoverStructuralEdges(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: DiscoverStructuralEdgesInput,
): Promise<StructuralEdge[]> {
  if (input.parts.length < 2) return []; // no relations possible
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: input.config.discoverStructuralEdgesPrompt,
    json: true,
    responseJsonSchema: edgesJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return normalizeStructuralEdges(safeJsonParse(text || '', null), input.parts);
}
