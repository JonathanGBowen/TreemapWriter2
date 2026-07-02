// Spec-anchored A/B whole-test flows. Two provider-agnostic, non-streaming JSON
// calls (cf. ai-provider.compare.ts + ai-provider.gestalt.ts):
//   - runSpecTestSection — score ONE section's prose A vs B against the HELD
//     rubric, move by move (with the L1 productive/recapitulative axis), judged as
//     a PART via the mandatory structural surround. The petitio / tF detector.
//   - runSpecTestWhole — the WHOLE verdict: did B serve the whole, or only the
//     pieces? Reads the role-skeleton + the deterministic mesh delta — never a sum
//     of section scores. Returns the verdict MINUS its meshDelta (the orchestrator
//     attaches the deterministic delta).
// Both bake the editable prompt into the prompt (no separate systemInstruction, cf.
// ai-provider.compare.ts), tolerantly parse, and return null on junk (the caller
// falls back). See docs/gestalt-design.md §VI and docs/gestalt-design-II.md L1–L4.

import { safeJsonParse } from '../../lib/utils';
import { getPromptText } from '../prompts';
import type { SpecTestSectionInput, SpecTestWholeInput } from '../ai-provider';
import type {
  CommitmentFinding,
  ComparisonDirection,
  ComparisonReceipt,
  MoveAdvance,
  MoveDelta,
  MoveStatus,
  SectionSpec,
  SectionSpecTest,
  StructuralTruth,
  WholeSignatureAlignment,
  WholeVerdict,
} from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

const TRUTHS: StructuralTruth[] = ['whole-true', 'tF', 'fT', 'whole-false', 'lateral'];
const DIRECTIONS: ComparisonDirection[] = ['improved', 'regressed', 'mixed', 'lateral'];
const STATUSES: MoveStatus[] = ['present', 'partial', 'missing', 'unclear'];
const ADVANCES: MoveAdvance[] = ['productive', 'recapitulative'];
const SIGNATURES: WholeSignatureAlignment[] = ['aligned', 'partial', 'adrift'];
const FINDING_KINDS: CommitmentFinding['kind'][] = ['unmet-incoming', 'dangling-outgoing', 'center-of-gravity'];

// --- tolerant coercion -----------------------------------------------------

const asTrimmed = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asTruth = (v: unknown): StructuralTruth =>
  TRUTHS.includes(v as StructuralTruth) ? (v as StructuralTruth) : 'lateral';
const asDirection = (v: unknown): ComparisonDirection =>
  DIRECTIONS.includes(v as ComparisonDirection) ? (v as ComparisonDirection) : 'lateral';
const asStatus = (v: unknown): MoveStatus =>
  STATUSES.includes(v as MoveStatus) ? (v as MoveStatus) : 'unclear';
const asAdvance = (v: unknown): MoveAdvance | undefined =>
  ADVANCES.includes(v as MoveAdvance) ? (v as MoveAdvance) : undefined;
const asSignature = (v: unknown): WholeSignatureAlignment =>
  SIGNATURES.includes(v as WholeSignatureAlignment) ? (v as WholeSignatureAlignment) : 'partial';

const toReceipts = (v: unknown): ComparisonReceipt[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({ quote: asTrimmed(x.quote), side: x.side === 'b' ? ('b' as const) : ('a' as const) }))
        .filter((r) => r.quote)
    : [];

const toFindings = (v: unknown): CommitmentFinding[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x): CommitmentFinding | null => {
          const kind = x.kind;
          const detail = asTrimmed(x.detail);
          if (!detail || typeof kind !== 'string' || !FINDING_KINDS.includes(kind as CommitmentFinding['kind'])) {
            return null;
          }
          const related = asTrimmed(x.relatedSectionTitle);
          return { kind: kind as CommitmentFinding['kind'], detail, ...(related ? { relatedSectionTitle: related } : {}) };
        })
        .filter((f): f is CommitmentFinding => f !== null)
    : [];

const STATUS_RANK: Record<MoveStatus, number> = { present: 3, partial: 2, unclear: 1, missing: 0 };

/**
 * Derive the A→B move delta deterministically — never trust the model's own. A
 * present move that fell from productive to recapitulative has DEFLATED (still
 * true, now inert — a cut opportunity, the L1 petitio failure across a revision).
 */
function deriveDelta(
  statusA: MoveStatus,
  statusB: MoveStatus,
  advanceA?: MoveAdvance,
  advanceB?: MoveAdvance,
): MoveDelta['delta'] {
  const rA = STATUS_RANK[statusA];
  const rB = STATUS_RANK[statusB];
  if (rB > rA) return 'gained';
  if (rB < rA) return 'regressed';
  if (statusB === 'present' && advanceA === 'productive' && advanceB === 'recapitulative') return 'deflated';
  return 'held';
}

