import { describe, expect, it } from 'vitest';
import { coerceSpec, generateSpecs } from '../ai-provider.specs';
import { parseMarkdown } from '../../../lib/utils';
import type { LLMClient } from '../clients';
import type { PromptsConfig, SectionSpec } from '../../../types';

const config: PromptsConfig = {
  systemInstruction: 'SYS',
  l1TaskInstruction: 'L1-TASK',
  subTaskInstruction: 'SUB-TASK',
  rootTaskInstruction: 'ROOT-TASK',
  suggestContentPrompt: '',
  coachPrompt: '',
  refineSpecPrompt: '',
  generatePersonasPrompt: '',
  diagnosticInstruction: '',
  dependenciesPrompt: '',
  analysisPrompt: '',
  refactorAnalysisPrompt: '',
  dialoguePrompt: '',
  generateRevisionsPrompt: '',
  generateSprintPlanPrompt: '',
  compareVersionsPrompt: '',
};

/** A canned client that records each prompt and replays scripted JSON responses. */
const mockClient = (responses: string[], prompts: string[]): LLMClient => {
  let i = 0;
  return {
    generateText: async (req) => {
      prompts.push(req.prompt ?? '');
      return responses[i++] ?? '{}';
    },
    streamText: async function* () {},
  };
};

describe('coerceSpec', () => {
  it('coerces a bare string into a minimal spec', () => {
    const s = coerceSpec('just a claim');
    expect(s.mainClaim).toBe('just a claim');
    expect(s.requiredMoves).toHaveLength(1);
  });

  it('normalizes snake_case keys and an invalid function', () => {
    const s = coerceSpec({
      function: 'nonsense',
      main_claim: 'C',
      required_moves: ['a', 'b'],
      outgoing_commitments: ['o'],
    });
    expect(s.function).toBe('argue');
    expect(s.mainClaim).toBe('C');
    expect(s.requiredMoves.map((m) => m.description)).toEqual(['a', 'b']);
    expect(s.outgoingCommitments).toEqual(['o']);
  });
});

describe('generateSpecs — document-level (root) Phase 0', () => {
  it('runs the root pass first with full text, then feeds it into the L1 pass', async () => {
    const md = '# Chapter One\nThe quick brown fox.\n';
    const sections = parseMarkdown(md);
    const id = sections[0].id;
    const prompts: string[] = [];
    const responses = [
      JSON.stringify({
        function: 'synthesize',
        mainClaim: 'ROOT THESIS',
        requiredMoves: ['macro arc'],
        incomingContext: [],
        outgoingCommitments: ['ROOT OUT'],
      }),
      JSON.stringify({
        [id]: {
          function: 'argue',
          mainClaim: 'chapter claim',
          requiredMoves: ['m1'],
          incomingContext: [],
          outgoingCommitments: [],
        },
      }),
    ];
    const batches: Record<string, SectionSpec>[] = [];

    await generateSpecs(mockClient(responses, prompts), 'gemini-3-flash-preview', 0, {
      sections,
      markdown: md,
      config,
      onBatchComplete: (s) => batches.push(s),
    });

    // Phase 0 runs first, sending the full document text.
    expect(prompts[0]).toContain('ROOT-TASK');
    expect(prompts[0]).toContain('FULL DOCUMENT TEXT');
    expect(prompts[0]).toContain('The quick brown fox.');

    // First batch emitted is the document-level (root) spec.
    expect(batches[0].root.mainClaim).toBe('ROOT THESIS');

    // The L1 (chapter) pass is constrained by the root spec — top-down.
    expect(prompts[1]).toContain('DOCUMENT-LEVEL SPEC');
    expect(prompts[1]).toContain('ROOT THESIS');
    expect(batches[1][id].mainClaim).toBe('chapter claim');
  });

  it('degrades the root pass to the outline (no full text) on overflow', async () => {
    const md = '# Chapter One\nSECRETPROSE.\n';
    const sections = parseMarkdown(md);
    const prompts: string[] = [];
    const responses = [JSON.stringify({ mainClaim: 'ROOT', requiredMoves: [] }), '{}'];

    await generateSpecs(mockClient(responses, prompts), 'gemini-3-flash-preview', 0, {
      sections,
      markdown: md,
      config,
      rootFullText: false,
      onBatchComplete: () => {},
    });

    expect(prompts[0]).toContain('Full document text omitted');
    expect(prompts[0]).not.toContain('SECRETPROSE.');
  });
});
