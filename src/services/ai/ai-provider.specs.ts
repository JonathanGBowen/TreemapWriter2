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

  const l1Nodes = byLevel[1] || [];
  if (l1Nodes.length > 0) {
    const batch1Prompt = [
      config.systemInstruction,
      '',
      'DOCUMENT PREVIEW (first 4000 chars):',
      markdown.slice(0, 4000),
      '...',
      '',
      config.l1TaskInstruction,
      '',
      'SECTIONS TO ANALYZE:',
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

    if (typeof data === 'string') {
      specs[id] = {
        function: 'argue',
        mainClaim: data,
        requiredMoves: [{ id: 'move-0', description: data }],
        incomingContext: [],
        outgoingCommitments: [],
      };
      continue;
    }

    const fn = VALID_FUNCTIONS.includes(data.function) ? data.function : 'argue';
    const rawMoves = data.requiredMoves || data.required_moves || [];
    const moves: RequiredMove[] = rawMoves.map((m: any, i: number) => {
      if (typeof m === 'string') {
        return { id: `move-${i}`, description: m };
      }
      return {
        id: m.id || `move-${i}`,
        description: m.description || m.text || String(m),
        after: m.after,
      };
    });

    specs[id] = {
      function: fn,
      mainClaim: data.mainClaim || data.main_claim || '',
      requiredMoves: moves,
      incomingContext: data.incomingContext || data.incoming_context || [],
      outgoingCommitments: data.outgoingCommitments || data.outgoing_commitments || [],
    };
  }
  return specs;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
