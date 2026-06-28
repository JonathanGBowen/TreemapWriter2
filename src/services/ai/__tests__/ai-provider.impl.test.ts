// Characterization tests for the two orchestrator methods App.tsx calls directly —
// runDiagnostic and estimateDependencies — and for the choose()/clientFor() routing
// every method shares. The MultiProviderAIProvider class takes its clients +
// resolver as constructor params, so we construct it directly with fake clients;
// no registry/singleton wiring is involved. These pin the inline prompt-build +
// tolerant-parse behavior that lives in ai-provider.impl.ts itself.

import { describe, expect, it } from 'vitest';
import { MultiProviderAIProvider } from '../ai-provider.impl';
import type { ProviderClients, FallbackDeps } from '../ai-provider.impl';
import { DEFAULT_PROMPTS_CONFIG } from '../../prompts';
import { DEFAULT_CATALOG } from '../model-catalog';
import { ModelCooldowns } from '../model-fallback';
import { DEFAULT_FALLBACK_LADDER } from '../model-defaults';
import type { LLMClient, LLMRequest } from '../clients';
import type { ModelChoice } from '../model-types';
import type {
  RunDiagnosticInput,
  EstimateDependenciesInput,
  CoachAdviceInput,
} from '../../ai-provider';
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

// --- Quota fallback (the dispatch wrapper) -------------------------------

/** A gemini-only client whose per-model behavior is scripted; records each request. */
type GenBehavior = (model: string) => Promise<string>;
const programmable = (behavior: GenBehavior, log: LLMRequest[]): LLMClient => ({
  generateText: async (req) => {
    log.push(req);
    return behavior(req.model);
  },
  // eslint-disable-next-line require-yield
  streamText: async function* () {
    throw new Error('not used');
  },
});

/** A client whose streamText returns a scripted async iterable; records each open. */
type StreamBehavior = (model: string) => AsyncIterable<string>;
const programmableStream = (behavior: StreamBehavior, log: LLMRequest[]): LLMClient => ({
  generateText: async () => '',
  streamText: (req) => {
    log.push(req);
    return behavior(req.model);
  },
});

/** A stream that rejects on the first pull (a quota/overload before any token). */
const throwingStream = (err: unknown): AsyncIterable<string> => ({
  [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(err) }),
});
async function* genOnce(chunk: string): AsyncGenerator<string> {
  yield chunk;
}
async function* yieldThenThrow(chunk: string, err: unknown): AsyncGenerator<string> {
  yield chunk;
  throw err;
}

const fastRetry = { sleep: async () => {}, random: () => 0, maxAttempts: 3 };

const withFallback = (
  client: LLMClient,
  choice: ModelChoice,
  cooldowns: ModelCooldowns,
): MultiProviderAIProvider => {
  const clients: ProviderClients = {
    gemini: client,
    anthropic: client,
    ollama: client,
    agentSdk: client,
  };
  const fallback: FallbackDeps = {
    getContext: () => ({
      settings: { enabled: true, ladder: DEFAULT_FALLBACK_LADDER },
      catalog: DEFAULT_CATALOG,
    }),
    cooldowns,
    retry: fastRetry,
  };
  return new MultiProviderAIProvider(clients, () => choice, fallback);
};

const heavy: ModelChoice = { provider: 'gemini', model: 'gemini-flash-latest', thinkingBudget: -1 };
const coachInput = (): CoachAdviceInput => ({
  markdown: '',
  sections: [],
  testSuite: {} as TestSuite,
  config: DEFAULT_PROMPTS_CONFIG,
});
const dailyQuota = { status: 429, message: 'Quota exceeded: requests per day limit reached' };

