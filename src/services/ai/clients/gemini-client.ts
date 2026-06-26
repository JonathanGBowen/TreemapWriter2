// Gemini transport. The ONE file that imports `@google/genai`.
//
// Reproduces the request shapes the app used before the multi-provider split:
// JSON via responseMimeType, a thinkingConfig only when the budget is positive
// (so flash-tier calls behave exactly as before), and a system instruction +
// role-mapped contents for streaming dialogue.

import { GoogleGenAI } from '@google/genai';
import type { LLMClient, LLMMessage, LLMRequest } from './llm-client';
import { trimToFirstUser } from './llm-client';
import { isThinkingConfigError } from '../model-fallback';

/**
 * Gemma models are reachable through the Gemini API but are served WITHOUT
 * out-of-band system instructions or structured (schema) output. We degrade those
 * two for them — fold the system instruction into the prompt, drop the schema but
 * keep plain JSON mode — so Gemma can still serve as a last-resort fallback.
 */
function isGemmaModel(model: string): boolean {
  return /(^|\/)gemma/i.test(model);
}

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
    const run = (dropThinking: boolean) =>
      this.client.models.generateContent({
        model: req.model,
        contents: this.contents(req),
        config: this.config(req, dropThinking),
      });
    try {
      return (await run(false)).text || '';
    } catch (err) {
      // The thinking field's name differs across Gemini families; if the model
      // rejects it, retry once without it rather than failing the call.
      if (!isThinkingConfigError(err)) throw err;
      return (await run(true)).text || '';
    }
  }

  async *streamText(req: LLMRequest): AsyncIterable<string> {
    const open = (dropThinking: boolean) =>
      this.client.models.generateContentStream({
        model: req.model,
        contents: this.contents(req),
        config: this.config(req, dropThinking),
      });
    let stream;
    try {
      stream = await open(false);
    } catch (err) {
      if (!isThinkingConfigError(err)) throw err;
      stream = await open(true);
    }
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }

  private contents(req: LLMRequest): unknown {
    // For Gemma, fold the system instruction into the first user turn / the prompt.
    const folded = isGemmaModel(req.model) ? req.systemInstruction : undefined;
    if (req.messages) {
      return trimToFirstUser(req.messages).map((m, i) => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: folded && i === 0 ? `${folded}\n\n${m.text}` : m.text }],
      }));
    }
    const prompt = req.prompt ?? '';
    return folded ? `${folded}\n\n${prompt}` : prompt;
  }

  private config(req: LLMRequest, dropThinking: boolean): Record<string, unknown> | undefined {
    const gemma = isGemmaModel(req.model);
    const config: Record<string, unknown> = {};
    if (req.json) config.responseMimeType = 'application/json';
    // Structured output: when a schema is supplied, Gemini is constrained to it,
    // which reliably pins field names + array shape (schema-less JSON mode drifts).
    // Gemma has no schema support, so we keep plain JSON mode and lean on tolerant
    // parsing upstream.
    if (req.json && req.responseJsonSchema && !gemma) config.responseJsonSchema = req.responseJsonSchema;
    // Gemma rejects an out-of-band system instruction (it's folded into contents()).
    if (req.systemInstruction && !gemma) config.systemInstruction = req.systemInstruction;
    if (typeof req.temperature === 'number') config.temperature = req.temperature;
    // Send a thinking field per the model's convention. `thinkingLevel` (Gemini 3)
    // takes precedence; otherwise a non-zero numeric budget (Gemini 2.5), where -1
    // means dynamic/maximum. A budget of 0 means "no thinking", same as omitting.
    if (!dropThinking) {
      if (req.thinkingLevel) {
        config.thinkingConfig = { thinkingLevel: req.thinkingLevel };
      } else if (typeof req.thinkingBudget === 'number' && req.thinkingBudget !== 0) {
        config.thinkingConfig = { thinkingBudget: req.thinkingBudget };
      }
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
