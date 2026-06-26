import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_CONFIG, normalizeModelConfig } from '../model-config';
import { AI_CALL_KINDS } from '../model-types';

describe('DEFAULT_MODEL_CONFIG', () => {
  it('covers every call kind, all on Gemini, and never on a Pro model', () => {
    for (const kind of AI_CALL_KINDS) {
      expect(DEFAULT_MODEL_CONFIG[kind]).toBeDefined();
      expect(DEFAULT_MODEL_CONFIG[kind].provider).toBe('gemini');
      expect(DEFAULT_MODEL_CONFIG[kind].model).not.toMatch(/pro/i);
    }
  });

  it('maps heavy reasoning onto top flash with thinking intent on', () => {
    expect(DEFAULT_MODEL_CONFIG.analyzeSection).toEqual({
      provider: 'gemini',
      model: 'gemini-flash-latest',
      thinkingBudget: -1,
    });
    // The intent flag is uniform across the heavy bucket; the dispatch layer maps
    // it to each model's own thinking convention.
    expect(DEFAULT_MODEL_CONFIG.continueDialogue.thinkingBudget).toBe(-1);
    expect(DEFAULT_MODEL_CONFIG.estimateDependencies.thinkingBudget).toBe(-1);
  });

  it('maps interactive + trivial calls onto smaller flash with no thinking', () => {
    expect(DEFAULT_MODEL_CONFIG.generateSpecs).toEqual({
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      thinkingBudget: 0,
    });
    expect(DEFAULT_MODEL_CONFIG.runDiagnostic).toEqual({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      thinkingBudget: 0,
    });
    expect(DEFAULT_MODEL_CONFIG.getContentSuggestions.thinkingBudget).toBe(0);
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