describe('MultiProviderAIProvider — quota fallback', () => {
  it('without fallback deps, dispatch is a transparent passthrough (no ladder)', async () => {
    const reqs: LLMRequest[] = [];
    const client: LLMClient = {
      generateText: async (req) => {
        reqs.push(req);
        throw dailyQuota;
      },
      // eslint-disable-next-line require-yield
      streamText: async function* () {},
    };
    const clients: ProviderClients = { gemini: client, anthropic: client, ollama: client, agentSdk: client };
    const provider = new MultiProviderAIProvider(clients, () => heavy);
    await expect(provider.runDiagnostic(diagnosticInput())).rejects.toBeTruthy();
    expect(reqs).toHaveLength(1); // one attempt, no fallback
  });

  it('cools a model down on a daily-quota error and falls to the next ladder rung', async () => {
    const log: LLMRequest[] = [];
    const cooldowns = new ModelCooldowns();
    const provider = withFallback(
      programmable(
        (model) => (model === 'gemini-flash-latest' ? Promise.reject(dailyQuota) : Promise.resolve('{}')),
        log,
      ),
      heavy,
      cooldowns,
    );

    await provider.runDiagnostic(diagnosticInput());

    expect(cooldowns.isActive('gemini', 'gemini-flash-latest', Date.now())).toBe(true);
    expect(log.map((r) => r.model)).toEqual(['gemini-flash-latest', 'gemini-3-flash-preview']);
    // Thinking is resolved to the model's convention (both are level-style → 'high').
    expect(log[0].thinkingLevel).toBe('high');
    expect(log[0].thinkingBudget).toBeUndefined();
  });

  it('expresses thinking per convention and clears it when not wanted', async () => {
    const log: LLMRequest[] = [];
    await withFallback(
      programmable(() => Promise.resolve('{}'), log),
      { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: -1 },
      new ModelCooldowns(),
    ).runDiagnostic(diagnosticInput());
    expect(log[0].model).toBe('gemini-2.5-flash');
    expect(log[0].thinkingBudget).toBe(-1); // budget-style → numeric
    expect(log[0].thinkingLevel).toBeUndefined();

    const log2: LLMRequest[] = [];
    await withFallback(
      programmable(() => Promise.resolve('{}'), log2),
      { provider: 'gemini', model: 'gemini-3.1-flash-lite', thinkingBudget: 0 },
      new ModelCooldowns(),
    ).runDiagnostic(diagnosticInput());
    expect(log2[0].thinkingBudget).toBeUndefined();
    expect(log2[0].thinkingLevel).toBeUndefined();
  });

  it('retries an overloaded model in place, then advances WITHOUT cooling it down', async () => {
    const log: LLMRequest[] = [];
    const cooldowns = new ModelCooldowns();
    const provider = withFallback(
      programmable(
        (model) =>
          model === 'gemini-flash-latest'
            ? Promise.reject({ status: 503, message: 'model is overloaded' })
            : Promise.resolve('{}'),
        log,
      ),
      heavy,
      cooldowns,
    );

    await provider.runDiagnostic(diagnosticInput());

    expect(log.filter((r) => r.model === 'gemini-flash-latest')).toHaveLength(3); // in-place retries
    expect(log[log.length - 1].model).toBe('gemini-3-flash-preview');
    expect(cooldowns.isActive('gemini', 'gemini-flash-latest', Date.now())).toBe(false);
  });

  it('throws AllModelsExhaustedError (quota) when every candidate is quota-blocked', async () => {
    const log: LLMRequest[] = [];
    const provider = withFallback(
      programmable(() => Promise.reject(dailyQuota), log),
      heavy,
      new ModelCooldowns(),
    );
    await expect(provider.runDiagnostic(diagnosticInput())).rejects.toMatchObject({
      name: 'AllModelsExhaustedError',
      reason: 'quota',
    });
    expect(log).toHaveLength(DEFAULT_FALLBACK_LADDER.length);
  });

  it('skips candidates whose context window cannot hold the prompt (context exhaustion)', async () => {
    const log: LLMRequest[] = [];
    const cooldowns = new ModelCooldowns();
    // Pre-cool every flash/lite rung; only the 131k-window Gemma rungs remain.
    for (const m of [
      'gemini-flash-latest',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
    ]) {
      cooldowns.markDailyQuota('gemini', m, Date.now());
    }
    const huge = 'x'.repeat(2_000_000); // ~500k tokens — over Gemma's window
    const provider = withFallback(programmable(() => Promise.resolve('{}'), log), heavy, cooldowns);

    await expect(
      provider.runDiagnostic(diagnosticInput({ scope: 'full', fullDocument: huge })),
    ).rejects.toMatchObject({ name: 'AllModelsExhaustedError', reason: 'context' });
    expect(log).toHaveLength(0); // nothing viable → nothing attempted
  });

  it('streaming: falls back before the first chunk, then streams the next model', async () => {
    const log: LLMRequest[] = [];
    const cooldowns = new ModelCooldowns();
    const provider = withFallback(
      programmableStream(
        (model) =>
          model === 'gemini-flash-latest' ? throwingStream(dailyQuota) : genOnce('hi'),
        log,
      ),
      heavy,
      cooldowns,
    );

    const out: string[] = [];
    for await (const c of provider.streamCoachAdvice(coachInput())) out.push(c);

    expect(out).toEqual(['hi']);
    expect(cooldowns.isActive('gemini', 'gemini-flash-latest', Date.now())).toBe(true);
    expect(log.map((r) => r.model)).toEqual(['gemini-flash-latest', 'gemini-3-flash-preview']);
  });

  it('streaming: rethrows once a chunk has been yielded (no mid-stream restart)', async () => {
    const log: LLMRequest[] = [];
    const cooldowns = new ModelCooldowns();
    const provider = withFallback(
      programmableStream(() => yieldThenThrow('partial', dailyQuota), log),
      heavy,
      cooldowns,
    );

    const out: string[] = [];
    await expect(
      (async () => {
        for await (const c of provider.streamCoachAdvice(coachInput())) out.push(c);
      })(),
    ).rejects.toBeTruthy();
    expect(out).toEqual(['partial']);
    // A mid-stream failure isn't a clean signal we acted on → no cooldown.
    expect(cooldowns.isActive('gemini', 'gemini-flash-latest', Date.now())).toBe(false);
  });
});
