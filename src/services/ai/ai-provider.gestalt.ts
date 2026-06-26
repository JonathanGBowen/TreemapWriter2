// Gestalt whole/part flows (Phase 2). Two provider-agnostic, non-streaming JSON
// calls that operate on a section as a PART of its whole:
//   - reconstructWhole — the "Beethoven test": reconstruct the document's claim
//     from one section's prose alone, then compare to the actual claim (drift).
//   - proposeRecenterings — the unstick move: alternative structural centerings
//     of the section + the "question the goal" beat.
// Both mirror ai-provider.regenerate.ts: compose a prompt, call the injected
// LLMClient under a structured-output schema, tolerantly parse, return null on
// junk (the caller toasts; nothing is silently fabricated). See
// docs/gestalt-design-II.md L3(a) and L4.

import { safeJsonParse } from '../../lib/utils';
import type { ReconstructWholeInput, RecenterInput } from '../ai-provider';
import type {
  RecenteringOption,
  RecenteringsResult,
  WholeFromPartResult,
} from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 4000;

const asTrimmed = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// --- the Beethoven test --------------------------------------------------

const WHOLE_ALIGNMENTS = ['aligned', 'partial', 'adrift', 'no-baseline'] as const;

const wholeFromPartJsonSchema = {
  type: 'object',
  properties: {
    reconstructedClaim: { type: 'string' },
    alignment: { type: 'string', enum: ['aligned', 'partial', 'adrift', 'no-baseline'] },
    divergence: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['reconstructedClaim', 'alignment'],
};

const buildReconstructPrompt = (input: ReconstructWholeInput): string => {
  const hasBaseline = Boolean(input.documentClaim?.trim());
  const parts: string[] = [
    `### SECTION (this part, read ALONE) — "${input.sectionTitle}" ###`,
    input.sectionText,
    '',
    'TASK: Working ONLY from the section above — as if it were the one fragment of the',
    'work you possess — reconstruct what the WHOLE document is most likely arguing: its',
    'single overarching claim, as you would infer it from this part alone.',
    '',
  ];
  if (hasBaseline) {
    parts.push(
      "### THE DOCUMENT'S ACTUAL MAIN CLAIM (for comparison only — do not let it color the",
      'reconstruction you make above) ###',
      input.documentClaim!.trim(),
      '',
      'Then compare your reconstruction to the actual claim and set "alignment": "aligned"',
      '(this part clearly carries the whole), "partial" (it points the right way but the',
      'emphasis or center of gravity has shifted), or "adrift" (from this part you would',
      'infer a different whole — the part has drifted). When not "aligned", give "divergence":',
      'one concrete sentence on how the part pulls away from the whole.',
    );
  } else {
    parts.push('No baseline claim is available; set "alignment": "no-baseline" and omit divergence.');
  }
  if (input.structuralEvidence?.trim()) {
    parts.push(
      '',
      '### STRUCTURAL WEIGHT (use ONLY to gauge how much a drift MATTERS — never to shape the',
      'reconstruction above) ###',
      input.structuralEvidence.trim(),
    );
  }
  parts.push('', 'Return ONLY the JSON object defined by the schema.');
  return parts.join('\n');
};

function normalizeWholeFromPart(raw: unknown, hasBaseline: boolean): WholeFromPartResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const reconstructedClaim = asTrimmed(rec.reconstructedClaim);
  if (!reconstructedClaim) return null;
  const rawAlignment = rec.alignment;
  const alignment: WholeFromPartResult['alignment'] = !hasBaseline
    ? 'no-baseline'
    : WHOLE_ALIGNMENTS.includes(rawAlignment as WholeFromPartResult['alignment']) && rawAlignment !== 'no-baseline'
      ? (rawAlignment as WholeFromPartResult['alignment'])
      : 'partial';
  const divergence = alignment === 'aligned' || alignment === 'no-baseline' ? undefined : asTrimmed(rec.divergence) || undefined;
  const note = asTrimmed(rec.note) || undefined;
  return { reconstructedClaim, alignment, divergence, note };
}

