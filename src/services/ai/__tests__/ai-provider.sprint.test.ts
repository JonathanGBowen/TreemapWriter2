// Characterization tests for the Living Sprints AI flows. Pins the request framing
// and the post-processing invariants the runner depends on: a plan always opens
// with a reinstate move and its move durations sum to the chosen total, and a step
// breakdown never smuggles in a reinstate sub-step. The duration/reinstate helpers
// have their own tests in lib/__tests__/sprintPlan*; here we pin the flow contract.

import { describe, expect, it } from 'vitest';
import { decomposeSprintStep, generateSprintPlan } from '../ai-provider.sprint';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { DecomposeSprintStepInput, GenerateSprintPlanInput } from '../../ai-provider';

const mockClient = (responses: string[], reqs: LLMRequest[]): LLMClient => {
  let i = 0;
  return {
    generateText: async (req) => {
      reqs.push(req);
      return responses[i++] ?? '{}';
    },
    streamText: async function* () {},
  };
};

const config = {
  ...DEFAULT_PROMPTS_CONFIG,
  generateSprintPlanPrompt: 'SP-SYS',
  decomposeStepPrompt: 'DS-SYS',
};

const planInput: GenerateSprintPlanInput = {
  sectionTitle: 'Sec',
  targetSectionId: 'sec1',
  sessionGoal: 'finish intro',
  shape: null,
  totalMin: 10,
  backlog: { unfinishedCount: 2, lastTouchedDays: 3, fragmentCount: 1 },
  config,
};

describe('generateSprintPlan', () => {
  it('frames the brief and guarantees a reinstate opener with durations summing to the total', async () => {
    const reqs: LLMRequest[] = [];
    const plan = await generateSprintPlan(
      mockClient(['{"moves":[{"title":"Draft it","instructions":["write"],"durationSec":600,"role":"draft"}]}'], reqs),
      'model',
      0,
      planInput,
    );

    expect(reqs[0].systemInstruction).toBe('SP-SYS');
    expect(reqs[0].prompt).toContain('TOTAL MINUTES: 10');
    expect(reqs[0].prompt).toContain("WRITER'S GOAL FOR THIS SPRINT: finish intro");

    expect(plan.targetSectionId).toBe('sec1');
    expect(plan.totalSec).toBe(600);
    expect(plan.moves[0].role).toBe('reinstate');
    expect(plan.moves.reduce((sum, m) => sum + m.durationSec, 0)).toBe(plan.totalSec);
  });

  it('throws when the plan response is unparseable', async () => {
    const reqs: LLMRequest[] = [];
    await expect(
      generateSprintPlan(mockClient(['not json'], reqs), 'model', 0, planInput),
    ).rejects.toThrow(/could not be parsed/i);
  });
});

const decomposeInput: DecomposeSprintStepInput = {
  sectionTitle: 'Sec',
  step: { id: 'm0', title: 'Big step', instructions: ['a', 'b'], durationSec: 300, role: 'draft' },
  granularity: 'fine',
  config,
};

describe('decomposeSprintStep', () => {
  it('frames the step + granularity and never returns a reinstate sub-step', async () => {
    const reqs: LLMRequest[] = [];
    const children = await decomposeSprintStep(
      mockClient(
        ['{"moves":[{"title":"sub one","instructions":["x"],"durationSec":100,"role":"draft"},{"title":"sub two","instructions":["y"],"durationSec":200,"role":"reinstate"}]}'],
        reqs,
      ),
      'model',
      0,
      decomposeInput,
    );

    expect(reqs[0].systemInstruction).toBe('DS-SYS');
    expect(reqs[0].prompt).toContain('STEP TO BREAK DOWN: Big step');
    expect(reqs[0].prompt).toContain('GRANULARITY: fine');

    expect(children).toHaveLength(2);
    expect(children[0].id).toBe('sub-m0');
    // The smuggled 'reinstate' role is remapped to the parent step's role.
    expect(children[1].role).not.toBe('reinstate');
    expect(children[1].role).toBe('draft');
  });

  it('throws when the breakdown response is unparseable', async () => {
    const reqs: LLMRequest[] = [];
    await expect(
      decomposeSprintStep(mockClient(['nope'], reqs), 'model', 0, decomposeInput),
    ).rejects.toThrow(/could not be parsed/i);
  });
});