const toMoveDeltas = (raw: unknown, spec: SectionSpec): MoveDelta[] =>
  Array.isArray(raw)
    ? raw
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x, i) => {
          const statusA = asStatus(x.statusA);
          const statusB = asStatus(x.statusB);
          const advanceA = asAdvance(x.advanceA);
          const advanceB = asAdvance(x.advanceB);
          const diagnosis = asTrimmed(x.diagnosis);
          return {
            moveId: asTrimmed(x.moveId) || spec.requiredMoves[i]?.id || `move-${i}`,
            moveDescription: asTrimmed(x.moveDescription) || spec.requiredMoves[i]?.description || '',
            statusA,
            statusB,
            ...(advanceA ? { advanceA } : {}),
            ...(advanceB ? { advanceB } : {}),
            delta: deriveDelta(statusA, statusB, advanceA, advanceB),
            ...(diagnosis ? { diagnosis } : {}),
            receipts: toReceipts(x.receipts),
          };
        })
    : [];

// --- part-level flow -------------------------------------------------------

const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: FINDING_KINDS },
    detail: { type: 'string' },
    relatedSectionTitle: { type: 'string' },
  },
  required: ['kind', 'detail'],
};

const SECTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    moveDeltas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          moveId: { type: 'string' },
          moveDescription: { type: 'string' },
          statusA: { type: 'string', enum: STATUSES },
          statusB: { type: 'string', enum: STATUSES },
          advanceA: { type: 'string', enum: ADVANCES },
          advanceB: { type: 'string', enum: ADVANCES },
          diagnosis: { type: 'string' },
          receipts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { quote: { type: 'string' }, side: { type: 'string', enum: ['a', 'b'] } },
              required: ['quote', 'side'],
            },
          },
        },
        required: ['moveId', 'statusA', 'statusB', 'receipts'],
      },
    },
    wholeSignature: {
      type: 'object',
      properties: { a: { type: 'string', enum: SIGNATURES }, b: { type: 'string', enum: SIGNATURES } },
      required: ['a', 'b'],
    },
    wholeReceipts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { quote: { type: 'string' }, side: { type: 'string', enum: ['a', 'b'] } },
        required: ['quote', 'side'],
      },
    },
    commitmentDelta: {
      type: 'object',
      properties: {
        introduced: { type: 'array', items: FINDING_SCHEMA },
        healed: { type: 'array', items: FINDING_SCHEMA },
      },
    },
    truth: { type: 'string', enum: TRUTHS },
    direction: { type: 'string', enum: DIRECTIONS },
    summary: { type: 'string' },
  },
  required: ['moveDeltas', 'truth', 'direction', 'summary'],
};

const movesList = (moves: SectionSpec['requiredMoves']): string =>
  moves.map((m, i) => `  ${i + 1}. [${m.id}] ${m.description}`).join('\n');

const bulletsOrNone = (items: string[]): string[] =>
  items.length ? items.map((c) => `  - ${c}`) : ['  (none specified)'];

const buildSectionPrompt = (input: SpecTestSectionInput): string =>
  [
    ...((input.mode ?? 'draft') === 'draft' ? [getPromptText('specTestModeDraft'), ''] : []),
    input.config.specTestPrompt,
    '',
    `SECTION: "${input.sectionTitle}"`,
    `FUNCTION (held rubric): ${input.spec.function}`,
    `MAIN CLAIM (held rubric): ${input.spec.mainClaim}`,
    '',
    'REQUIRED MOVES (the held rubric — score each on BOTH versions):',
    movesList(input.spec.requiredMoves),
    '',
    'INCOMING CONTEXT (what prior sections should have established):',
    ...bulletsOrNone(input.spec.incomingContext),
    '',
    'OUTGOING COMMITMENTS (what this section must establish for later):',
    ...bulletsOrNone(input.spec.outgoingCommitments),
    '',
    input.structuralSurround,
    '',
    `### VERSION A — "${input.sectionTitle}" (earlier) ###`,
    input.proseA || '(this section is empty in version A)',
    '',
    `### VERSION B — "${input.sectionTitle}" (later) ###`,
    input.proseB || '(this section is empty in version B)',
    '',
    'Return ONLY the JSON object defined by the schema. Every receipt quote MUST be copied verbatim from the version named in its "side" (a = VERSION A, b = VERSION B).',
  ].join('\n');

