// Parallel Editor flow #2 — the analogical paragraph rewrite. Provider-agnostic:
// it composes the strict analogy (ORIGINAL : FAITHFUL_BULLET :: EDITED_BULLET :
// REWRITE), calls the injected LLMClient under a structured-output schema, and
// returns a { original_text, proposed_text } pair that feeds applyProposal with
// zero adaptation. Split out of ai-provider.impl.ts to keep that file under the
// line cap (mirrors ai-provider.revisions.ts).

import { safeJsonParse } from '../../lib/utils';
import { normalizeParagraphRewrite } from '../../lib/parallel-helpers';
import type { RegenerateParagraphInput } from '../ai-provider';
import type { ParagraphRewrite } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 8000;

const paragraphRewriteJsonSchema = {
  type: 'object',
  properties: {
    original_text: { type: 'string' },
    proposed_text: { type: 'string' },
  },
  required: ['original_text', 'proposed_text'],
};

const buildUserPrompt = (input: RegenerateParagraphInput): string => {
  const insertion = input.originalParagraph.trim() === '';
  const parts: string[] = [`### SECTION: ${input.sectionTitle} ###`, ''];
  if (input.precedingContext?.trim()) {
    parts.push('### PRECEDING (context only — do not edit) ###', input.precedingContext, '');
  }
  parts.push(
    '### ORIGINAL_PARAGRAPH ###',
    insertion ? '(empty — this is an INSERTION; compose a new paragraph)' : input.originalParagraph,
    '',
    '### FAITHFUL_BULLET ###',
    input.faithfulBullet || '(none — insertion)',
    '',
    '### EDITED_BULLET ###',
    input.editedBullet,
    '',
  );
  if (input.followingContext?.trim()) {
    parts.push('### FOLLOWING (context only — do not edit) ###', input.followingContext, '');
  }
  parts.push(
    '### VOICE_INSTRUCTION ###',
    input.voiceInstruction,
    '',
    insertion
      ? 'Return ONLY the JSON object defined by the schema. Compose a NEW paragraph realizing the EDITED_BULLET in the established voice; return an empty original_text and the new paragraph as proposed_text.'
      : 'Return ONLY the JSON object defined by the schema. proposed_text is the minimal, voice-preserving rewrite of ORIGINAL_PARAGRAPH that realizes the EDITED_BULLET; original_text is ORIGINAL_PARAGRAPH copied verbatim.',
  );
  return parts.join('\n');
};

export async function regenerateParagraph(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: RegenerateParagraphInput,
): Promise<ParagraphRewrite | null> {
  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: input.config.regenerateParagraphPrompt,
    json: true,
    responseJsonSchema: paragraphRewriteJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  // null ⇒ no usable proposed_text. The caller leaves the row unchanged and
  // surfaces a toast; we never silently blank a paragraph.
  const rewrite = normalizeParagraphRewrite(safeJsonParse(text || '', null));
  if (!rewrite) {
    console.warn('[regenerateParagraph] unusable model response:', (text || '').slice(0, 1000));
    return null;
  }
  // The caller knows draftA[i]; pass it back as original_text so the splice is exact
  // even if the model paraphrased the original it was given.
  return { original_text: input.originalParagraph, proposed_text: rewrite.proposed_text };
}