export async function reconstructWhole(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: ReconstructWholeInput,
): Promise<WholeFromPartResult | null> {
  const text = await client.generateText({
    model,
    prompt: buildReconstructPrompt(input),
    systemInstruction: input.config.reconstructWholePrompt,
    json: true,
    responseJsonSchema: wholeFromPartJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const result = normalizeWholeFromPart(safeJsonParse(text || '', null), Boolean(input.documentClaim?.trim()));
  if (!result) {
    console.warn('[reconstructWhole] unusable model response:', (text || '').slice(0, 1000));
    return null;
  }
  return result;
}

// --- the recentering / question-the-goal move ----------------------------

const recenteringsJsonSchema = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          center: { type: 'string' },
          rationale: { type: 'string' },
          whatChanges: { type: 'string' },
        },
        required: ['center', 'rationale', 'whatChanges'],
      },
    },
    questionTheGoal: { type: 'string' },
  },
  required: ['options', 'questionTheGoal'],
};

const buildRecenterPrompt = (input: RecenterInput): string => {
  const parts: string[] = [`### SECTION — "${input.sectionTitle}" ###`];
  if (input.currentFunction) parts.push(`CURRENT FUNCTION: ${input.currentFunction}`);
  if (input.currentClaim) parts.push(`CURRENT MAIN CLAIM: ${input.currentClaim}`);
  if (input.requiredMoves?.length) {
    parts.push('CURRENT REQUIRED MOVES:', ...input.requiredMoves.map((m) => `  - ${m}`));
  }
  parts.push('');
  if (input.structuralSurround?.trim()) {
    parts.push(input.structuralSurround.trim(), '');
  }
  if (input.structuralEvidence?.trim()) {
    parts.push(
      '### STRUCTURAL EVIDENCE (the dependency topology, read off the direction of the arrows —',
      "let it inform which recentering serves the whole) ###",
      input.structuralEvidence.trim(),
      '',
    );
  }
  parts.push(
    '### SECTION TEXT ###',
    input.sectionText,
    '',
    'TASK: Propose 2–3 alternative structural CENTERINGS of this section — different points',
    'its parts could organize around — that may serve the whole better than the current one.',
    'For each: "center" (the new center of gravity, one phrase), "rationale" (why it may fit',
    'the whole better), "whatChanges" (what the section\'s parts do differently under it).',
    'Then "questionTheGoal": one sentence asking whether this section\'s goal itself is right',
    'for the whole — name the alternative goal if the current one may be the wrong target.',
    '',
    'Return ONLY the JSON object defined by the schema.',
  );
  return parts.join('\n');
};

function normalizeRecenterings(raw: unknown): RecenteringsResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const options: RecenteringOption[] = Array.isArray(rec.options)
    ? rec.options
        .map((o): RecenteringOption | null => {
          if (!o || typeof o !== 'object') return null;
          const r = o as Record<string, unknown>;
          const center = asTrimmed(r.center);
          const rationale = asTrimmed(r.rationale);
          const whatChanges = asTrimmed(r.whatChanges);
          return center && rationale && whatChanges ? { center, rationale, whatChanges } : null;
        })
        .filter((o): o is RecenteringOption => o !== null)
    : [];
  const questionTheGoal = asTrimmed(rec.questionTheGoal);
  if (options.length === 0 && !questionTheGoal) return null;
  return { options, questionTheGoal };
}

export async function proposeRecenterings(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: RecenterInput,
): Promise<RecenteringsResult | null> {
  const text = await client.generateText({
    model,
    prompt: buildRecenterPrompt(input),
    systemInstruction: input.config.recenterPrompt,
    json: true,
    responseJsonSchema: recenteringsJsonSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const result = normalizeRecenterings(safeJsonParse(text || '', null));
  if (!result) {
    console.warn('[proposeRecenterings] unusable model response:', (text || '').slice(0, 1000));
    return null;
  }
  return result;
}

// Exported for unit tests of the tolerant parsers.
export const __test = { normalizeWholeFromPart, normalizeRecenterings };
