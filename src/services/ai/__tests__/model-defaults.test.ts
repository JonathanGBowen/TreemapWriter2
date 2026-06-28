import { describe, expect, it } from 'vitest';
import { DEFAULT_FALLBACK_LADDER, reconcileFallbackLadder } from '../model-defaults';
import { DEFAULT_CATALOG } from '../model-catalog';
import type { CatalogModel } from '../model-catalog';
import type { ModelChoice } from '../model-types';

describe('DEFAULT_FALLBACK_LADDER', () => {
  it('is derived from the catalog Gemini rows, in order', () => {
    const gemini = DEFAULT_CATALOG.filter((m) => m.provider === 'gemini');
    expect(DEFAULT_FALLBACK_LADDER).toEqual(
      gemini.map((m) => ({ provider: m.provider, model: m.id })),
    );
  });
});

describe('reconcileFallbackLadder', () => {
  const catalog = DEFAULT_CATALOG;

  it('keeps a fully-valid ladder as the SAME reference (so the caller skips a re-persist)', () => {
    expect(reconcileFallbackLadder(DEFAULT_FALLBACK_LADDER, catalog)).toBe(DEFAULT_FALLBACK_LADDER);
  });

  it('prunes only the stale rungs from a partially-stale ladder, preserving order', () => {
    const ladder: ModelChoice[] = [
      { provider: 'gemini', model: 'gemini-flash-latest' },
      { provider: 'gemini', model: 'gemini-3.1-pro-preview' }, // retired
      { provider: 'gemini', model: 'gemini-2.5-flash' },
    ];
    expect(reconcileFallbackLadder(ladder, catalog).map((c) => c.model)).toEqual([
      'gemini-flash-latest',
      'gemini-2.5-flash',
    ]);
  });

  it('restores the default ladder when a non-empty ladder is entirely stale', () => {
    const allStale: ModelChoice[] = [
      { provider: 'gemini', model: 'gemini-3.1-pro-preview' },
      { provider: 'gemini', model: 'gemini-1.0-pro' },
    ];
    expect(reconcileFallbackLadder(allStale, catalog)).toEqual(DEFAULT_FALLBACK_LADDER);
  });

  it('leaves an intentionally-empty ladder empty; falls back to default for a non-array', () => {
    const empty: ModelChoice[] = [];
    expect(reconcileFallbackLadder(empty, catalog)).toBe(empty);
    expect(reconcileFallbackLadder(null, catalog)).toEqual(DEFAULT_FALLBACK_LADDER);
    expect(reconcileFallbackLadder(undefined, catalog)).toEqual(DEFAULT_FALLBACK_LADDER);
  });

  it('keeps a rung for a custom/Ollama model that exists in the catalog', () => {
    const ollamaRow: CatalogModel = {
      provider: 'ollama',
      id: 'llama3.1:8b',
      displayName: 'llama',
      desc: '',
      supportsThinking: false,
      defaultThinkingBudget: 0,
      tier: 'balanced',
    };
    const ladder: ModelChoice[] = [{ provider: 'ollama', model: 'llama3.1:8b' }];
    expect(reconcileFallbackLadder(ladder, [...DEFAULT_CATALOG, ollamaRow])).toBe(ladder);
  });
});
