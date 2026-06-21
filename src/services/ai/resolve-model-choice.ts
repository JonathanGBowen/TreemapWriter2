// Resolution order for "which model runs this call".
//
//   1. per-project per-kind override   (project's models.json) — always wins,
//      and is the escape hatch to opt a dialogue/coaching kind OUT of Agent mode
//      (or to opt ANY other kind IN to the agent-sdk provider).
//   2. Agent mode default               (when enabled, routes the dialogue +
//      coaching kinds through the Agent SDK). Beats the all-or-nothing global
//      "default model" knob for those kinds so the toggle isn't silently defeated.
//   3. global per-kind default          (app preferences; the "default model"
//      knob writes one ModelChoice across all kinds)
//   4. built-in DEFAULT_MODEL_CONFIG     (reproduces pre-refactor behavior)
//
// Keeping this in one pure function means every call site resolves identically
// and it is trivially unit-testable.

import type { AICallKind, ModelChoice, ModelConfig } from './model-types';
import { DEFAULT_MODEL_CONFIG } from './model-config';

/**
 * The call kinds Agent mode routes through the Claude Agent SDK by default:
 * the app's dialogue features and its coaching features (incl. the structured
 * sprint-plan calls). Everything else stays on its configured provider unless
 * the user opts it in per-kind.
 */
export const AGENT_DEFAULT_KINDS: ReadonlySet<AICallKind> = new Set<AICallKind>([
  'continueDialogue',
  'streamCoachAdvice',
  'getCoachAdvice',
  'coachSprintTurn',
  'generateSprintPlan',
  'decomposeSprintStep',
]);

/** Agent-mode routing state passed in from live preferences. */
export interface AgentRouting {
  enabled: boolean;
  /** The agent-sdk model id to run (e.g. 'claude-opus-4-8'). */
  model: string;
}

export function resolveModelChoice(
  kind: AICallKind,
  projectConfig: ModelConfig | null | undefined,
  globalDefault: ModelConfig | null | undefined,
  agent?: AgentRouting,
): ModelChoice {
  // 1. Per-project per-kind override is the most specific signal.
  const projectChoice = projectConfig?.[kind];
  if (projectChoice) return projectChoice;

  // 2. Agent mode is the default transport for dialogue + coaching kinds.
  if (agent?.enabled && agent.model && AGENT_DEFAULT_KINDS.has(kind)) {
    return { provider: 'agent-sdk', model: agent.model };
  }

  // 3. global per-kind default, then 4. built-in default.
  return globalDefault?.[kind] ?? DEFAULT_MODEL_CONFIG[kind];
}
