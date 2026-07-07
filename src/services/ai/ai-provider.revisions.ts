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
 * Built per-call: the glass-box receipt (`source_id` + `verbatim_source_quote`) is
 * in the required set only when `receiptRequired` — i.e. Assembly / Citations. In
 * revision mode it is optional per-proposal (intrinsic edits carry no receipt; see
 * normalizeRevisions), so those two fields drop out of `required`.
 */
export const revisionsJsonSchema = (receiptRequired: boolean) => {
  const required = [
    'section',
    'revision_type',
    'original_text',
    'proposed_text',
    'rationale',
    'confidence_score',
  ];
  if (receiptRequired) required.push('source_id', 'verbatim_source_quote');
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

export const formatSources = (sources: SourceDocument[]): string =>
  sources.length
    ? sources
        .map(
          (s) =>
            `--- [Source ID: ${s.id}] ${s.label} — role: ${s.role} (${s.kind}) ---\n${s.content}`,
        )
        .join('\n\n')
    : '(none provided)';

// The verbatim-receipt demand for a strictly-receipted pass (Assembly / Citations):
// EVERY proposal must carry a source receipt.
export const STRICT_RECEIPT_TAIL =
  'Return ONLY the JSON object defined by the schema (a "proposals" array). For each proposal: original_text MUST be an exact verbatim substring of the MASTER_DOCUMENT; verbatim_source_quote MUST be copied exactly from one SOURCE_DOCUMENT, and source_id MUST be that source\'s ID.';

// Revision mode WITH sources: a mixed pass. Each source carries a ROLE (see the
// SOURCE_DOCUMENTS header lines) that governs how to use it; a proposal may be
// source-derived (carries a receipt) or intrinsic (no receipt).
const MIXED_RECEIPT_TAIL =
  'Return ONLY the JSON object defined by the schema (a "proposals" array). Each source is tagged with a ROLE that governs how you use it — treat each per its role exactly as your task instructions describe. A proposal is one of two kinds: (a) SOURCE-DERIVED — it draws on a reference/bibliographic source, so it MUST carry that source\'s id in source_id and a verbatim_source_quote copied EXACTLY from that source, and (when it integrates a claim from the work) an APA in-text citation in proposed_text; or (b) INTRINSIC — a flow/tone/consistency edit or an application of guidance, grounded in the MASTER_DOCUMENT itself, which leaves source_id and verbatim_source_quote empty and puts its justification in rationale. In every proposal original_text MUST be an exact verbatim substring of the MASTER_DOCUMENT. Never invent a quotation, a citation, or a page number.';

// Revision mode WITHOUT sources: ground in the document itself, no receipts.
const SOURCELESS_TAIL =
  'Return ONLY the JSON object defined by the schema (a "proposals" array). For each proposal: original_text MUST be an exact verbatim substring of the MASTER_DOCUMENT. There are NO source documents — ground each proposal in the MASTER_DOCUMENT itself per the INSTRUCTION, put your justification in rationale, and leave source_id and verbatim_source_quote empty. Do not invent quotations.';

/**
 * Compose the task instruction + DIRECTIVE + MASTER_DOCUMENT + (sources | instruction).
 * Three shapes: sourceless revision grounds in the document itself (INSTRUCTION
 * block, no receipts); sourced revision is a mixed pass (SOURCE_DOCUMENTS block,
 * per-proposal receipts, role-aware); strictly-receipted modes (Assembly /
 * Citations) demand a receipt on every proposal.
 */
const buildUserPrompt = (
  task: string,
  input: GenerateRevisionsInput,
  hasSources: boolean,
  receiptRequired: boolean,
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
  if (!hasSources) {
    return [...head, '### INSTRUCTION ###', instruction, '', SOURCELESS_TAIL].join('\n');
  }
  return [
    ...head,
    '### SOURCE_DOCUMENTS ###',
    formatSources(input.sources),
    '',
    receiptRequired ? STRICT_RECEIPT_TAIL : MIXED_RECEIPT_TAIL,
  ].join('\n');
};

/** The user-editable (revision) or locked (assembly/citations) system instruction, by mode. */
const systemInstructionFor = (input: GenerateRevisionsInput): string => {
  if (input.mode === 'citations') return getPromptText('citationsSystem');
  if (input.mode === 'assembly') return getPromptText('revisionAssemblySystem');
  return input.config.generateRevisionsPrompt;
};

/** The locked task instruction, by mode + sourceless + assembly sub-mode. */
const taskFor = (input: GenerateRevisionsInput, sourceless: boolean): string => {
  if (input.mode === 'citations') return getPromptText('citationsTask');
  if (input.mode === 'assembly') {
    return getPromptText(
      input.subMode === 'verbatim' ? 'revisionAssemblyVerbatimTask' : 'revisionAssemblyWovenTask',
    );
  }
  return getPromptText(sourceless ? 'revisionTaskSourceless' : 'revisionTask');
};

export async function generateRevisions(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: GenerateRevisionsInput,
): Promise<RevisionProposal[]> {
  // Two ORTHOGONAL flags, split apart so a mixed revision pass works:
  //  - hasSources drives PROMPT ASSEMBLY (SOURCE_DOCUMENTS vs INSTRUCTION block,
  //    and which task .md — sourced vs sourceless).
  //  - receiptRequired drives the RECEIPT CONTRACT (schema `required` set + the
  //    normalizer's drop rule). Only Assembly + Citations are strict; revision mode
  //    is per-proposal (intrinsic edits carry no receipt) whether or not sources
  //    are present.
  const hasSources = input.sources.length > 0;
  const receiptRequired = input.mode === 'assembly' || input.mode === 'citations';
  const instruction = input.instruction?.trim() || getPromptText('revisionInstructionDefault');
  const systemInstruction = systemInstructionFor(input);
  const task = taskFor(input, !hasSources);

  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(task, input, hasSources, receiptRequired, instruction),
    systemInstruction,
    json: true,
    responseJsonSchema: revisionsJsonSchema(receiptRequired),
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const proposals = normalizeRevisions(safeJsonParse(text || '', null), {
    sectionLabel: input.sectionTitle,
    fallbackSourceId: input.sources.length === 1 ? input.sources[0].id : undefined,
    receiptRequired,
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
