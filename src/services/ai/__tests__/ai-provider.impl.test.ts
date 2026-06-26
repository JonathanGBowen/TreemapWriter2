// Characterization tests for the two orchestrator methods App.tsx calls directly —
// runDiagnostic and estimateDependencies — and for the choose()/clientFor() routing
// every method shares. The MultiProviderAIProvider class takes its clients +
// resolver as constructor params, so we construct it directly with fake clients;
// no registry/singleton wiring is involved. These pin the inline prompt-build +
// tolerant-parse behavior that lives in ai-provider.impl.ts itself.

import { describe, expect, it } from 'vitest';
import { MultiProviderAIProvider } from '../ai-provider.impl';
import type { ProviderClients } from '../ai-provider.impl';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import type { LLMClient, LLMRequest } from '../clients';
import type { ModelChoice } from '../model-types';
import type { RunDiagnosticInput, EstimateDependenciesInput } from '../../ai-provider';
import type { Section, SectionSpec, Persona, TestSuite } from '../../../types';

const recordingClient = (responses: string[], reqs: LLMRequest[]): LLMClient => {
  let i = 0;
  return {
    generateText: async (req) => {
      reqs.push(req);
      return responses[i++] ?? '{}';
    },
    streamText: async function* () {},
  };
};

/** One recording fake behind all four provider slots; assert on `reqs` + `req.model`. */
const oneClientProvider = (
  responses: string[],
  reqs: LLMRequest[],
  choice: ModelChoice = { provider: 'gemini', model: 'cfg-model' },
): MultiProviderAIProvider => {
  const client = recordingClient(responses, reqs);
  const clients: ProviderClients = { gemini: client, anthropic: client, ollama: client, agentSdk: client };
  return new MultiProviderAIProvider(clients, () => choice);
};

const spec: SectionSpec = {
  function: 'argue',
  mainClaim: 'The claim.',
  requiredMoves: [{ id: 'm1', description: 'do m1' }],
  incomingContext: [],
  outgoingCommitments: [],
};

const section = (over: Partial<Section> = {}): Section => ({
  id: 's1',
  title: 'Intro',
  level: 1,
  content: '',
  fullContent: 'The body.',
  startLine: 0,
  endLine: 1,
  startOffset: 0,
  wordCount: 2,
  children: [],
  parentId: null,
  ...over,
});

const persona: Persona = { id: 'p', name: 'Reader', role: 'critic', instruction: 'Read carefully.' };

const diagnosticInput = (over: Partial<RunDiagnosticInput> = {}): RunDiagnosticInput => ({
  section: section(),
  spec,
  scope: 'segment',
  persona,
  customInstruction: '',
  fullDocument: 'The body.',
  sections: [section()],
  config: DEFAULT_PROMPTS_CONFIG,
  findSection: (nodes, id) => nodes.find((n) => n.id === id) ?? null,
  ...over,
});

