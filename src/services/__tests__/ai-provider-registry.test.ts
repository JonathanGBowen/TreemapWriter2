// The registry constructs the real vendor-SDK clients at module load, so we stub
// those seams and capture the `resolveChoice` function it injects into the
// provider. resolveModelChoice itself stays REAL — we verify the registry wires
// live Agent-mode preferences into it correctly (the one branch the standalone
// resolve-model-choice tests can't see).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ resolveChoice: null as null | ((kind: string) => unknown) }));

vi.mock('../ai/clients', () => {
  class Stub {
    constructor(_arg?: string) {}
    setApiKey() {}
    setBaseUrl() {}
  }
  return {
    GeminiClient: Stub,
    AnthropicClient: Stub,
    OllamaClient: Stub,
    AgentSdkClient: Stub,
    DEFAULT_OLLAMA_BASE_URL: 'http://localhost:11434',
    DEFAULT_AGENT_SIDECAR_URL: 'http://localhost:8787',
    setAgentTraceSink: vi.fn(),
  };
});
vi.mock('../ai/ai-provider.impl', () => ({
  // Capture the injected resolver so the test can exercise it directly.
  MultiProviderAIProvider: class {
    constructor(_clients: unknown, resolveChoice: (kind: string) => unknown) {
      h.resolveChoice = resolveChoice;
    }
  },
}));
vi.mock('../credentials', () => ({ getSecret: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../tauri-environment', () => ({ isTauri: () => false }));

import { setModelConfigSource } from '../ai-provider-registry';
import type { ModelChoice } from '../ai/model-types';

const resolve = (kind: string) => h.resolveChoice!(kind) as ModelChoice;

describe('ai-provider-registry agent-mode wiring', () => {
  beforeEach(() => {
    // Reset the injected config source between tests.
    setModelConfigSource(() => ({}));
  });

  it('captured the resolver at construction', () => {
    expect(typeof h.resolveChoice).toBe('function');
  });

  it('routes dialogue/coaching kinds to the agent-sdk when Agent mode is on', () => {
    setModelConfigSource(() => ({ agentMode: true, agentModel: 'claude-opus-4-8' }));
    const choice = resolve('continueDialogue');
    expect(choice.provider).toBe('agent-sdk');
    expect(choice.model).toBe('claude-opus-4-8');
  });

  it('leaves non-dialogue kinds on their configured provider under Agent mode', () => {
    setModelConfigSource(() => ({ agentMode: true, agentModel: 'claude-opus-4-8' }));
    // generateSpecs is not an AGENT_DEFAULT_KIND, so Agent mode must not capture it.
    expect(resolve('generateSpecs').provider).not.toBe('agent-sdk');
  });

  it('a per-project override beats Agent mode (the opt-out escape hatch)', () => {
    const override: ModelChoice = { provider: 'gemini', model: 'gemini-3-flash-preview' };
    setModelConfigSource(() => ({
      agentMode: true,
      agentModel: 'claude-opus-4-8',
      projectConfig: { continueDialogue: override },
    }));
    expect(resolve('continueDialogue')).toEqual(override);
  });

  it('Agent mode with no model id does not route to the agent-sdk', () => {
    setModelConfigSource(() => ({ agentMode: true, agentModel: '' }));
    expect(resolve('continueDialogue').provider).not.toBe('agent-sdk');
  });
});