function normalizeSection(raw: unknown, input: SpecTestSectionInput): SectionSpecTest | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const moveDeltas = toMoveDeltas(rec.moveDeltas, input.spec);
  const summary = asTrimmed(rec.summary);
  if (!moveDeltas.length && !summary) return null; // nothing usable → junk

  const sig = rec.wholeSignature && typeof rec.wholeSignature === 'object' ? (rec.wholeSignature as Record<string, unknown>) : {};
  const cd = rec.commitmentDelta && typeof rec.commitmentDelta === 'object' ? (rec.commitmentDelta as Record<string, unknown>) : {};
  const introduced = toFindings(cd.introduced);
  const healed = toFindings(cd.healed);
  const wholeReceipts = toReceipts(rec.wholeReceipts);

  return {
    sectionTitle: input.sectionTitle,
    presentInA: true,
    presentInB: true,
    scopeReason: 'changed',
    truth: asTruth(rec.truth),
    direction: asDirection(rec.direction),
    wholeSignature: { a: asSignature(sig.a), b: asSignature(sig.b) },
    ...(wholeReceipts.length ? { wholeReceipts } : {}),
    summary,
    moveDeltas,
    ...(introduced.length || healed.length ? { commitmentDelta: { introduced, healed } } : {}),
  };
}

export async function runSpecTestSection(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: SpecTestSectionInput,
): Promise<SectionSpecTest | null> {
  const text = await client.generateText({
    model,
    prompt: buildSectionPrompt(input),
    json: true,
    responseJsonSchema: SECTION_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  const result = normalizeSection(safeJsonParse(text || '', null), input);
  if (!result) {
    console.warn(`[runSpecTestSection:${input.sectionTitle}] unusable model response:`, (text || '').slice(0, 1000));
    return null;
  }
  return result;
}

// --- whole-level flow ------------------------------------------------------

const WHOLE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    truth: { type: 'string', enum: TRUTHS },
    direction: { type: 'string', enum: DIRECTIONS },
    centerOfGravity: { type: 'string' },
    verdict: { type: 'string' },
    receipts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { quote: { type: 'string' }, side: { type: 'string', enum: ['a', 'b'] } },
        required: ['quote', 'side'],
      },
    },
    recenteringVector: { type: 'string' },
  },
  required: ['truth', 'direction', 'centerOfGravity', 'verdict'],
};

const buildWholePrompt = (input: SpecTestWholeInput): string =>
  [
    ...((input.mode ?? 'draft') === 'draft' ? [getPromptText('specTestModeDraft'), ''] : []),
    input.config.specTestWholePrompt,
    '',
    `DOCUMENT'S MAIN CLAIM (the whole this revision serves): ${input.documentClaim || '(none specified)'}`,
    '',
    '### ROLE SKELETON — VERSION A (earlier) ###',
    input.skeletonA,
    '',
    '### ROLE SKELETON — VERSION B (later) ###',
    input.skeletonB,
    '',
    '### CHANGED SECTIONS — PROSE (A vs B) ###',
    input.changedProse || '(no section prose changed; structure-only revision)',
    '',
    '### DETERMINISTIC COMMITMENT-MESH DELTA (hard structural evidence) ###',
    input.meshDeltaText || '(no structural-mesh changes detected)',
    '',
    'Return ONLY the JSON object defined by the schema.',
  ].join('\n');

function normalizeWhole(raw: unknown): Omit<WholeVerdict, 'meshDelta'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const verdict = asTrimmed(rec.verdict);
  const centerOfGravity = asTrimmed(rec.centerOfGravity);
  if (!verdict && !centerOfGravity) return null; // nothing usable → junk
  const recenteringVector = asTrimmed(rec.recenteringVector);
  const receipts = toReceipts(rec.receipts);
  return {
    truth: asTruth(rec.truth),
    direction: asDirection(rec.direction),
    centerOfGravity,
    verdict,
    ...(receipts.length ? { receipts } : {}),
    ...(recenteringVector ? { recenteringVector } : {}),
  };
}

export async function runSpecTestWhole(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: SpecTestWholeInput,
): Promise<Omit<WholeVerdict, 'meshDelta'> | null> {
  const text = await client.generateText({
    model,
    prompt: buildWholePrompt(input),
    json: true,
    responseJsonSchema: WHOLE_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  const result = normalizeWhole(safeJsonParse(text || '', null));
  if (!result) {
    console.warn('[runSpecTestWhole] unusable model response:', (text || '').slice(0, 1000));
    return null;
  }
  return result;
}

// Exported for unit tests of the tolerant parsers + the deterministic delta.
export const __test = { normalizeSection, normalizeWhole, deriveDelta };
