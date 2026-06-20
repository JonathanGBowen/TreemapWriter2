// Glass Box revision generation, ported from JonathanGBowen/glassboxrevisions
// (services/promptBuilder.ts + geminiService.ts). Provider-agnostic: it composes
// the mode-specific system + task instructions, calls the injected LLMClient
// under a structured-output schema, and validates the response. Split out of
// ai-provider.impl.ts to keep that file under the line cap.

import { safeJsonParse } from '../../lib/utils';
import { normalizeRevisions } from '../../lib/revision-helpers';
import type { GenerateRevisionsInput } from '../ai-provider';
import type { RevisionProposal, SourceDocument } from '../../types';
import type { LLMClient } from './clients';

// The revision SYSTEM instruction is the user-editable one
// (config.generateRevisionsPrompt); the assembly system + the three task
// instructions are engine internals ("do not soften these") — locked registry
// entries pulled by key, not per-project overridable.
import { getPromptText } from '../prompts';

const MAX_OUTPUT_TOKENS = 16000;

const REVISION_TYPES = [
  'Addition',
  'Replacement',
  'Deletion',
  'Rewording',
  'Citation',
  'Tone Adjustment',
  'Flow Improvement',
  'Assembly',
];

/**
 * Structured-output schema (the engine's zod schema, as JSON Schema). Gemini is
 * constrained to this exact shape, so proposals always come back with the right
 * field names — the reliable approach the prototype's bare JSON mode lacked.
 *
 * Built per-call: in SOURCELESS mode there is no source to cite, so `source_id`
 * and `verbatim_source_quote` drop out of the required set (the glass-box receipt
 * is conditional — see normalizeRevisions). Sourced passes keep all eight fields.
 */
const revisionsJsonSchema = (sourceless: boolean) => {
  const required = [
    'section',
    'revision_type',
    'original_text',
    'proposed_text',
    'rationale',
    'confidence_score',
  ];
  if (!sourceless) required.push('source_id', 'verbatim_source_quote');
  return {
    type: 'object',
    properties: {
      proposals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section: { type: 'string' },
            revision_type: { type: 'string', enum: REVISION_TYPES },
            original_text: { type: 'string' },
            proposed_text: { type: 'string' },
            rationale: { type: 'string' },
            source_id: { type: 'string' },
            verbatim_source_quote: { type: 'string' },
            confidence_score: { type: 'number' },
          },
          required,
        },
      },
    },
    required: ['proposals'],
  };
};

const formatSources = (sources: SourceDocument[]): string =>
  sources.length
    ? sources
        .map(
          (s) =>
            `--- [Source ID: ${s.id}] ${s.label} (${s.kind}) ---\n${s.content}`,
        )
        .join('\n\n')
    : '(none provided)';

/**
 * Compose the task instruction + DIRECTIVE + MASTER_DOCUMENT + (sources | instruction).
 * Sourced mode appends the SOURCE_DOCUMENTS block and the verbatim-receipt demand;
 * sourceless mode appends the INSTRUCTION block and tells the model to ground in
 * the document itself with no source to cite.
 */
const buildUserPrompt = (
  task: string,
  input: GenerateRevisionsInput,
  sourceless: boolean,
  instruction: string,
): string => {
  const head = [
    task,
    '',
    '### REVISION_DIRECTIVE ###',
    input.directive.trim() ||
      '(No explicit directive — apply the engine principles to improve this section.)',
    '',
    '### MASTER_DOCUMENT ###',
    input.sectionText,
    '',
  ];
  if (sourceless) {
    return [
      ...head,
      '### INSTRUCTION ###',
      instruction,
      '',
      'Return ONLY the JSON object defined by the schema (a "proposals" array). For each proposal: original_text MUST be an exact verbatim substring of the MASTER_DOCUMENT. There are NO source documents — ground each proposal in the MASTER_DOCUMENT itself per the INSTRUCTION, put your justification in rationale, and leave source_id and verbatim_source_quote empty. Do not invent quotations.',
    ].join('\n');
  }
  return [
    ...head,
    '### SOURCE_DOCUMENTS ###',
    formatSources(input.sources),
    '',
    'Return ONLY the JSON object defined by the schema (a "proposals" array). For each proposal: original_text MUST be an exact verbatim substring of the MASTER_DOCUMENT; verbatim_source_quote MUST be copied exactly from one SOURCE_DOCUMENT, and source_id MUST be that source\'s ID.',
  ].join('\n');
};

export async function generateRevisions(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: GenerateRevisionsInput,
): Promise<RevisionProposal[]> {
  const assembly = input.mode === 'assembly';
  // Sourceless = no sources to cite. Assembly always works FROM sources (UI-gated),
  // so sourceless only changes the standard revision task; the receipt relaxes
  // either way (see normalizeRevisions / revisionsJsonSchema).
  const sourceless = input.sources.length === 0;
  const instruction = input.instruction?.trim() || getPromptText('revisionInstructionDefault');
  // System instruction by mode; task instruction by mode + sourceless + assembly sub-mode.
  const systemInstruction = assembly
    ? getPromptText('revisionAssemblySystem')
    : input.config.generateRevisionsPrompt;
  const task = !assembly
    ? sourceless
      ? getPromptText('revisionTaskSourceless')
      : getPromptText('revisionTask')
    : input.subMode === 'verbatim'
      ? getPromptText('revisionAssemblyVerbatimTask')
      : getPromptText('revisionAssemblyWovenTask');

  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(task, input, sourceless, instruction),
    systemInstruction,
    json: true,
    responseJsonSchema: revisionsJsonSchema(sourceless),
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const proposals = normalizeRevisions(safeJsonParse(text || '', null), {
    sectionLabel: input.sectionTitle,
    fallbackSourceId: input.sources.length === 1 ? input.sources[0].id : undefined,
    sourceless,
  });
  if (proposals === null) {
    // Surface the raw response so an unparseable shape is diagnosable in devtools.
    console.warn('[generateRevisions] unparseable model response:', (text || '').slice(0, 2000));
    throw new Error('Revision proposals could not be parsed.');
  }
  if (proposals.length === 0) {
    // Distinguish "model genuinely returned none" from "every item was filtered".
    console.warn('[generateRevisions] no usable proposals. Raw response:', (text || '').slice(0, 2000));
  }
  return proposals;
}
