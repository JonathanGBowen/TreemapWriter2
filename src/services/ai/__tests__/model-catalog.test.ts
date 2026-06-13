import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, findCatalogModel, ollamaCatalogModel } from '../model-catalog';

describe('DEFAULT_CATALOG', () => {
  it('seeds Gemini + Anthropic but never Ollama (auto-detected at runtime)', () => {
    const gemini = DEFAULT_CATALOG.filter((m) => m.provider === 'gemini');
    const anthropic = DEFAULT_CATALOG.filter((m) => m.provider === 'anthropic');
    const ollama = DEFAULT_CATALOG.filter((m) => m.provider === 'ollama');
    expect(gemini.length).toBe(4);
    expect(anthropic.map((m) => m.id)).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]);
    expect(ollama.length).toBe(0);
  });

  it('looks models up by provider + id', () => {
    expect(findCatalogModel(DEFAULT_CATALOG, 'gemini', 'gemini-3.1-pro-preview')?.tier).toBe('deep');
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
