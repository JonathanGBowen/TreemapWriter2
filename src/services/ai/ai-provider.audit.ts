// Per-source citation audit — one focused engine call per source, the unit the
// batch audit loops over. Reuses the Citations doctrine wholesale (the locked
// citationsSystem instruction, the strict receipt contract, the shared schema)
// but swaps the task for a single-source deep read: reconstruct what THIS source
// claims, then assess the document's usage — and non-usage — of it, proposing
// only surgical, minimal edits. Provider-agnostic, mirroring ai-provider.revisions.

import { safeJsonParse } from '../../lib/utils';
import { normalizeRevisions } from '../../lib/revision-helpers';
import type { AuditSourceUsageInput } from '../ai-provider';
import type { RevisionProposal } from '../../types';
import type { LLMClient } from './clients';
import { getPromptText } from '../prompts';
import { STRICT_RECEIPT_TAIL, formatSources, revisionsJsonSchema } from './ai-provider.revisions';

const MAX_OUTPUT_TOKENS = 16000;

export async function auditSourceUsage(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: AuditSourceUsageInput,
): Promise<RevisionProposal[]> {
  const prompt = [
    getPromptText('citationsAuditTask'),
    '',
    '### REVISION_DIRECTIVE ###',
    input.directive?.trim() || '(No explicit directive — audit everything the task describes.)',
    '',
    '### MASTER_DOCUMENT ###',
    input.documentText,
    '',
    '### SOURCE_DOCUMENTS ###',
    formatSources([input.source]),
    '',
    STRICT_RECEIPT_TAIL,
  ].join('\n');

  const text = await client.generateText({
    model,
    prompt,
    systemInstruction: getPromptText('citationsSystem'),
    json: true,
    responseJsonSchema: revisionsJsonSchema(true),
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  // Strict receipts; the single attached source is a SAFE fallback attribution
  // (every surviving proposal carries a verbatim quote, which can only be from it).
  const proposals = normalizeRevisions(safeJsonParse(text || '', null), {
    sectionLabel: input.documentTitle,
    fallbackSourceId: input.source.id,
    receiptRequired: true,
  });
  if (proposals === null) {
    console.warn('[auditSourceUsage] unparseable model response:', (text || '').slice(0, 2000));
    throw new Error(`The audit of "${input.source.label}" could not be parsed.`);
  }
  // An empty array is a GOOD outcome here (the source is used well, or genuinely
  // irrelevant) — the orchestrator records it as done/0, never as an error.
  return proposals;
}
