// Reverse Outline Doctor — the wizard's two structured steps: rescue roadmaps
// (step 4) and the revision checklist (step 5). Both re-feed the step-2
// coherence table (`outlineData`) exactly as the ported Breakthrough Sequence
// chained it. Step 3 (the streamed diagnosis) lives inline in ai-provider.impl.ts
// beside the other streaming flows. Sibling of ai-provider.doctor.ts.

import { safeJsonParse } from '../../lib/utils';
import { normalizeDoctorTasks, normalizeRoadmaps } from '../../lib/doctor-helpers';
import { interpolate } from '../prompts/interpolate';
import type { GenerateDoctorChecklistInput, ProposeRoadmapsInput } from '../ai-provider';
import type { DoctorTask, RoadmapOption } from '../../types';
import type { LLMClient } from './clients';

const MAX_OUTPUT_TOKENS = 16000;

const roadmapsSchema = {
  type: 'object',
  properties: {
    roadmaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          outline: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'summary', 'outline'],
      },
    },
  },
  required: ['roadmaps'],
};

export async function proposeRoadmaps(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: ProposeRoadmapsInput,
): Promise<RoadmapOption[]> {
  const prompt = [
    // The editable prompt carries the {{CRITICAL_ISSUE}} slot; interpolate is the
    // fail-loud single-pass substitution (all occurrences, throws on a missing value).
    interpolate(input.config.doctorRoadmapsPrompt, { CRITICAL_ISSUE: input.criticalIssue }),
    '',
    // Also frame the issue as its own block: a user override of the editable prompt
    // that drops the {{CRITICAL_ISSUE}} token would otherwise sever it from the step.
    '### CRITICAL ISSUE ###',
    input.criticalIssue,
    '',
    '### ORIGINAL OUTLINE ###',
    input.outlineData,
    '',
    'Return ONLY a JSON object with a "roadmaps" array of exactly three, each with title, summary, and outline lines. Example: {"roadmaps":[{"title":"…","summary":"…","outline":["…"]}]}',
  ].join('\n');
  const text = await client.generateText({
    model,
    prompt,
    systemInstruction: input.config.doctorSystemPrompt,
    json: true,
    responseJsonSchema: roadmapsSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return normalizeRoadmaps(safeJsonParse(text || '', null));
}

const checklistSchema = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          paragraphNumbers: { type: 'array', items: { type: 'number' } },
        },
        required: ['text', 'paragraphNumbers'],
      },
    },
  },
  required: ['tasks'],
};

export async function generateDoctorChecklist(
  client: LLMClient,
  model: string,
  thinkingBudget: number | undefined,
  input: GenerateDoctorChecklistInput,
): Promise<DoctorTask[]> {
  const roadmap = [
    input.chosenRoadmap.title,
    input.chosenRoadmap.summary,
    ...input.chosenRoadmap.outline.map((l) => `- ${l}`),
  ]
    .filter(Boolean)
    .join('\n');
  const prompt = [
    input.config.doctorChecklistPrompt,
    '',
    '### CHOSEN ROADMAP ###',
    roadmap,
    '',
    '### ORIGINAL OUTLINE ###',
    input.outlineData,
    '',
    'Return ONLY a JSON object with a "tasks" array; each task has its "text" and "paragraphNumbers" (the 1-based paragraph numbers it touches, [] when none). Example: {"tasks":[{"text":"…","paragraphNumbers":[6,9]}]}',
  ].join('\n');
  const text = await client.generateText({
    model,
    prompt,
    systemInstruction: input.config.doctorSystemPrompt,
    json: true,
    responseJsonSchema: checklistSchema,
    thinkingBudget,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  // Never drops a task: an out-of-range ¶ number loses its anchor, not the task.
  return normalizeDoctorTasks(safeJsonParse(text || '', null), input.blocks);
}
