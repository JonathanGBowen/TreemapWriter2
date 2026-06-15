import type { PromptsConfig } from '../../types';

import systemInstruction from './system-instruction.md?raw';
import l1TaskInstruction from './l1-task.md?raw';
import subTaskInstruction from './sub-task.md?raw';
import rootTaskInstruction from './root-task.md?raw';
import suggestContentPrompt from './suggest-content.md?raw';
import coachPrompt from './coach.md?raw';
import refineSpecPrompt from './refine-spec.md?raw';
import generatePersonasPrompt from './generate-personas.md?raw';
import diagnosticInstruction from './diagnostic.md?raw';
import dependenciesPrompt from './dependencies.md?raw';
import analysisPrompt from './analysis.md?raw';
import refactorAnalysisPrompt from './refactor-analysis.md?raw';
import dialoguePrompt from './dialogue.md?raw';
import generateRevisionsPrompt from './generate-revisions.md?raw';
import generateSprintPlanPrompt from './generate-sprint-plan.md?raw';

const stripTrailingNewline = (s: string) => s.replace(/\n+$/, '');

export const DEFAULT_PROMPTS_CONFIG: PromptsConfig = {
  systemInstruction: stripTrailingNewline(systemInstruction),
  l1TaskInstruction: stripTrailingNewline(l1TaskInstruction),
  subTaskInstruction: stripTrailingNewline(subTaskInstruction),
  rootTaskInstruction: stripTrailingNewline(rootTaskInstruction),
  suggestContentPrompt: stripTrailingNewline(suggestContentPrompt),
  coachPrompt: stripTrailingNewline(coachPrompt),
  refineSpecPrompt: stripTrailingNewline(refineSpecPrompt),
  generatePersonasPrompt: stripTrailingNewline(generatePersonasPrompt),
  diagnosticInstruction: stripTrailingNewline(diagnosticInstruction),
  dependenciesPrompt: stripTrailingNewline(dependenciesPrompt),
  analysisPrompt: stripTrailingNewline(analysisPrompt),
  refactorAnalysisPrompt: stripTrailingNewline(refactorAnalysisPrompt),
  dialoguePrompt: stripTrailingNewline(dialoguePrompt),
  generateRevisionsPrompt: stripTrailingNewline(generateRevisionsPrompt),
  generateSprintPlanPrompt: stripTrailingNewline(generateSprintPlanPrompt),
};

/**
 * Hydration boundary for prompt configs. Persisted configs (project files,
 * snapshots, the embedded demo) may predate newer prompt fields; merging over
 * the defaults guarantees every field is populated, so downstream code (the
 * provider) can trust `config.xPrompt` without per-call fallbacks.
 */
export const normalizePromptsConfig = (
  raw: Partial<PromptsConfig> | null | undefined,
): PromptsConfig => ({ ...DEFAULT_PROMPTS_CONFIG, ...(raw ?? {}) });
