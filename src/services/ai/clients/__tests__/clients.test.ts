import { describe, expect, it } from 'vitest';
import { trimToFirstUser } from '../llm-client';
import { anthropicMessages, supportsAdaptiveThinking } from '../anthropic-client';
import { ollamaMessages } from '../ollama-client';
import { geminiContentsForTest } from '../gemini-client';

describe('trimToFirstUser', () => {
  it('drops leading non-user turns (providers require a user-first history)', () => {
    expect(
      trimToFirstUser([
        { role: 'model', text: 'a' },
        { role: 'user', text: 'b' },
        { role: 'model', text: 'c' },
      ]),
    ).toEqual([
      { role: 'user', text: 'b' },
      { role: 'model', text: 'c' },
    ]);
  });

  it('leaves a user-first history untouched', () => {
    const h = [{ role: 'user', text: 'x' }] as const;
    expect(trimToFirstUser([...h])).toEqual([...h]);
  });
});

describe('GeminiClient role mapping', () => {
  it('maps assistant/model -> model and wraps parts', () => {
    expect(
      geminiContentsForTest([
        { role: 'user', text: 'hi' },
        { role: 'model', text: 'yo' },
      ]),
    ).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'yo' }] },
    ]);
  });
});

describe('AnthropicClient', () => {
  it('never sends adaptive thinking for opus models via budget — only flags support', () => {
    expect(supportsAdaptiveThinking('claude-opus-4-8')).toBe(true);
    expect(supportsAdaptiveThinking('claude-sonnet-4-6')).toBe(true);
    // Haiku 4.5 is not adaptive-capable; must omit thinking to avoid a 400.
    expect(supportsAdaptiveThinking('claude-haiku-4-5-20251001')).toBe(false);
    expect(supportsAdaptiveThinking('some-future-model')).toBe(false);
  });

  it('maps a single prompt to one user message', () => {
    expect(anthropicMessages({ model: 'm', prompt: 'hello' })).toEqual([
      { role: 'user', content: 'hello' },
    ]);
  });

  it('maps model -> assistant and trims a leading assistant turn', () => {
    expect(
      anthropicMessages({
        model: 'm',
        messages: [
          { role: 'model', text: 'lead' },
          { role: 'user', text: 'q' },
          { role: 'model', text: 'a' },
        ],
      }),
    ).toEqual([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);
  });
});

describe('OllamaClient message shaping', () => {
  it('prepends the system instruction and maps roles', () => {
    expect(
      ollamaMessages({
        model: 'llama3',
        systemInstruction: 'sys',
        messages: [
          { role: 'user', text: 'q' },
          { role: 'model', text: 'a' },
        ],
      }),
    ).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]);
  });

  it('wraps a single prompt as a user message', () => {
    expect(ollamaMessages({ model: 'llama3', prompt: 'p' })).toEqual([
      { role: 'user', content: 'p' },
    ]);
  });
});
