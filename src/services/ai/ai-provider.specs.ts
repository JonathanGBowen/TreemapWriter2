// Spec generation, ported from the old GeminiProvider but provider-agnostic:
// it builds prompts and parses JSON, delegating the actual model call to an
// LLMClient. The batching-by-document-level strategy and the tolerant parser
// are unchanged from the pre-multi-provider implementation.

import type { Section, SectionSpec, RequiredMove, SectionFunction } from '../../types';
import { safeJsonParse } from '../../lib/utils';
import type { GenerateSpecsInput } from '../ai-provider';
import type { LLMClient } from './clients';

const VALID_FUNCTIONS: SectionFunction[] = [
  'introduce', 'explicate', 'argue', 'compare', 'critique',
  'synthesize', 'apply', 'evaluate', 'narrate', 'transition',
];

/** Output ceiling for Anthropic (Gemini/Ollama ignore it). Specs can be large. */
const MAX_OUTPUT_TOKENS = 16000;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Coerce one tolerant spec object (or bare string) into a SectionSpec. Shared by
 * the per-id batch parser and the single-object document-level (root) pass.
 */
export function coerceSpec(data: any): SectionSpec {
  if (typeof data === 'string') {
    return {
      function: 'argue',
      mainClaim: data,
      requiredMoves: [{ id: 'move-0', description: data }],
      incomingContext: [],
      outgoingCommitments: [],
    };
  }
  const fn = VALID_FUNCTIONS.includes(data.function) ? data.function : 'argue';
  const rawMoves = data.requiredMoves || data.required_moves || [];
  const moves: RequiredMove[] = rawMoves.map((m: any, i: number) => {
    if (typeof m === 'string') return { id: `move-${i}`, description: m };
    return {
      id: m.id || `move-${i}`,
      description: m.description || m.text || String(m),
      after: m.after,
    };
  });
  return {
    function: fn,
    mainClaim: data.mainClaim || data.main_claim || '',
    requiredMoves: moves,
    incomingContext: data.incomingContext || data.incoming_context || [],
    outgoingCommitments: data.outgoingCommitments || data.outgoing_commitments || [],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function generateSpecs(
  client: LLMClient,
  model: string,
  thinkingBudget: number,
  input: GenerateSpecsInput,
): Promise<void> {
  const { sections, markdown, config, onBatchComplete } = input;

  const allNodes: Section[] = [];
  const traverse = (nodes: Section[]) => {
    nodes.forEach((n) => {
      allNodes.push(n);
      traverse(n.children);
    });
  };
  traverse(sections);

  const byLevel: Record<number, Section[]> = {};
  let maxLevel = 0;
  allNodes.forEach((n) => {
    if (!byLevel[n.level]) byLevel[n.level] = [];
    byLevel[n.level].push(n);
    maxLevel = Math.max(maxLevel, n.level);
  });

  const specCache: Record<string, SectionSpec> = {};
  const call = (prompt: string) =>
    client.generateText({ model, prompt, json: true, thinkingBudget, maxTokens: MAX_OUTPUT_TOKENS });

  // Top-level outline (chapter titles + their children) — the structural backbone
  // of the document-level prompt and the L1 batch.
  const topLevelOutline = sections.map((n) => ({
    title: n.title,
    level: n.level,
    childTitles: n.children.map((c) => c.title),
    wordCount: n.wordCount,
  }));

  // --- Phase 0: document-level (root) spec ---
  // The whole-document pass runs FIRST and constrains the chapter pass below
  // (top-down). It reads the full document text when it fits the model window;
  // orchestration sets `rootFullText` false to degrade to the outline on overflow.
  {
    const rootPrompt = [
      config.systemInstruction,
      '',
      'DOCUMENT STRUCTURE (top-level sections):',
      JSON.stringify(topLevelOutline, null, 2),
      '',
      ...(input.rootFullText === false
        ? ['(Full document text omitted — it exceeds the model context window; reconstruct the document-level spec from the structure above.)']
        : ['FULL DOCUMENT TEXT:', '---', markdown, '---']),
      '',
      config.rootTaskInstruction,
    ].join('\n');

    const rootRaw = safeJsonParse((await call(rootPrompt)) || '{}') as Record<string, unknown>;
    const rootData =
      rootRaw && typeof rootRaw === 'object' && 'root' in rootRaw ? rootRaw.root : rootRaw;
    if (rootData && typeof rootData === 'object') {
      const rootSpec = coerceSpec(rootData);
      specCache['root'] = rootSpec;
      onBatchComplete({ root: rootSpec });
    }
  }

  const l1Nodes = byLevel[1] || [];
  if (l1Nodes.length > 0) {
    // The document-level spec (Phase 0) constrains the chapters — top-down.
    const rootCtx = specCache['root']
      ? {
          function: specCache['root'].function,
          mainClaim: specCache['root'].mainClaim,
          requiredMoves: specCache['root'].requiredMoves.map((m) => m.description),
          outgoingCommitments: specCache['root'].outgoingCommitments,
        }
      : null;
    const batch1Prompt = [
      config.systemInstruction,
      '',
      ...(rootCtx
        ? [
            'DOCUMENT-LEVEL SPEC (top-level pass — these chapters must be consistent with it):',
            JSON.stringify(rootCtx, null, 2),
            '',
          ]
        : []),
      // Part-not-piece: a character prefix (the old `markdown.slice(0, 4000)`) is a
      // piece torn from context. The document-level spec above (its role/claim) plus
      // this structural outline carry the whole as a part-reconstruction, never a slice.
      'DOCUMENT OUTLINE (structural backbone — chapters and their children):',
      JSON.stringify(topLevelOutline, null, 2),
      '',
      config.l1TaskInstruction,
      '',
      'SECTIONS TO ANALYZE:',
      // TODO (Gestalt roadmap, part-not-piece): `contentPreview` is still a char
      // prefix — a piece. It is unavoidable *here* because this pass is what derives
      // the spec, so no role-reconstruction exists yet for these sections. The proper
      // fix lands with boundary/reconstruction work: derive a structural skeleton
      // rather than slicing. See docs/gestalt-design.md item 7.
      JSON.stringify(
        l1Nodes.map((n) => ({
          id: n.id,
          title: n.title,
          level: n.level,
          contentPreview: n.content.slice(0, 800),
          childTitles: n.children.map((c) => c.title),
          wordCount: n.wordCount,
        })),
        null, 2,
      ),
    ].join('\n');

    const specs1 = parseSpecResponse(safeJsonParse(await call(batch1Prompt) || '{}'));
    Object.assign(specCache, specs1);
    onBatchComplete(specs1);
  }

  for (let l = 2; l <= maxLevel; l += 2) {
    const nodes = [...(byLevel[l] || []), ...(byLevel[l + 1] || [])];
    if (nodes.length === 0) continue;

    const parentContext: Record<string, unknown> = {};
    nodes.forEach((n) => {
      if (n.parentId && specCache[n.parentId]) {
        const ps = specCache[n.parentId];
        parentContext[n.parentId] = {
          function: ps.function,
          mainClaim: ps.mainClaim,
          requiredMoves: ps.requiredMoves.map((m) => m.description),
          outgoingCommitments: ps.outgoingCommitments,
        };
      }
    });

    const batchPrompt = [
      config.systemInstruction,
      '',
      'PARENT SECTION SPECS (for context — subsections must be consistent with these):',
      JSON.stringify(parentContext, null, 2),
      '',
      config.subTaskInstruction,
      '',
      'SECTIONS TO ANALYZE:',
      JSON.stringify(
        nodes.map((n) => ({
          id: n.id,
          level: n.level,
          title: n.title,
          parentId: n.parentId,
          contentPreview: n.content.slice(0, 600),
          childTitles: n.children.map((c) => c.title),
          wordCount: n.wordCount,
        })),
        null, 2,
      ),
    ].join('\n');

    // Rate limit between batches.
    await new Promise((r) => setTimeout(r, 2000));

    const specs = parseSpecResponse(safeJsonParse(await call(batchPrompt) || '{}'));
    Object.assign(specCache, specs);
    onBatchComplete(specs);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseSpecResponse(raw: Record<string, any>): Record<string, SectionSpec> {
  const specs: Record<string, SectionSpec> = {};
  for (const [id, data] of Object.entries(raw)) {
    if (id === 'root') continue;
    specs[id] = coerceSpec(data);
  }
  return specs;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
