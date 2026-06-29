// Gestalt segmentation ("Articulation"), provider-agnostic — the sibling of
// ai-provider.specs.ts. Where the spec walk descends a tree of headings that
// ALREADY exists, this walk DISCOVERS the levels: a top-down descent that, per
// span, asks the model where the natural joints are (or judges the span a whole)
// and proposes anchored heading EDITS the review UI applies via lib/segment-helpers.
//
// Mirrors specs.ts in shape (pure prompt-build + tolerant JSON parse + a single
// generateText call), but two things differ: (1) the per-level "spans" are
// recomputed from the reparsed tree after each accept rather than predeclared, and
// (2) the artifact is a `SegmentEdit`, not a `SectionSpec`. Division is by natural
// articulation, never to a count: the count of parts falls out of where the joints
// are (Wertheimer; the lesson already applied to decompose-step.md).

import type {
  Section,
  SegmentEdit,
  SegmentGenre,
  SegmentGranularity,
  SegmentMode,
  PromptsConfig,
  ParagraphKind,
} from '../../types';
import { safeJsonParse } from '../../lib/utils';
import { anchorFor } from '../../lib/paragraph-helpers';
import type { ParagraphBlock } from '../../lib/paragraph-helpers';
import type { LLMClient } from './clients';

/** Output ceiling for Anthropic (Gemini/Ollama ignore it). */
const MAX_OUTPUT_TOKENS = 8000;

/** Runaway fuse for the descent — never reached in normal academic texts. */
export const MAX_SEGMENT_DEPTH = 5;

/** Conservative "definitely clear" bar; the orchestrator filters below it. */
export const SEGMENT_CONSERVATIVE_THRESHOLD = 0.8;

