// Gemini transport. The ONE file that imports `@google/genai`.
//
// Reproduces the request shapes the app used before the multi-provider split:
// JSON via responseMimeType, a thinkingConfig only when the budget is positive
// (so flash-tier calls behave exactly as before), and a system instruction +
// role-mapped contents for streaming dialogue.

import { GoogleGenAI } from '@google/genai';
import type { LLMClient, LLMMessage, LLMRequest } from './llm-client';
import { trimToFirstUser } from './llm-client';

export class GeminiClient implements LLMClient {
  private apiKey: string;
  private clientCached: GoogleGenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Swap the key (e.g. after the registry resolves it from the keyring). */
  setApiKey(apiKey: string): void {
    if (apiKey === this.apiKey) return;
    this.apiKey = apiKey;
    this.clientCached = null;
  }

  /** Lazy: an app launched without a key still boots; the error surfaces on first use. */
  private get client(): GoogleGenAI {
    if (!this.apiKey) throw new Error('API Key missing');
    if (!this.clientCached) this.clientCached = new GoogleGenAI({ apiKey: this.apiKey });
    return this.clientCached;
  }

  async generateText(req: LLMRequest): Promise<string> {
    const res = await this.client.models.generateContent({
      model: req.model,
      contents: this.contents(req),
      config: this.config(req),
    });
    return res.text || '';
  }

  async *streamText(req: LLMRequest): AsyncIterable<string> {
    const stream = await this.client.models.generateContentStream({
      model: req.model,
      contents: this.contents(req),
      config: this.config(req),
    });
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }

  private contents(req: LLMRequest): unknown {
    if (req.messages) {
      return trimToFirstUser(req.messages).map((m) => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.text }],
      }));
    }
    return req.prompt ?? '';
  }

  private config(req: LLMRequest): Record<string, unknown> | undefined {
    const config: Record<string, unknown> = {};
    if (req.json) config.responseMimeType = 'application/json';
    if (req.systemInstruction) config.systemInstruction = req.systemInstruction;
    // Match the prior behavior: only send a thinkingConfig when the budget is
    // positive. A budget of 0 (flash-tier) means "no thinking", same as omitting.
    if (typeof req.thinkingBudget === 'number' && req.thinkingBudget > 0) {
      config.thinkingConfig = { thinkingBudget: req.thinkingBudget };
    }
    return Object.keys(config).length ? config : undefined;
  }
}

// Exposed for unit tests; not part of the LLMClient contract.
export function geminiContentsForTest(messages: LLMMessage[]): unknown {
  return trimToFirstUser(messages).map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.text }],
  }));
}
