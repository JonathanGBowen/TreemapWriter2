// "Suggest a directive" — ported from glassboxrevisions (SUGGESTION_PERSONA_TEMPLATE
// + DirectiveSuggestionSchema). A persona-flavored pass that proposes 2–3 distinct
// strategic directives for revising the current section. Provider-agnostic: composes
// the template, calls the LLMClient under a structured-output schema, validates.

import { safeJsonParse } from '../../lib/utils';
import { normalizeDirectiveSuggestions } from '../../lib/revision-helpers';
import type { SuggestDirectivesInput } from '../ai-provider';
import type { DirectiveSuggestion, SourceDocument } from '../../types';
import type { LLMClient } from './clients';

import template from '../prompts/suggest-directives.md?raw';

const MAX_OUTPUT_TOKENS = 4000;
const SECTION_TEXT_CAP = 24000;
const SOURCE_CONTENT_CAP = 6000;

const DIRECTIVES_JSON_SCHEMA = {
  type: 'object',
  properties: {
    directives: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, directive: { type: 'string' } },
        required: ['title', 'directive'],
      },
    },
  },
  required: ['directives'],
};

const sourceContext = (hasSources: boolean): string =>
  hasSources
    ? 'You also have SOURCE DOCUMENTS below. Ground your directives in the gaps between the Master Document and these sources.'
    : 'No source documents are provided; base your directives on the Master Document itself.';

const formatSources = (sources: SourceDocument[]): string =>
  sources.length
    ? sources
        .map((s) => `--- [${s.label}] ---\n${s.content.slice(0, SOURCE_CONTENT_CAP)}`)
        .join('\n\n')
    : '(none)';

export async function suggestDirectives(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: SuggestDirectivesInput,
): Promise<DirectiveSuggestion[]> {
  const hasSources = input.sources.length > 0;
  const systemInstruction = template
    .replace('{{PERSONA_NAME}}', input.personaName || 'Academic Advisor')
    .replace('{{PERSONA_DESCRIPTION}}', input.personaInstruction || 'A rigorous academic editor.')
    .replace('{{SOURCE_CONTEXT_INSTRUCTION}}', sourceContext(hasSources));

  const prompt = [
    `### SECTION ###\n${input.sectionTitle}`,
    '',
    '### MASTER_DOCUMENT ###',
    input.sectionText.slice(0, SECTION_TEXT_CAP),
    '',
    '### SOURCE_DOCUMENTS ###',
    formatSources(input.sources),
  ].join('\n');

  const text = await client.generateText({
    model,
    prompt,
    systemInstruction,
    json: true,
    responseJsonSchema: DIRECTIVES_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const out = normalizeDirectiveSuggestions(safeJsonParse(text || '', null));
  if (out === null) {
    console.warn('[suggestDirectives] unparseable model response:', (text || '').slice(0, 1500));
    throw new Error('Directive suggestions could not be parsed.');
  }
  return out;
}