const HEADING_LINE = /^(#{1,6})\s+(.*)$/;

const VALID_EDIT_KINDS = ['insert', 'retitle', 'relevel', 'merge', 'split'] as const;

/** A contiguous region of the document to consider for division at one level.
 *  `targetLevel` is the markdown heading level a seam in this span would insert. */
export interface SegmentSpan {
  id: string;
  depth: number;
  /** Absolute block indices into the document's segmented blocks (inclusive/exclusive). */
  blockStart: number;
  blockEnd: number;
  targetLevel: number;
  /** Accepted/existing ancestor titles — the part-in-whole context (specCache analogue). */
  headingPath: string[];
}

/** One block as the per-span prompt sees it (text is the FULL block text — anchors
 *  are computed from it; the prompt itself shows a preview). */
export interface SpanBlock {
  index: number;
  text: string;
  kind: ParagraphKind;
}

/** The result of one per-span pass: the edits to review/apply, whether the span is
 *  already a unitary whole (stop the branch), and any reverse-outline summaries. */
export interface SegmentSpanResult {
  indivisible: boolean;
  edits: SegmentEdit[];
  /** Reverse-outline glosses keyed by part TITLE (summaries mode); resolved to a
   *  section id by the orchestrator after reparse, then stored as `reverseSummary`. */
  summaries: { title: string; sentence: string }[];
}

// --- Genre / scale: "situated" number (Wertheimer's Naturvölker) ---

/** Infer the document's genre from its size. A coarse, approximate read with wide
 *  zones of indifference — the author overrides it in the workspace. */
export function inferGenre(wordCount: number): SegmentGenre {
  if (wordCount > 45000) return 'compilation';
  if (wordCount > 8000) return 'monograph';
  return 'article';
}

/** The shallowest heading level the walk inserts at the top. Anchored to the
 *  document's existing structure when it has any (so depth↔level stays consistent),
 *  else the genre's idiom (an article's sections are H2 under an implicit title). */
export function baseLevelFor(genre: SegmentGenre, sections: Section[]): number {
  if (sections.length > 0) return Math.min(...sections.map((s) => s.level));
  return genre === 'article' ? 2 : 1;
}

/** A situated shard-floor: a child below this many words can't itself be a whole,
 *  so it is never further divided (a guard, NEVER a target count). */
export function minSpanWordsFor(genre: SegmentGenre): number {
  return genre === 'compilation' ? 300 : genre === 'monograph' ? 200 : 120;
}

// --- Span computation (recomputed from the reparsed tree after each accept) ---

const wordsIn = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

const headingLevelOf = (text: string): number | null => {
  const m = text.trim().match(HEADING_LINE);
  return m ? m[1].length : null;
};

/** Collect the sections at a given heading level, each with its ancestor title path. */
function regionsAtLevel(sections: Section[], level: number): { section: Section; path: string[] }[] {
  const out: { section: Section; path: string[] }[] = [];
  const walk = (nodes: Section[], path: string[]) => {
    for (const n of nodes) {
      if (n.level === level) out.push({ section: n, path });
      walk(n.children, [...path, n.title]);
    }
  };
  walk(sections, []);
  return out;
}

/**
 * The spans to segment at one depth, recomputed from the CURRENT tree + blocks.
 * Depth 0 is the whole document; depth d≥1 is the body of each section at level
 * (baseLevel + d − 1) — its prose after its own heading. A span too small to hold a
 * meaningful part AND carrying no existing heading to critique is dropped.
 */
export function spansForDepth(
  sections: Section[],
  blocks: ParagraphBlock[],
  depth: number,
  baseLevel: number,
  genre: SegmentGenre,
): SegmentSpan[] {
  const targetLevel = baseLevel + depth;
  if (targetLevel > 6) return [];
  const floor = minSpanWordsFor(genre);

  if (depth === 0) {
    if (blocks.length === 0) return [];
    return [{ id: 'span-0', depth: 0, blockStart: 0, blockEnd: blocks.length, targetLevel, headingPath: [] }];
  }

  const parents = regionsAtLevel(sections, targetLevel - 1);
  const spans: SegmentSpan[] = [];
  parents.forEach(({ section, path }, i) => {
    const start = section.startOffset;
    const end = start + section.fullContent.length;
    const within = blocks.filter((b) => b.startOffset >= start && b.startOffset < end);
    // Drop the parent's own heading block (the first block, at `start`).
    const body = within.filter((b) => !(b.kind === 'heading' && b.startOffset === start));
    if (body.length === 0) return;
    const words = body.reduce((sum, b) => sum + wordsIn(b.text), 0);
    const hasHeading = body.some((b) => headingLevelOf(b.text) === targetLevel);
    if (words < floor && !hasHeading) return; // too small to divide, nothing to critique
    spans.push({
      id: `span-${depth}-${i}`,
      depth,
      blockStart: body[0].index,
      blockEnd: body[body.length - 1].index + 1,
      targetLevel,
      headingPath: [...path, section.title],
    });
  });
  return spans;
}

/** The blocks belonging to a span, as the prompt/parse layer wants them. */
export function spanBlocks(blocks: ParagraphBlock[], span: SegmentSpan): SpanBlock[] {
  return blocks
    .slice(span.blockStart, span.blockEnd)
    .map((b, i) => ({ index: i, text: b.text, kind: b.kind }));
}

// --- Prompt building (mirrors buildStagePrompt) ---

export interface SegmentPromptArgs {
  blocks: SpanBlock[];
  headingPath: string[];
  targetLevel: number;
  mode: SegmentMode;
  granularity: SegmentGranularity;
  genre: SegmentGenre;
  config: PromptsConfig;
}

/** Existing headings within the span that sit at the target level (the candidates
 *  for critique). Empty in exploratory mode (it re-derives from scratch). */
function existingTargetHeadings(blocks: SpanBlock[], targetLevel: number): SpanBlock[] {
  return blocks.filter((b) => b.kind === 'heading' && headingLevelOf(b.text) === targetLevel);
}

const preview = (text: string, n = 480): string => (text.length > n ? `${text.slice(0, n)}…` : text);

/** Build the single-shot prompt for one span. Branches to the critique task when
 *  the span already carries headings at the target level (and we're not exploring). */
export function buildSegmentPrompt(args: SegmentPromptArgs): string {
  const { blocks, headingPath, targetLevel, mode, granularity, genre, config } = args;
  const hashes = '#'.repeat(Math.max(1, Math.min(6, targetLevel)));
  const existing = mode === 'exploratory' ? [] : existingTargetHeadings(blocks, targetLevel);
  const useCritique = existing.length > 0;

  const framing = [
    `DOCUMENT GENRE: ${genre} — articulate at the scale idiomatic for this genre.`,
    `INSERT HEADINGS AT MARKDOWN LEVEL ${targetLevel} ("${hashes} …").`,
    headingPath.length ? `HEADING PATH TO HERE: ${headingPath.join(' › ')}` : 'THIS IS THE WHOLE DOCUMENT (top level).',
  ].join('\n');

  const task = useCritique
    ? config.segmentCritiqueTask
    : config.segmentLevelTask.replace(/\{\{GRANULARITY\}\}/g, granularity);

  const summaryDirective = mode === 'summaries' ? ['', config.segmentSummaryTask] : [];

  const existingBlock = useCritique
    ? [
        '',
        'EXISTING HEADINGS AT THIS LEVEL (evaluate these — anchor an edit by the heading line text):',
        JSON.stringify(existing.map((b) => b.text.trim()), null, 2),
      ]
    : [];

  return [
    config.segmentSystemInstruction,
    '',
    framing,
    '',
    task,
    ...summaryDirective,
    ...existingBlock,
    '',
    'BLOCKS (numbered in order; a seam falls BEFORE the block that OPENS a new part):',
    JSON.stringify(
      blocks.map((b) => ({ index: b.index, kind: b.kind, text: preview(b.text) })),
      null,
      2,
    ),
  ].join('\n');
}

// --- Parsing (tolerant, mirrors parseStageResponse / coerceSpec) ---

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any, fallback: number): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const str = (v: any): string => (typeof v === 'string' ? v.trim() : '');

