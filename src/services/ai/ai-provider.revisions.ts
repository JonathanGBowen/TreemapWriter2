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

// The engine's prompt strings as content artifacts (one .md each). The revision
// SYSTEM instruction is the user-editable one (config.generateRevisionsPrompt);
// the assembly system + the three task instructions are engine internals
// ("do not soften these") imported raw.
import assemblySystemInstruction from '../prompts/revision-assembly-system.md?raw';
import revisionTask from '../prompts/revision-task.md?raw';
import assemblyVerbatimTask from '../prompts/revision-assembly-verbatim-task.md?raw';
import assemblyWovenTask from '../prompts/revision-assembly-woven-task.md?raw';

const MAX_OUTPUT_TOKENS = 16000;
const SECTION_TEXT_CAP = 24000;
const SOURCE_CONTENT_CAP = 8000;

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
 */
const REVISIONS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          revision_type: { type: 'string', enum: REVISION_TYPES },
          original_text: { type: 'string' },
          proposed_text: { type: 'string' },
          rationale: { type: 'string' },
          source_id: { type: 'string' },
          verbatim_source_quote: { type: 'string' },
          confidence_score: { type: 'number' },
        },
        required: [
          'revision_type',
          'original_text',
          'proposed_text',
          'rationale',
          'source_id',
          'verbatim_source_quote',
          'confidence_score',
        ],
      },
    },
  },
  required: ['proposals'],
};

const formatSources = (sources: SourceDocument[]): string =>
  sources.length
    ? sources
        .map(
          (s) =>
            `--- [Source ID: ${s.id}] ${s.label} (${s.kind}) ---\n${s.content.slice(0, SOURCE_CONTENT_CAP)}`,
        )
        .join('\n\n')
    : '(none provided)';

/** Compose the task instruction + DIRECTIVE + MASTER_DOCUMENT + SOURCE_DOCUMENTS. */
const buildUserPrompt = (task: string, input: GenerateRevisionsInput): string =>
  [
    task,
    '',
    '### REVISION_DIRECTIVE ###',
    input.directive.trim() ||
      '(No explicit directive — apply the engine principles to improve this section.)',
    '',
    '### MASTER_DOCUMENT ###',
    input.sectionText.slice(0, SECTION_TEXT_CAP),
    '',
    '### SOURCE_DOCUMENTS ###',
    formatSources(input.sources),
    '',
    'Return ONLY the JSON object defined by the schema (a "proposals" array). For each proposal: original_text MUST be an exact verbatim substring of the MASTER_DOCUMENT; verbatim_source_quote MUST be copied exactly from one SOURCE_DOCUMENT, and source_id MUST be that source\'s ID.',
  ].join('\n');

export async function generateRevisions(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: GenerateRevisionsInput,
): Promise<RevisionProposal[]> {
  const assembly = input.mode === 'assembly';
  // System instruction by mode; task instruction by mode + assembly sub-mode.
  const systemInstruction = assembly
    ? assemblySystemInstruction
    : input.config.generateRevisionsPrompt;
  const task = !assembly
    ? revisionTask
    : input.subMode === 'verbatim'
      ? assemblyVerbatimTask
      : assemblyWovenTask;

  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(task, input),
    systemInstruction,
    json: true,
    responseJsonSchema: REVISIONS_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const proposals = normalizeRevisions(safeJsonParse(text || '', null), {
    sectionLabel: input.sectionTitle,
    fallbackSourceId: input.sources.length === 1 ? input.sources[0].id : undefined,
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
