import { describe, expect, it } from 'vitest';
import { checkContextFit, estimateTokens } from '../context-budget';
import type { CatalogModel } from '../model-catalog';

const model = (id: string, contextWindow?: number): CatalogModel => ({
  provider: 'gemini',
  id,
  displayName: id,
  desc: '',
  supportsThinking: false,
  defaultThinkingBudget: 0,
  tier: 'balanced',
  ...(contextWindow != null ? { contextWindow } : {}),
});

const catalog: CatalogModel[] = [
  model('big', 1_000_000),
  model('tiny', 30_000),
  { ...model('local'), provider: 'ollama' }, // no contextWindow
];

describe('estimateTokens', () => {
  it('approximates ~4 characters per token', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('checkContextFit', () => {
  it('fits a whole document comfortably in a large window', () => {
    const fit = checkContextFit(catalog, { provider: 'gemini', model: 'big' }, 'word '.repeat(50_000));
    expect(fit.overflow).toBe(false);
    expect(fit.ok).toBe(true);
    expect(fit.unknownWindow).toBe(false);
    expect(fit.contextWindow).toBe(1_000_000);
  });

  it('overflows a small window (and is therefore not ok)', () => {
    const fit = checkContextFit(catalog, { provider: 'gemini', model: 'tiny' }, 'x'.repeat(100_000));
    expect(fit.overflow).toBe(true);
    expect(fit.ok).toBe(false);
  });

  it('fits a short document even in a small window', () => {
    const fit = checkContextFit(catalog, { provider: 'gemini', model: 'tiny' }, 'x'.repeat(1_000));
    expect(fit.overflow).toBe(false);
    expect(fit.ok).toBe(true);
  });

  it('proceeds-but-warns when the model window is unknown', () => {
    const fit = checkContextFit(catalog, { provider: 'ollama', model: 'local' }, 'x'.repeat(1_000_000));
    expect(fit.unknownWindow).toBe(true);
    expect(fit.overflow).toBe(false);
    expect(fit.ok).toBe(true);
    expect(fit.contextWindow).toBeNull();
  });

  it('treats an unlisted model as unknown', () => {
    const fit = checkContextFit(catalog, { provider: 'gemini', model: 'nope' }, 'x');
    expect(fit.unknownWindow).toBe(true);
  });
});