/** Parse one span's raw response into edits + summaries. Branches to match the
 *  task that was sent (critique when the span had target-level headings). */
export function parseSegmentResponse(args: SegmentPromptArgs, raw: string): SegmentSpanResult {
  const { blocks, targetLevel, mode } = args;
  const useCritique = mode !== 'exploratory' && existingTargetHeadings(blocks, targetLevel).length > 0;
  const data = safeJsonParse(raw || '{}') as any;
  const summaries: { title: string; sentence: string }[] = [];
  const edits: SegmentEdit[] = [];

  if (useCritique) {
    const rawEdits: any[] = Array.isArray(data?.edits) ? data.edits : [];
    for (const e of rawEdits) {
      const kind = VALID_EDIT_KINDS.includes(e?.kind) ? e.kind : null;
      const anchor = str(e?.anchor);
      if (!kind || !anchor) continue;
      const confidence = Math.max(0, Math.min(1, num(e?.confidence, 0.5)));
      const rationale = str(e?.rationale);
      if (kind === 'retitle') {
        const title = str(e?.title);
        if (title) edits.push({ kind, anchor, title, confidence, rationale });
      } else if (kind === 'relevel') {
        edits.push({ kind, anchor, level: Math.round(num(e?.level, targetLevel)), confidence, rationale });
      } else if (kind === 'merge') {
        edits.push({ kind, anchor, confidence, rationale });
      } else {
        // insert | split
        const title = str(e?.title);
        const summary = str(e?.summary);
        if (!title) continue;
        edits.push({ kind, anchor, level: Math.round(num(e?.level, targetLevel)), title, ...(summary ? { summary } : {}), confidence, rationale });
        if (summary) summaries.push({ title, sentence: summary });
      }
    }
    return { indivisible: data?.indivisible === true, edits, summaries };
  }

  // Level pass: seams → insert edits, anchored to the block that opens the new part.
  const indivisible = data?.indivisible === true;
  const rawSeams: any[] = Array.isArray(data?.seams) ? data.seams : [];
  for (const s of rawSeams) {
    const bi = Math.round(num(s?.blockIndex, -1));
    const title = str(s?.title);
    if (bi < 0 || bi >= blocks.length || !title) continue;
    const anchor = anchorFor(blocks[bi].text);
    if (!anchor) continue;
    const confidence = Math.max(0, Math.min(1, num(s?.confidence, 0.5)));
    const summary = str(s?.summary);
    edits.push({
      kind: 'insert',
      anchor,
      level: targetLevel,
      title,
      ...(summary ? { summary } : {}),
      confidence,
      rationale: str(s?.rationale),
    });
    if (summary) summaries.push({ title, sentence: summary });
  }
  return { indivisible, edits, summaries };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Generate ONE span's edits in a single shot (the building block the workspace
 *  walk and "run all remaining" loop over). Mirrors `generateSpecLevel`. */
export async function segmentSpan(
  client: LLMClient,
  model: string,
  thinkingBudget: number,
  args: SegmentPromptArgs,
): Promise<SegmentSpanResult> {
  const prompt = buildSegmentPrompt(args);
  const raw = await client.generateText({
    model,
    prompt,
    json: true,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return parseSegmentResponse(args, raw || '{}');
}
