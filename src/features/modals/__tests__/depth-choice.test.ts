import { describe, it, expect } from 'vitest';
import { resolveDepthChoice, tierOf, depthModelLabel } from '../depth-choice';
import { DEFAULT_CATALOG, ollamaCatalogModel, type CatalogModel } from '../../../services/ai/model-catalog';
import type { ModelChoice } from '../../../services/ai/model-types';

const gemini: ModelChoice = { provider: 'gemini', model: 'gemini-3-flash-preview' };
const anthropic: ModelChoice = { provider: 'anthropic', model: 'claude-sonnet-4-6' };

describe('resolveDepthChoice', () => {
  it('maps each tier to the matching Gemini model, with thinking only on deep', () => {
    expect(resolveDepthChoice(DEFAULT_CATALOG, gemini, 'fast')).toEqual({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      thinkingBudget: 0,
    });
    expect(resolveDepthChoice(DEFAULT_CATALOG, gemini, 'balanced')).toEqual({
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      thinkingBudget: 0,
    });
    // Pro is gone — flash-latest is the deepest stop, with maximum thinking (-1 = dynamic).
    expect(resolveDepthChoice(DEFAULT_CATALOG, gemini, 'deep')).toEqual({
      provider: 'gemini',
      model: 'gemini-flash-latest',
      thinkingBudget: -1,
    });
  });

  it('maps tiers within the active provider (Anthropic), thinking stays 0 (native)', () => {
    expect(resolveDepthChoice(DEFAULT_CATALOG, anthropic, 'fast').model).toBe('claude-haiku-4-5-20251001');
    expect(resolveDepthChoice(DEFAULT_CATALOG, anthropic, 'balanced').model).toBe('claude-sonnet-4-6');
    const deep = resolveDepthChoice(DEFAULT_CATALOG, anthropic, 'deep');
    expect(deep.model).toBe('claude-opus-4-8');
    expect(deep.thinkingBudget).toBe(0);
  });

  it('never crosses providers', () => {
    expect(resolveDepthChoice(DEFAULT_CATALOG, gemini, 'deep').provider).toBe('gemini');
    expect(resolveDepthChoice(DEFAULT_CATALOG, anthropic, 'fast').provider).toBe('anthropic');
  });

  it('falls back to the nearest available tier when the exact tier is missing', () => {
    // A single Ollama model (tier "balanced") must satisfy every DEPTH stop.
    const catalog: CatalogModel[] = [...DEFAULT_CATALOG, ollamaCatalogModel('llama3.1:8b')];
    const ollama: ModelChoice = { provider: 'ollama', model: 'llama3.1:8b' };
    expect(resolveDepthChoice(catalog, ollama, 'fast').model).toBe('llama3.1:8b');
    expect(resolveDepthChoice(catalog, ollama, 'deep').model).toBe('llama3.1:8b');
  });

  it('returns the base choice unchanged when the provider has no catalog rows', () => {
    const orphan: ModelChoice = { provider: 'ollama', model: 'mystery' };
    expect(resolveDepthChoice(DEFAULT_CATALOG, orphan, 'deep')).toBe(orphan);
  });
});

describe('tierOf / depthModelLabel', () => {
  it('reads the tier of the current model, defaulting to balanced', () => {
    expect(tierOf(DEFAULT_CATALOG, gemini)).toBe('balanced');
    expect(tierOf(DEFAULT_CATALOG, { provider: 'gemini', model: 'gemini-flash-latest' })).toBe('deep');
    expect(tierOf(DEFAULT_CATALOG, { provider: 'ollama', model: 'unknown' })).toBe('balanced');
  });

  it('reports the resolved model display name for a tier', () => {
    expect(depthModelLabel(DEFAULT_CATALOG, gemini, 'deep')).toBe('Gemini Flash (latest)');
    expect(depthModelLabel(DEFAULT_CATALOG, anthropic, 'fast')).toBe('Claude Haiku 4.5');
  });
});
