import { describe, expect, it } from 'vitest';
import {
  CUSTOM_MODEL_DESC,
  DEFAULT_CATALOG,
  findCatalogModel,
  isBuiltinModel,
  ollamaCatalogModel,
  reconcileCatalog,
} from '../model-catalog';
import type { CatalogModel } from '../model-catalog';

describe('DEFAULT_CATALOG', () => {
  it('seeds the flash/lite/gemma Gemini family (no Pro) + Anthropic, never Ollama', () => {
    const gemini = DEFAULT_CATALOG.filter((m) => m.provider === 'gemini');
    const anthropic = DEFAULT_CATALOG.filter((m) => m.provider === 'anthropic');
    const ollama = DEFAULT_CATALOG.filter((m) => m.provider === 'ollama');
    expect(gemini.map((m) => m.id)).toEqual([
      'gemini-flash-latest',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
      'gemma-4-31b-it',
      'gemma-4-26b-a4b-it',
    ]);
    // Pro is intentionally gone (its daily quota is too small to rely on).
    expect(gemini.some((m) => /pro/i.test(m.id))).toBe(false);
    expect(anthropic.map((m) => m.id)).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]);
    expect(ollama.length).toBe(0);
  });

  it('marks Gemma without system-instruction / schema support (client degrades for it)', () => {
    const gemma = DEFAULT_CATALOG.filter((m) => m.id.startsWith('gemma'));
    expect(gemma.length).toBeGreaterThan(0);
    for (const m of gemma) {
      expect(m.supportsJsonSchema).toBe(false);
      expect(m.supportsSystemInstruction).toBe(false);
      expect(m.supportsThinking).toBe(false);
    }
  });

  it('tags each thinking-capable flash with its API convention', () => {
    expect(findCatalogModel(DEFAULT_CATALOG, 'gemini', 'gemini-2.5-flash')?.thinking).toBe('budget');
    expect(findCatalogModel(DEFAULT_CATALOG, 'gemini', 'gemini-3-flash-preview')?.thinking).toBe(
      'level',
    );
  });

  it('seeds the three Claude tiers for the experimental Agent SDK provider', () => {
    const agentSdk = DEFAULT_CATALOG.filter((m) => m.provider === 'agent-sdk');
    expect(agentSdk.map((m) => m.id)).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
    ]);
  });

  it('looks models up by provider + id', () => {
    expect(findCatalogModel(DEFAULT_CATALOG, 'gemini', 'gemini-flash-latest')?.tier).toBe('deep');
    expect(findCatalogModel(DEFAULT_CATALOG, 'gemini', 'nope')).toBeUndefined();
  });

  it('builds an Ollama row from a tag name', () => {
    expect(ollamaCatalogModel('llama3.1:8b')).toMatchObject({
      provider: 'ollama',
      id: 'llama3.1:8b',
      supportsThinking: false,
    });
  });
});

describe('isBuiltinModel', () => {
  it('is true for a seed model and false for Ollama/custom', () => {
    expect(isBuiltinModel({ provider: 'gemini', id: 'gemini-flash-latest' })).toBe(true);
    expect(isBuiltinModel({ provider: 'anthropic', id: 'claude-opus-4-8' })).toBe(true);
    expect(isBuiltinModel({ provider: 'ollama', id: 'llama3.1:8b' })).toBe(false);
    expect(isBuiltinModel({ provider: 'gemini', id: 'my-custom' })).toBe(false);
  });
});

describe('reconcileCatalog', () => {
  it('returns the seed when nothing useful is persisted', () => {
    expect(reconcileCatalog(null)).toEqual(DEFAULT_CATALOG);
    expect(reconcileCatalog(undefined)).toEqual(DEFAULT_CATALOG);
    expect(reconcileCatalog([])).toEqual(DEFAULT_CATALOG);
  });

  it('refreshes built-in metadata from code, overriding stale persisted metadata', () => {
    const stale = [
      // a built-in carrying stale metadata (wrong name, missing requestsPerMinute)
      { provider: 'gemini', id: 'gemini-flash-latest', displayName: 'STALE NAME', desc: '', supportsThinking: false, defaultThinkingBudget: 0, tier: 'fast' },
    ] as CatalogModel[];
    const out = reconcileCatalog(stale);
    const flash = findCatalogModel(out, 'gemini', 'gemini-flash-latest');
    // metadata comes from code, not the stale persisted row
    expect(flash?.displayName).toBe('Gemini Flash (latest)');
    expect(flash?.requestsPerMinute).toBe(5);
    // no duplicate row for the built-in
    expect(out.filter((m) => m.provider === 'gemini' && m.id === 'gemini-flash-latest')).toHaveLength(1);
  });

  it('drops a retired former built-in id (a non-seed model without the custom marker)', () => {
    const out = reconcileCatalog([
      { provider: 'gemini', id: 'gemini-3.1-pro-preview', displayName: 'old pro', desc: 'Strongest.', supportsThinking: false, defaultThinkingBudget: 0, tier: 'deep' },
    ] as CatalogModel[]);
    expect(findCatalogModel(out, 'gemini', 'gemini-3.1-pro-preview')).toBeUndefined();
    expect(out).toEqual(DEFAULT_CATALOG);
  });

  it('preserves detected Ollama and user-added custom models, appended after the seed', () => {
    // A genuine custom model carries the editor's CUSTOM_MODEL_DESC marker.
    const custom = { provider: 'gemini', id: 'gemini-experimental-x', displayName: 'gemini-experimental-x', desc: CUSTOM_MODEL_DESC, supportsThinking: false, defaultThinkingBudget: 0, tier: 'balanced' } as CatalogModel;
    const ollama = ollamaCatalogModel('llama3.1:8b');
    const out = reconcileCatalog([custom, ollama]);
    // the seed comes first, in order
    expect(out.slice(0, DEFAULT_CATALOG.length)).toEqual(DEFAULT_CATALOG);
    expect(out.some((m) => m.id === 'gemini-experimental-x')).toBe(true);
    expect(out.some((m) => m.provider === 'ollama' && m.id === 'llama3.1:8b')).toBe(true);
  });

  it('is idempotent', () => {
    const once = reconcileCatalog([ollamaCatalogModel('llama3.1:8b')]);
    expect(reconcileCatalog(once)).toEqual(once);
  });

  it('drops malformed rows', () => {
    const out = reconcileCatalog(
      [null, {}, { provider: 'gemini' }, { id: 'x' }] as unknown as CatalogModel[],
    );
    expect(out).toEqual(DEFAULT_CATALOG);
  });
});
