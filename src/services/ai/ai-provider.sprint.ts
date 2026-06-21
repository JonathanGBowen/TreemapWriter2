// Living Sprints — AI plan generation (Direction A). Provider-agnostic: it
// composes the brief context, calls the injected LLMClient under a
// structured-output schema, then validates + re-normalizes the result so move
// durations always sum to the chosen total and the plan always opens with a
// reinstate move. Split out of ai-provider.impl.ts to keep that file under the
// line cap (mirrors ai-provider.revisions.ts).

import { safeJsonParse } from '../../lib/utils';
import { ensureReinstateFirst, renormalizeDurations } from '../../lib/sprintPlan';
import type { DecomposeSprintStepInput, GenerateSprintPlanInput } from '../ai-provider';
import type { SprintGranularity, SprintMove, SprintMoveRole, SprintPlan } from '../../types';
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

const GRANULARITY_HINT: Record<SprintGranularity, string> = {
  coarse: 'coarse — fewer, larger moves (3–4)',
  medium: 'medium — a middle breakdown (4–6)',
  fine: 'fine — more, smaller moves (6–7)',
};

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

  // The coach-captured goal (WOOP or plain) supersedes the legacy free-text goal.
  const wish = input.goal?.wish?.trim() || input.sessionGoal.trim();
  const granularity = input.granularity ?? 'coarse';

  return [
    `SECTION: "${input.sectionTitle}"`,
    spec ? `FUNCTION: ${spec.function}` : '',
    spec ? `MAIN CLAIM: ${spec.mainClaim}` : '',
    '',
    'SECTION REQUIRED MOVES (fold these into draft/marshal moves where they fit):',
    movesList,
    '',
    `WRITER'S GOAL FOR THIS SPRINT: ${wish || '(not stated)'}`,
    input.goal?.obstacle ? `INNER OBSTACLE THEY NAMED: ${input.goal.obstacle.trim()}` : '',
    input.goal?.ifThen ? `THEIR IF-THEN PLAN: ${input.goal.ifThen.trim()}` : '',
    input.extraContext ? `\nCOACH CONVERSATION (mine for the real goal):\n${input.extraContext.trim()}` : '',
    '',
    `GRANULARITY: ${GRANULARITY_HINT[granularity]}`,
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

const MAX_CHILDREN = 4;

/**
 * Goblin-style recursive breakdown of ONE step. Returns the sub-steps with
 * *relative* durations (weights) — the caller (lib/sprintEdit) rescales them to
 * the parent's seconds and re-keys ids. Never returns a reinstate sub-step.
 */
export async function decomposeSprintStep(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: DecomposeSprintStepInput,
): Promise<SprintMove[]> {
  const granularity = input.granularity ?? 'medium';
  const prompt = [
    `SECTION: "${input.sectionTitle}"`,
    '',
    `STEP TO BREAK DOWN: ${input.step.title}`,
    'STEP INSTRUCTIONS:',
    ...(input.step.instructions.length
      ? input.step.instructions.map((l) => `  - ${l}`)
      : ['  (none)']),
    `STEP ROLE: ${input.step.role}`,
    '',
    `GRANULARITY: ${granularity}`,
    'Return ONLY the JSON object: { "moves": [ ... ] }.',
  ].join('\n');

  const text = await client.generateText({
    model,
    prompt,
    systemInstruction: input.config.decomposeStepPrompt,
    json: true,
    responseJsonSchema: SPRINT_PLAN_JSON_SCHEMA,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });

  const json = safeJsonParse(text || '', null) as { moves?: unknown[] } | null;
  const raw = json && Array.isArray(json.moves) ? json.moves : null;
  if (!raw || raw.length === 0) {
    console.warn('[decomposeSprintStep] unparseable model response:', (text || '').slice(0, 800));
    throw new Error('Step breakdown could not be parsed.');
  }

  const children: SprintMove[] = raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .filter((m) => typeof m.title === 'string')
    .slice(0, MAX_CHILDREN)
    .map((m, i) => {
      const role = asRole(m.role);
      return {
        id: `sub-m${i}`,
        title: String(m.title).trim().slice(0, 80) || `Step ${i + 1}`,
        instructions: Array.isArray(m.instructions)
          ? m.instructions.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 4)
          : [],
        durationSec:
          typeof m.durationSec === 'number' && Number.isFinite(m.durationSec) && m.durationSec > 0
            ? Math.round(m.durationSec)
            : 60,
        // Never let a breakdown smuggle in a reinstate opener.
        role: role === 'reinstate' ? input.step.role === 'reinstate' ? 'draft' : input.step.role : role,
      };
    });

  if (children.length === 0) throw new Error('Step breakdown had no usable sub-steps.');
  return children;
}