describe('MultiProviderAIProvider.runDiagnostic', () => {
  it('requests JSON on the configured model and coerces a malformed result', async () => {
    const reqs: LLMRequest[] = [];
    const provider = oneClientProvider(
      [JSON.stringify({ moveResults: [{ moveId: '', status: 'bogus', diagnosis: 'd' }], overallReadiness: 'invalid' })],
      reqs,
    );

    const result = await provider.runDiagnostic(diagnosticInput());

    expect(reqs[0].json).toBe(true);
    expect(reqs[0].model).toBe('cfg-model');

    // Missing moveId → synthesized; bad status → 'unclear'; missing description →
    // falls back to the spec's required move; bad readiness → 'draft'; and the
    // absent fields get their documented defaults.
    expect(result.moveResults[0].moveId).toBe('move-0');
    expect(result.moveResults[0].status).toBe('unclear');
    expect(result.moveResults[0].moveDescription).toBe('do m1');
    expect(result.overallReadiness).toBe('draft');
    expect(result.coherenceNotes).toEqual([]);
    expect(result.nextPriority).toMatch(/.+/);
  });

  it('honors a per-call modelChoice override over the resolver, routing to that provider', async () => {
    const gemini: LLMRequest[] = [];
    const anthropic: LLMRequest[] = [];
    const clients: ProviderClients = {
      gemini: recordingClient(['{}'], gemini),
      anthropic: recordingClient(['{}'], anthropic),
      ollama: recordingClient(['{}'], []),
      agentSdk: recordingClient(['{}'], []),
    };
    // Resolver says anthropic, but the per-call override says gemini/override-model.
    const provider = new MultiProviderAIProvider(clients, () => ({ provider: 'anthropic', model: 'resolver-model' }));

    await provider.runDiagnostic(diagnosticInput({ modelChoice: { provider: 'gemini', model: 'override-model' } }));

    expect(gemini).toHaveLength(1);
    expect(gemini[0].model).toBe('override-model');
    expect(anthropic).toHaveLength(0);
  });

  it('routes to the resolver-chosen provider when there is no override', async () => {
    const gemini: LLMRequest[] = [];
    const anthropic: LLMRequest[] = [];
    const clients: ProviderClients = {
      gemini: recordingClient(['{}'], gemini),
      anthropic: recordingClient(['{}'], anthropic),
      ollama: recordingClient(['{}'], []),
      agentSdk: recordingClient(['{}'], []),
    };
    const provider = new MultiProviderAIProvider(clients, () => ({ provider: 'anthropic', model: 'resolver-model' }));

    await provider.runDiagnostic(diagnosticInput());

    expect(anthropic).toHaveLength(1);
    expect(anthropic[0].model).toBe('resolver-model');
    expect(gemini).toHaveLength(0);
  });
});

const entry = (over: Partial<SectionSpec>): TestSuite[string] => ({
  goals: '',
  status: 'idle',
  spec: { ...spec, ...over },
});

describe('MultiProviderAIProvider.estimateDependencies', () => {
  it('short-circuits to {} when fewer than two sections carry context-bearing specs', async () => {
    const reqs: LLMRequest[] = [];
    const provider = oneClientProvider(['{}'], reqs);
    const input: EstimateDependenciesInput = {
      sections: [section({ id: 'a' }), section({ id: 'b' })],
      testSuite: { a: entry({ incomingContext: ['x'], outgoingCommitments: ['y'] }) } as TestSuite,
      config: DEFAULT_PROMPTS_CONFIG,
    };

    const result = await provider.estimateDependencies(input);
    expect(result).toEqual({});
    // No model call when there is nothing to relate.
    expect(reqs).toHaveLength(0);
  });

  it('sends the sections data and coerces the dependency map (bad type → prerequisite, no id → dropped)', async () => {
    const reqs: LLMRequest[] = [];
    const provider = oneClientProvider(
      [JSON.stringify({ a: [{ id: 'b', type: 'reference' }], b: [{ id: 'a', type: 'weird' }, { type: 'reference' }] })],
      reqs,
      { provider: 'gemini', model: 'cfg-model' },
    );
    const input: EstimateDependenciesInput = {
      sections: [section({ id: 'a' }), section({ id: 'b' })],
      testSuite: {
        a: entry({ incomingContext: ['x'], outgoingCommitments: ['y'] }),
        b: entry({ incomingContext: ['z'], outgoingCommitments: ['w'] }),
      } as TestSuite,
      config: { ...DEFAULT_PROMPTS_CONFIG, dependenciesPrompt: 'DEPS' },
    };

    const result = await provider.estimateDependencies(input);

    expect(reqs[0].json).toBe(true);
    expect(reqs[0].prompt).toContain('DEPS');
    expect(reqs[0].prompt).toContain('SECTIONS DATA');
    expect(result.a).toEqual([{ id: 'b', type: 'reference' }]);
    // 'weird' → 'prerequisite'; the id-less entry is dropped.
    expect(result.b).toEqual([{ id: 'a', type: 'prerequisite' }]);
  });
});
