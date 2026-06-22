// Spec generation, ported from the old GeminiProvider but provider-agnostic:
// it builds prompts and parses JSON, delegating the actual model call to an
// LLMClient. The batching-by-document-level strategy and the tolerant parser
// are unchanged from the pre-multi-provider implementation.

import type { Section, SectionSpec, RequiredMove, SectionFunction, PromptsConfig } from '../../types';
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

// --- The stage plan: the document's spec hierarchy, top to bottom ---
//
// The spec walk goes from the whole to the parts: a document-level (root) stage,
// then ONE stage per document level that has sections (chapters = level 1, then
// level 2, …). Each stage's prompt is constrained by the specs ACCEPTED above it
// (the parent context), so the hierarchy stays consistent top-down. The
// human-in-the-loop workspace drives these stages one at a time; the legacy
// `generateSpecs` batch below walks them all in sequence.

export type SpecStageKind = 'root' | 'level';

export interface SpecStage {
  /** Stable id: 'root' for the document level, otherwise `l${level}`. */
  id: string;
  kind: SpecStageKind;
  /** 0 for the root stage; otherwise the document level this stage specifies. */
  level: number;
  /** The section ids at this level (empty for the root stage). */
  nodeIds: string[];
  /** Human label for the rail / progress (e.g. 'Whole document', 'Chapters'). */
  label: string;
}

/** Depth-first flatten of the section tree (small; no memo needed). */
function flattenSections(sections: Section[]): Section[] {
  const out: Section[] = [];
  const walk = (nodes: Section[]) => nodes.forEach((n) => { out.push(n); walk(n.children); });
  walk(sections);
  return out;
}

/** Bucket sections by document level. */
function bucketByLevel(allNodes: Section[]): Record<number, Section[]> {
  const byLevel: Record<number, Section[]> = {};
  allNodes.forEach((n) => {
    (byLevel[n.level] ||= []).push(n);
  });
  return byLevel;
}

/**
 * The ordered stage plan for a section tree: the root stage, then one stage per
 * existing document level (≥1), shallow to deep. Pure — the workspace and the
 * legacy batch both walk this list so "from above to below" lives in one place.
 */
export function specStages(sections: Section[]): SpecStage[] {
  const byLevel = bucketByLevel(flattenSections(sections));
  const levels = Object.keys(byLevel)
    .map(Number)
    .filter((l) => l >= 1)
    .sort((a, b) => a - b);
  const stages: SpecStage[] = [
    { id: 'root', kind: 'root', level: 0, nodeIds: [], label: 'Whole document' },
  ];
  for (const l of levels) {
    stages.push({
      id: `l${l}`,
      kind: 'level',
      level: l,
      nodeIds: byLevel[l].map((n) => n.id),
      label: l === 1 ? 'Chapters' : `Level ${l}`,
    });
  }
  return stages;
}

/** Project a parent spec to the compact context shape the level prompts inject. */
function projectParent(spec: SectionSpec) {
  return {
    function: spec.function,
    mainClaim: spec.mainClaim,
    requiredMoves: spec.requiredMoves.map((m) => m.description),
    outgoingCommitments: spec.outgoingCommitments,
  };
}

/** Context for building one stage's prompt. `specCache` holds the ACCEPTED specs
 *  above this stage (keyed by section id, with `'root'` for the document level). */
export interface BuildStageCtx {
  sections: Section[];
  markdown: string;
  specCache: Record<string, SectionSpec>;
  config: PromptsConfig;
  /** Root stage only: include the full document text (false degrades to the outline). */
  rootFullText?: boolean;
  /** Optional author guidance for this level (the non-agent "steer note"). */
  steer?: string;
}

/** The author's-guidance block, appended to a stage prompt when a steer is given. */
const steerBlock = (steer?: string): string[] =>
  steer && steer.trim()
    ? ['', "AUTHOR'S GUIDANCE FOR THIS LEVEL (honor this):", steer.trim()]
    : [];

/**
 * Build the prompt for ONE stage. Branches on stage kind/level to reproduce the
 * three original passes exactly (document-level, chapters, subsections), now with
 * an optional author-steer block. Pure given the accepted `specCache`.
 */
