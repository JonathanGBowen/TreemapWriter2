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

describe('resolveModelChoice — Agent mode', () => {
  const agent = { enabled: true, model: 'claude-opus-4-8' };

  it('routes dialogue + coaching kinds to agent-sdk when enabled', () => {
    expect(resolveModelChoice('continueDialogue', {}, {}, agent)).toEqual({
      provider: 'agent-sdk',
      model: 'claude-opus-4-8',
    });
    expect(resolveModelChoice('generateSprintPlan', {}, {}, agent)).toEqual({
      provider: 'agent-sdk',
      model: 'claude-opus-4-8',
    });
    expect(resolveModelChoice('directiveDialogueTurn', {}, {}, agent)).toEqual({
      provider: 'agent-sdk',
      model: 'claude-opus-4-8',
    });
  });

  it('leaves non-dialogue/coaching kinds on their normal provider', () => {
    expect(resolveModelChoice('analyzeSection', {}, {}, agent)).toEqual(
      DEFAULT_MODEL_CONFIG.analyzeSection,
    );
  });

  it('beats the (all-or-nothing) global default for its kinds', () => {
    const global = { continueDialogue: { provider: 'anthropic' as const, model: 'claude-opus-4-8' } };
    expect(resolveModelChoice('continueDialogue', {}, global, agent)).toEqual({
      provider: 'agent-sdk',
      model: 'claude-opus-4-8',
    });
  });

  it('yields to an explicit per-project override (the opt-out escape hatch)', () => {
    const project = { continueDialogue: { provider: 'gemini' as const, model: 'gemini-flash-latest' } };
    expect(resolveModelChoice('continueDialogue', project, {}, agent)).toEqual(
      project.continueDialogue,
    );
  });

  it('does nothing when disabled', () => {
    expect(resolveModelChoice('continueDialogue', {}, {}, { enabled: false, model: 'x' })).toEqual(
      DEFAULT_MODEL_CONFIG.continueDialogue,
    );
    expect(resolveModelChoice('continueDialogue', {}, {})).toEqual(
      DEFAULT_MODEL_CONFIG.continueDialogue,
    );
  });
});
