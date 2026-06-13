import { describe, expect, it } from 'vitest';
import { resolveModelChoice } from '../resolve-model-choice';
import { DEFAULT_MODEL_CONFIG } from '../model-config';

describe('resolveModelChoice', () => {
  it('falls through to the built-in default when nothing is set', () => {
    expect(resolveModelChoice('analyzeSection', {}, {})).toEqual(
      DEFAULT_MODEL_CONFIG.analyzeSection,
    );
    expect(resolveModelChoice('analyzeSection', null, undefined)).toEqual(
      DEFAULT_MODEL_CONFIG.analyzeSection,
    );
  });

  it('uses the global default over the built-in', () => {
    const global = {
      analyzeSection: { provider: 'anthropic' as const, model: 'claude-opus-4-8' },
    };
    expect(resolveModelChoice('analyzeSection', {}, global)).toEqual(global.analyzeSection);
    // a kind absent from the global default still falls through
    expect(resolveModelChoice('continueDialogue', {}, global)).toEqual(
      DEFAULT_MODEL_CONFIG.continueDialogue,
    );
  });

  it('uses the per-project override over the global default', () => {
    const global = { analyzeSection: { provider: 'gemini' as const, model: 'gemini-flash-latest' } };
    const project = { analyzeSection: { provider: 'ollama' as const, model: 'llama3' } };
    expect(resolveModelChoice('analyzeSection', project, global)).toEqual(project.analyzeSection);
  });
});
