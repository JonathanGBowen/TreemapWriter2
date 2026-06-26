import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, findCatalogModel, ollamaCatalogModel } from '../model-catalog';

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
