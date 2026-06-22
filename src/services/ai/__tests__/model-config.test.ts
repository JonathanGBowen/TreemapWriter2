import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_CONFIG, normalizeModelConfig } from '../model-config';
import { AI_CALL_KINDS } from '../model-types';

describe('DEFAULT_MODEL_CONFIG', () => {
  it('covers every call kind', () => {
    for (const kind of AI_CALL_KINDS) {
      expect(DEFAULT_MODEL_CONFIG[kind]).toBeDefined();
      expect(DEFAULT_MODEL_CONFIG[kind].provider).toBe('gemini');
    }
  });

  it('reproduces the pre-refactor analysis/dialogue budgets', () => {
    expect(DEFAULT_MODEL_CONFIG.analyzeSection).toEqual({
      provider: 'gemini',
      model: 'gemini-3.1-pro-preview',
      thinkingBudget: 16000,
    });
    expect(DEFAULT_MODEL_CONFIG.continueDialogue.thinkingBudget).toBe(8192);
    expect(DEFAULT_MODEL_CONFIG.estimateDependencies.thinkingBudget).toBe(1024);
  });
});

describe('normalizeModelConfig', () => {
  it('returns {} for nullish or non-object input', () => {
    expect(normalizeModelConfig(undefined)).toEqual({});
    expect(normalizeModelConfig(null)).toEqual({});
    expect(normalizeModelConfig('nope' as unknown as null)).toEqual({});
  });

  it('stays sparse — does not populate missing kinds', () => {
    const out = normalizeModelConfig({
      analyzeSection: { provider: 'anthropic', model: 'claude-opus-4-8' },
    });
    expect(Object.keys(out)).toEqual(['analyzeSection']);
    expect(out.continueDialogue).toBeUndefined();
  });

  it('drops malformed entries', () => {
    const out = normalizeModelConfig({
      // @ts-expect-error — deliberately malformed
      generateSpecs: { provider: 'openai', model: 'gpt-4' },
      // @ts-expect-error — missing model
      runDiagnostic: { provider: 'gemini' },
      getCoachAdvice: { provider: 'ollama', model: 'llama3' },
    });
    expect(out.generateSpecs).toBeUndefined();
    expect(out.runDiagnostic).toBeUndefined();
    expect(out.getCoachAdvice).toEqual({ provider: 'ollama', model: 'llama3' });
  });

  it('accepts the experimental agent-sdk provider', () => {
    const out = normalizeModelConfig({
      continueDialogue: { provider: 'agent-sdk', model: 'claude-opus-4-8' },
    });
    expect(out.continueDialogue).toEqual({ provider: 'agent-sdk', model: 'claude-opus-4-8' });
  });

  it('preserves a numeric thinkingBudget and omits a non-numeric one', () => {
    const out = normalizeModelConfig({
      analyzeSection: { provider: 'gemini', model: 'gemini-3.1-pro-preview', thinkingBudget: 4000 },
      // @ts-expect-error — bad budget type
      refineSpec: { provider: 'gemini', model: 'gemini-3.1-pro-preview', thinkingBudget: 'lots' },
    });
    expect(out.analyzeSection?.thinkingBudget).toBe(4000);
    expect(out.refineSpec).toEqual({ provider: 'gemini', model: 'gemini-3.1-pro-preview' });
  });
});
