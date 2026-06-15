// Living Sprints — AI plan generation (Direction A). Provider-agnostic: it
// composes the brief context, calls the injected LLMClient under a
// structured-output schema, then validates + re-normalizes the result so move
// durations always sum to the chosen total and the plan always opens with a
// reinstate move. Split out of ai-provider.impl.ts to keep that file under the
// line cap (mirrors ai-provider.revisions.ts).

import { safeJsonParse } from '../../lib/utils';
import { ensureReinstateFirst, renormalizeDurations } from '../../lib/sprintPlan';
import type { GenerateSprintPlanInput } from '../ai-provider';
import type { SprintMove, SprintMoveRole, SprintPlan } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 8000;
const MAX_MOVES = 7;

const VALID_ROLES: SprintMoveRole[] = [
  'reinstate',
  'frame',
  'marshal',
  'draft',
  'stress',
  'synthesize',
  'bridge',
];

/** Structured-output schema — Gemini is constrained to this exact shape. */
const SPRINT_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    moves: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          instructions: { type: 'array', items: { type: 'string' } },
          durationSec: { type: 'number' },
          role: { type: 'string', enum: VALID_ROLES },
        },
        required: ['title', 'instructions', 'durationSec', 'role'],
      },
    },
  },
  required: ['moves'],
};

function asRole(value: unknown): SprintMoveRole {
  return VALID_ROLES.includes(value as SprintMoveRole) ? (value as SprintMoveRole) : 'draft';
}

/** Compose the brief context the system prompt operates on. */
function buildUserPrompt(input: GenerateSprintPlanInput): string {
  const spec = input.spec;
  const movesList = spec?.requiredMoves?.length
    ? spec.requiredMoves.map((m, i) => `  ${i + 1}. ${m.description}`).join('\n')
    : '  (no spec moves defined)';
  const shapeSkeleton = input.shape
    ? input.shape.moves
        .map((m) => `  - ${m.title} [${m.role}, weight ${m.weight}]`)
        .join('\n')
    : '  (freeform — no shape chosen)';
  const lastTouched =
    input.backlog.lastTouchedDays == null
      ? 'unknown'
      : `${input.backlog.lastTouchedDays}d ago`;

  return [
    `SECTION: "${input.sectionTitle}"`,
    spec ? `FUNCTION: ${spec.function}` : '',
    spec ? `MAIN CLAIM: ${spec.mainClaim}` : '',
    '',
    'SECTION REQUIRED MOVES (fold these into draft/marshal moves where they fit):',
    movesList,
    '',
    `WRITER'S GOAL FOR THIS SPRINT: ${input.sessionGoal.trim() || '(not stated)'}`,
    '',
    `CHOSEN SHAPE: ${input.shape ? input.shape.name : '(freeform)'}`,
    'SHAPE SKELETON (bend it; keep its spirit and rough proportions):',
    shapeSkeleton,
    '',
    `TOTAL MINUTES: ${input.totalMin} (durations MUST sum to ${Math.round(input.totalMin * 60)} seconds)`,
    `BACKLOG: ${input.backlog.unfinishedCount} unfinished ¶ · last touched ${lastTouched} · ${input.backlog.fragmentCount} fragments reattached`,
    '',
    'Return ONLY the JSON object: { "moves": [ ... ] }. First move role MUST be "reinstate".',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

export async function generateSprintPlan(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: GenerateSprintPlanInput,
): Promise<SprintPlan> {
  const totalSec = Math.max(60, Math.round(input.totalMin * 60));

  const text = await client.generateText({
    model,
    prompt: buildUserPrompt(input),
    systemInstruction: input.config.generateSprintPlanPrompt,
    json: true,
    responseJsonSchema: SPRINT_PLAN_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const json = safeJsonParse(text || '', null) as { moves?: unknown[] } | null;
  const raw = json && Array.isArray(json.moves) ? json.moves : null;
  if (!raw || raw.length === 0) {
    console.warn('[generateSprintPlan] unparseable model response:', (text || '').slice(0, 1500));
    throw new Error('Sprint plan could not be parsed.');
  }

  let moves: SprintMove[] = raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .filter((m) => typeof m.title === 'string')
    .slice(0, MAX_MOVES)
    .map((m, i) => ({
      id: `ai-m${i}`,
      title: String(m.title).trim().slice(0, 80) || `Move ${i + 1}`,
      instructions: Array.isArray(m.instructions)
        ? m.instructions.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 5)
        : [],
      durationSec:
        typeof m.durationSec === 'number' && Number.isFinite(m.durationSec) && m.durationSec > 0
          ? Math.round(m.durationSec)
          : 60,
      role: asRole(m.role),
    }));

  if (moves.length === 0) throw new Error('Sprint plan had no usable moves.');

  // Guarantee a reinstate opener, re-key ids after any prepend, and force the
  // durations to sum to the chosen total (the model often drifts on arithmetic).
  moves = ensureReinstateFirst(moves).map((m, i) => ({ ...m, id: `ai-m${i}` }));
  moves = renormalizeDurations(moves, totalSec);

  return {
    shapeId: input.shape?.id ?? null,
    targetSectionId: input.targetSectionId,
    totalSec,
    moves,
  };
}
