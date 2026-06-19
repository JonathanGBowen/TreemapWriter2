// Version Compare: an exegetical A/B evaluation of two saved versions. Provider-
// agnostic — it composes the base compare instruction (user-editable) plus the
// optional lens, feeds both whole drafts under a structured-output schema, and
// validates the response. Split out of ai-provider.impl.ts to keep it small.
//
// Returns WHOLE (non-streaming): the result is one structured JSON object, which
// you cannot stream as readable prose. The UI shows a progress affordance, not
// token streaming (cf. STATUS / VISION — streaming is for prose, not JSON).

import { safeJsonParse } from '../../lib/utils';
import { normalizeComparison } from '../../lib/compareHelpers';
import { getPromptText } from '../prompts';
import type { CompareVersionsInput } from '../ai-provider';
import type { VersionComparison } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

const DIRECTIONS = ['improved', 'regressed', 'mixed', 'lateral'];

const CHANGE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    aspect: { type: 'string' },
    receipts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string' },
          side: { type: 'string', enum: ['a', 'b'] },
        },
        required: ['quote', 'side'],
      },
    },
  },
  required: ['summary', 'receipts'],
};

/** Draft-mode only: a neutral still-open-work item. Optional in the schema (omitted in 'final'). */
const OPEN_THREAD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    location: { type: 'string' },
  },
  required: ['summary'],
};

/** Structured-output schema mirroring `VersionComparison` (cf. REVISIONS_JSON_SCHEMA). */
const COMPARISON_JSON_SCHEMA = {
  type: 'object',
  properties: {
    direction: { type: 'string', enum: DIRECTIONS },
    verdict: { type: 'string' },
    conceptualDrift: { type: 'string' },
    improvements: { type: 'array', items: CHANGE_SCHEMA },
    losses: { type: 'array', items: CHANGE_SCHEMA },
    moveChanges: { type: 'array', items: CHANGE_SCHEMA },
    openThreads: { type: 'array', items: OPEN_THREAD_SCHEMA },
    sectionNotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sectionTitle: { type: 'string' },
          presentInA: { type: 'boolean' },
          presentInB: { type: 'boolean' },
          direction: { type: 'string', enum: DIRECTIONS },
          note: { type: 'string' },
        },
        required: ['sectionTitle', 'presentInA', 'presentInB', 'direction', 'note'],
      },
    },
  },
  required: ['direction', 'verdict', 'conceptualDrift', 'improvements', 'losses', 'moveChanges', 'sectionNotes'],
};

/** Base instruction + optional lens + alignment hint + the two labeled drafts. */
const buildComparePrompt = (input: CompareVersionsInput): string =>
  [
    // Draft mode (default): prepend the in-process overlay. 'final' prepends nothing.
    ...((input.mode ?? 'draft') === 'draft' ? [getPromptText('compareModeDraft'), ''] : []),
    input.config.compareVersionsPrompt,
    ...(input.lens
      ? ['', `ADOPT THIS PERSONA: ${input.lens.persona}`, `APPLY THIS COMPARISON LENS: ${input.lens.lens}`]
      : []),
    ...(input.sharedTitles && input.sharedTitles.length
      ? ['', `SECTIONS PRESENT IN BOTH VERSIONS (align and compare these directly): ${input.sharedTitles.join(' · ')}`]
      : []),
    '',
    `### VERSION A — ${input.labelA} (earlier) ###`,
    input.markdownA,
    '',
    `### VERSION B — ${input.labelB} (later) ###`,
    input.markdownB,
    '',
    'Return ONLY the JSON object defined by the schema. Every receipt quote MUST be copied verbatim from the version named in its "side" (a = VERSION A, b = VERSION B).',
  ].join('\n');

export async function compareVersions(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: CompareVersionsInput,
): Promise<VersionComparison> {
  const text = await client.generateText({
    model,
    prompt: buildComparePrompt(input),
    json: true,
    responseJsonSchema: COMPARISON_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const result = normalizeComparison(safeJsonParse(text || '', null));
  if (!result) {
    console.warn('[compareVersions] unparseable model response:', (text || '').slice(0, 2000));
    throw new Error('Version comparison could not be parsed.');
  }
  return result;
}