export function buildStagePrompt(stage: SpecStage, ctx: BuildStageCtx): string {
  const { sections, markdown, specCache, config } = ctx;

  // Top-level outline (chapter titles + their children) — the structural backbone
  // of the document-level prompt and the L1 batch.
  const topLevelOutline = sections.map((n) => ({
    title: n.title,
    level: n.level,
    childTitles: n.children.map((c) => c.title),
    wordCount: n.wordCount,
  }));

  // --- Root stage: the whole-document pass ---
  // It reads the full document text when it fits the model window; the caller sets
  // `rootFullText` false to degrade to the outline on overflow.
  if (stage.kind === 'root') {
    return [
      config.systemInstruction,
      '',
      'DOCUMENT STRUCTURE (top-level sections):',
      JSON.stringify(topLevelOutline, null, 2),
      '',
      ...(ctx.rootFullText === false
        ? ['(Full document text omitted — it exceeds the model context window; reconstruct the document-level spec from the structure above.)']
        : ['FULL DOCUMENT TEXT:', '---', markdown, '---']),
      '',
      config.rootTaskInstruction,
      ...steerBlock(ctx.steer),
    ].join('\n');
  }

  const byId = new Map(flattenSections(sections).map((n) => [n.id, n]));
  const nodes = stage.nodeIds.map((id) => byId.get(id)).filter((n): n is Section => !!n);

  // --- Chapters (level 1): constrained by the document-level (root) spec ---
  if (stage.level === 1) {
    const rootCtx = specCache['root'] ? projectParent(specCache['root']) : null;
    return [
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
      ...steerBlock(ctx.steer),
      '',
      'SECTIONS TO ANALYZE:',
      // TODO (Gestalt roadmap, part-not-piece): `contentPreview` is still a char
      // prefix — a piece. It is unavoidable *here* because this pass is what derives
      // the spec, so no role-reconstruction exists yet for these sections. The proper
      // fix lands with boundary/reconstruction work: derive a structural skeleton
      // rather than slicing. See docs/gestalt-design.md item 7.
      JSON.stringify(
        nodes.map((n) => ({
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
  }

  // --- Subsections (level ≥ 2): constrained by each node's parent spec ---
  const parentContext: Record<string, unknown> = {};
  nodes.forEach((n) => {
    if (n.parentId && specCache[n.parentId]) {
      parentContext[n.parentId] = projectParent(specCache[n.parentId]);
    }
  });
  return [
    config.systemInstruction,
    '',
    'PARENT SECTION SPECS (for context — subsections must be consistent with these):',
    JSON.stringify(parentContext, null, 2),
    '',
    config.subTaskInstruction,
    ...steerBlock(ctx.steer),
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
}

/** Parse one stage's raw model response into specs keyed by id (root → `{root}`). */
export function parseStageResponse(stage: SpecStage, raw: string): Record<string, SectionSpec> {
  if (stage.kind === 'root') {
    const rootRaw = safeJsonParse(raw || '{}') as Record<string, unknown>;
    const rootData =
      rootRaw && typeof rootRaw === 'object' && 'root' in rootRaw ? rootRaw.root : rootRaw;
    return rootData && typeof rootData === 'object' ? { root: coerceSpec(rootData) } : {};
  }
  return parseSpecResponse(safeJsonParse(raw || '{}'));
}

/**
 * Generate ONE stage's specs in a single shot. The non-agent path (the
 * write-a-steer-note flow + "run all remaining") of the Generate-Specs workspace,
 * and the building block the legacy batch loops over.
 */
export async function generateSpecLevel(
  client: LLMClient,
  model: string,
  thinkingBudget: number,
  args: { stage: SpecStage } & BuildStageCtx,
): Promise<Record<string, SectionSpec>> {
  const { stage, ...ctx } = args;
  const prompt = buildStagePrompt(stage, ctx);
  const raw = await client.generateText({
    model, prompt, json: true, thinkingBudget, maxTokens: MAX_OUTPUT_TOKENS,
  });
  return parseStageResponse(stage, raw || '{}');
}

/**
 * The legacy batch run: walk every stage top-down without stopping, reporting each
 * via `onBatchComplete`. Retained for any caller that wants the one-shot behavior;
 * the workspace drives the same stages one at a time instead.
 */
export async function generateSpecs(
  client: LLMClient,
  model: string,
  thinkingBudget: number,
  input: GenerateSpecsInput,
): Promise<void> {
  const { sections, markdown, config, onBatchComplete } = input;
  const stages = specStages(sections);
  const specCache: Record<string, SectionSpec> = {};

  for (const stage of stages) {
    // Rate limit between deeper batches (the human paces the workspace path instead).
    if (stage.level >= 2) await new Promise((r) => setTimeout(r, 2000));

    const specs = await generateSpecLevel(client, model, thinkingBudget, {
      stage,
      sections,
      markdown,
      specCache,
      config,
      rootFullText: input.rootFullText,
    });
    Object.assign(specCache, specs);
    // The root pass only reports when it parsed; level passes report their batch.
    if (stage.kind !== 'root' || Object.keys(specs).length > 0) onBatchComplete(specs);
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
