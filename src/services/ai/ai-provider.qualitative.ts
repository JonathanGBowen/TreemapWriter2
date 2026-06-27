// Deweyan qualitative flows. Three provider-agnostic, non-streaming JSON calls
// grown from Dewey's "Qualitative Thought" (1930). Where ai-provider.gestalt.ts
// holds the whole as STRUCTURE, these hold it as the felt PERVASIVE QUALITY that,
// for Dewey, grounds and regulates structure:
//   - readPervasiveQuality — the document's qualitative signature (the "ground"):
//     indicate, never state, the quality running through the whole.
//   - readPartQuality — the "Goya test": from a section's prose alone, read the
//     quality it carries and judge whether it BELONGS to the whole's quality
//     (assimilation before similarity), independent of the structural Beethoven test.
//   - articulateTrouble — the "felt before stated" ramp: convert a writer's
//     pre-articulate felt trouble into a located gap → vector.
// All mirror ai-provider.gestalt.ts: compose a prompt, call the injected LLMClient
// under a structured-output schema, tolerantly parse, return null on junk (the
// caller toasts; nothing is silently fabricated). See docs/dewey-design.md.

import { safeJsonParse } from '../../lib/utils';
import type {
  ReadPervasiveQualityInput,
  ReadPartQualityInput,
  ArticulateTroubleInput,
} from '../ai-provider';
import type {
  QualitativeSignatureResult,
  PartQualityResult,
  NextAction,
} from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 4000;

const asTrimmed = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const asPhrases = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(asTrimmed).filter(Boolean);
  return out.length ? out : undefined;
};

// --- the qualitative signature (the "ground") -----------------------------

const qualitativeSignatureJsonSchema = {
  type: 'object',
  properties: {
    quality: { type: 'string' },
    registers: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
  required: ['quality'],
};

const buildPervasiveQualityPrompt = (input: ReadPervasiveQualityInput): string => {
  const parts: string[] = [];
  if (input.documentTitle?.trim()) parts.push(`### DOCUMENT — "${input.documentTitle.trim()}" ###`);
  else parts.push('### DOCUMENT ###');
  parts.push(
    input.documentText,
    '',
    'TASK: Read the whole above for its PERVASIVE QUALITY — the felt tone and temper running',
    'through it. Give a CLUE to that quality, not a summary or a restatement of its thesis.',
    '',
    'Return ONLY the JSON object defined by the schema.',
  );
  return parts.join('\n');
};

function normalizeQualitativeSignature(raw: unknown): QualitativeSignatureResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const quality = asTrimmed(rec.quality);
  if (!quality) return null;
  return { quality, registers: asPhrases(rec.registers), note: asTrimmed(rec.note) || undefined };
}

