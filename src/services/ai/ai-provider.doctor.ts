// Reverse Outline Doctor — the reading instruments. Provider-agnostic: each flow
// selects its editable prompt from the config, frames the live-document input
// (pre-numbered paragraphs / a single paragraph / the reverse outline), and calls
// the injected LLMClient. The shared Logician persona (doctorSystemPrompt) rides
// as the system instruction on every call — the ported app sent it the same way.
// Split out of ai-provider.impl.ts to keep that file small (mirrors
// ai-provider.atmosphere.ts / ai-provider.reverse-outline.ts).

import { safeJsonParse } from '../../lib/utils';
import {
  normalizeClaimRows,
  normalizeCoherenceRows,
  normalizeParagraphDiagnosis,
  normalizeSaysDoesRows,
  normalizeThesisOptions,
} from '../../lib/doctor-helpers';
import type {
  DistillThesisInput,
  DoctorBlock,
  DoctorOutlineInput,
  DoctorOutlineResult,
  DoctorParagraphInput,
  DoctorReportInput,
} from '../ai-provider';
import type { DoctorReportInstrument, DoctorRowInstrument, ParagraphDiagnosis, ThesisOption } from '../../types';
import type { EditablePromptKey } from '../prompts/registry';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

/** Which editable prompt drives each row instrument. */
const ROW_PROMPT_KEY: Record<DoctorRowInstrument, EditablePromptKey> = {
  claims: 'doctorOutlinePrompt',
  saysDoes: 'doctorOutlineTablePrompt',
  thesisCheck: 'doctorThesisCheckPrompt',
};

/** Which editable prompt drives each report instrument. */
const REPORT_PROMPT_KEY: Record<DoctorReportInstrument, EditablePromptKey> = {
  flow: 'doctorFlowPrompt',
  redundancy: 'doctorRedundancyPrompt',
  gaps: 'doctorGapsPrompt',
};

const row = { index: { type: 'number' } } as const;

/** Structured-output schema per row instrument. The model cites 1-based numbers
 *  via `index`; the normalizers re-align to the 0-based blocks and never drop a row. */
const ROW_SCHEMA: Record<DoctorRowInstrument, object> = {
  claims: {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: { ...row, claim: { type: 'string' } },
          required: ['index', 'claim'],
        },
      },
    },
    required: ['rows'],
  },
  saysDoes: {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: { ...row, says: { type: 'string' }, does: { type: 'string' } },
          required: ['index', 'says', 'does'],
        },
      },
    },
    required: ['rows'],
  },
  thesisCheck: {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ...row,
            claim: { type: 'string' },
            verdict: { type: 'string', enum: ['Yes', 'No', 'Weakly'] },
            justification: { type: 'string' },
          },
          required: ['index', 'claim', 'verdict', 'justification'],
        },
      },
    },
    required: ['rows'],
  },
};

const KIND_HINT: Record<string, string> = {
  prose: 'prose',
  heading: 'heading — echo verbatim, no verdict',
  list: 'list — echo verbatim, no verdict',
  code: 'code — echo verbatim, no verdict',
};

/** Emit the scope 1-based ([1]…[N]) — the numbering the ported prompts speak. */
const numberedBlocks = (blocks: DoctorBlock[]): string =>
  blocks.map((b) => `[${b.index + 1}] (${KIND_HINT[b.kind] ?? b.kind})\n${b.text}`).join('\n\n');

const buildRowPrompt = (input: DoctorOutlineInput): string =>
  [
    input.config[ROW_PROMPT_KEY[input.instrument]],
    '',
    `### SCOPE: ${input.scopeTitle} ###`,
    '',
    `### THESIS ###`,
    input.thesis,
    '',
    '### PARAGRAPHS (pre-numbered) ###',
    // Full scope, never a slice: the caller pre-flights the token budget via
    // guardContextFit and aborts on overflow rather than truncating.
    numberedBlocks(input.blocks),
    '',
    'Return ONLY the JSON object defined by the schema (a "rows" array). Produce exactly one row per paragraph number above, in order, using that number as `index`.',
  ].join('\n');

export async function runDoctorOutline(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: DoctorOutlineInput,
): Promise<DoctorOutlineResult> {
  const text = await client.generateText({
    model,
    prompt: buildRowPrompt(input),
    systemInstruction: input.config.doctorSystemPrompt,
    json: true,
    responseJsonSchema: ROW_SCHEMA[input.instrument],
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  const raw = safeJsonParse(text || '', null);
  // The normalizers never throw and always return one row per input block.
  switch (input.instrument) {
    case 'claims':
      return { instrument: 'claims', rows: normalizeClaimRows(raw, input.blocks) };
    case 'saysDoes':
      return { instrument: 'saysDoes', rows: normalizeSaysDoesRows(raw, input.blocks) };
    case 'thesisCheck':
      return { instrument: 'thesisCheck', rows: normalizeCoherenceRows(raw, input.blocks) };
  }
}

const paragraphSchema = {
  type: 'object',
  properties: {
    says: { type: 'string' },
    does: { type: 'string' },
    coherence: { type: 'string' },
  },
  required: ['says', 'does', 'coherence'],
};

export async function runDoctorParagraph(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: DoctorParagraphInput,
): Promise<ParagraphDiagnosis | null> {
  const prompt = [
    input.config.doctorParagraphPrompt,
    '',
    '### PARAGRAPH ###',
    input.paragraph,
    '',
    'Return ONLY the JSON object defined by the schema: "says" (one sentence), "does" (the rhetorical function), "coherence" (the one-sentence Coherence Check).',
  ].join('\n');
  const text = await client.generateText({
    model,
    prompt,
    systemInstruction: input.config.doctorSystemPrompt,
    json: true,
    responseJsonSchema: paragraphSchema,
    thinkingBudget,
    maxTokens: 4000,
  });
  return normalizeParagraphDiagnosis(safeJsonParse(text || '', null));
}

const thesisOptionsSchema = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['mirror', 'pivot', 'risk'] },
          description: { type: 'string' },
          thesis: { type: 'string' },
        },
        required: ['type', 'description', 'thesis'],
      },
    },
  },
  required: ['options'],
};

export async function distillThesis(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: DistillThesisInput,
): Promise<ThesisOption[]> {
  const prompt = [
    input.config.doctorDistillThesisPrompt,
    '',
    '### DRAFT TEXT ###',
    input.text,
    '',
    'Return ONLY the JSON object defined by the schema (an "options" array of exactly three: mirror, pivot, risk).',
  ].join('\n');
  const text = await client.generateText({
    model,
    prompt,
    systemInstruction: input.config.doctorSystemPrompt,
    json: true,
    responseJsonSchema: thesisOptionsSchema,
    thinkingBudget,
    maxTokens: 4000,
  });
  return normalizeThesisOptions(safeJsonParse(text || '', null));
}

export async function runDoctorReport(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: DoctorReportInput,
): Promise<string> {
  const prompt = [
    input.config[REPORT_PROMPT_KEY[input.instrument]],
    '',
    `### SCOPE: ${input.scopeTitle} ###`,
    '',
    '### THESIS ###',
    input.thesis,
    '',
    '### REVERSE OUTLINE ###',
    input.outlineMarkdown,
    '',
    'Respond in markdown, following the output format described above. Cite paragraphs by their [n] numbers.',
  ].join('\n');
  const text = await client.generateText({
    model,
    prompt,
    systemInstruction: input.config.doctorSystemPrompt,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return (text || '').trim();
}