export async function readPervasiveQuality(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: ReadPervasiveQualityInput,
): Promise<QualitativeSignatureResult | null> {
  const text = await client.generateText({
    model,
    prompt: buildPervasiveQualityPrompt(input),
    systemInstruction: input.config.readPervasiveQualityPrompt,
    json: true,
    responseJsonSchema: qualitativeSignatureJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const result = normalizeQualitativeSignature(safeJsonParse(text || '', null));
  if (!result) {
    console.warn('[readPervasiveQuality] unusable model response:', (text || '').slice(0, 1000));
    return null;
  }
  return result;
}

// --- the Goya test --------------------------------------------------------

const BELONGINGS = ['belongs', 'shifted', 'alien', 'no-baseline'] as const;

const partQualityJsonSchema = {
  type: 'object',
  properties: {
    partQuality: { type: 'string' },
    belonging: { type: 'string', enum: ['belongs', 'shifted', 'alien', 'no-baseline'] },
    divergence: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['partQuality', 'belonging'],
};

const buildPartQualityPrompt = (input: ReadPartQualityInput): string => {
  const hasBaseline = Boolean(input.documentQuality?.trim());
  const parts: string[] = [
    `### SECTION (this part, read ALONE) — "${input.sectionTitle}" ###`,
    input.sectionText,
    '',
    'TASK: Read this part for the PERVASIVE QUALITY it carries — its felt tone — as a clue,',
    'not a summary.',
    '',
  ];
  if (hasBaseline) {
    parts.push(
      "### THE DOCUMENT'S PERVASIVE QUALITY (the whole's qualitative signature, for the",
      'belonging judgment — does this part belong to THIS quality?) ###',
      input.documentQuality!.trim(),
      '',
      'Then judge "belonging": "belongs" (suffused with the same quality), "shifted" (the',
      'family resemblance is there but the tone has drifted), or "alien" (it reads as a',
      'different whole). When not "belongs", give "divergence": one concrete sentence on how',
      'the part\'s quality pulls away from the whole\'s.',
    );
  } else {
    parts.push('No qualitative signature is available; set "belonging": "no-baseline" and omit divergence.');
  }
  parts.push('', 'Return ONLY the JSON object defined by the schema.');
  return parts.join('\n');
};

function normalizePartQuality(raw: unknown, hasBaseline: boolean): PartQualityResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const partQuality = asTrimmed(rec.partQuality);
  if (!partQuality) return null;
  const rawBelonging = rec.belonging;
  const belonging: PartQualityResult['belonging'] = !hasBaseline
    ? 'no-baseline'
    : BELONGINGS.includes(rawBelonging as PartQualityResult['belonging']) && rawBelonging !== 'no-baseline'
      ? (rawBelonging as PartQualityResult['belonging'])
      : 'shifted';
  const divergence = belonging === 'belongs' || belonging === 'no-baseline' ? undefined : asTrimmed(rec.divergence) || undefined;
  const note = asTrimmed(rec.note) || undefined;
  return { partQuality, belonging, divergence, note };
}

export async function readPartQuality(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: ReadPartQualityInput,
): Promise<PartQualityResult | null> {
  const text = await client.generateText({
    model,
    prompt: buildPartQualityPrompt(input),
    systemInstruction: input.config.readPartQualityPrompt,
    json: true,
    responseJsonSchema: partQualityJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const result = normalizePartQuality(safeJsonParse(text || '', null), Boolean(input.documentQuality?.trim()));
  if (!result) {
    console.warn('[readPartQuality] unusable model response:', (text || '').slice(0, 1000));
    return null;
  }
  return result;
}

// --- the "felt before stated" ramp ----------------------------------------

const articulateTroubleJsonSchema = {
  type: 'object',
  properties: {
    gap: { type: 'string' },
    location: { type: 'string' },
    vector: { type: 'string' },
  },
  required: ['gap', 'vector'],
};

const buildArticulateTroublePrompt = (input: ArticulateTroubleInput): string => {
  const parts: string[] = [
    `### SECTION — "${input.sectionTitle}" ###`,
    '',
    "### THE WRITER'S FELT TROUBLE (pre-articulate — take it as real data, a clue to a",
    'pervasive quality in the section) ###',
    input.feltNote,
    '',
  ];
  if (input.structuralSurround?.trim()) {
    parts.push(input.structuralSurround.trim(), '');
  }
  parts.push(
    '### SECTION TEXT ###',
    input.sectionText,
    '',
    'TASK: Convert the felt trouble into ONE located gap → vector, faithful to what the',
    'feeling gestures at. Honor the note; do not substitute a generic critique.',
    '',
    'Return ONLY the JSON object defined by the schema.',
  );
  return parts.join('\n');
};

function normalizeArticulatedTrouble(raw: unknown): NextAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const gap = asTrimmed(rec.gap);
  const vector = asTrimmed(rec.vector);
  if (!gap || !vector) return null;
  const location = asTrimmed(rec.location) || undefined;
  return { gap, vector, location };
}

export async function articulateTrouble(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: ArticulateTroubleInput,
): Promise<NextAction | null> {
  const text = await client.generateText({
    model,
    prompt: buildArticulateTroublePrompt(input),
    systemInstruction: input.config.articulateTroublePrompt,
    json: true,
    responseJsonSchema: articulateTroubleJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const result = normalizeArticulatedTrouble(safeJsonParse(text || '', null));
  if (!result) {
    console.warn('[articulateTrouble] unusable model response:', (text || '').slice(0, 1000));
    return null;
  }
  return result;
}

// Exported for unit tests of the tolerant parsers.
export const __test = { normalizeQualitativeSignature, normalizePartQuality, normalizeArticulatedTrouble };
