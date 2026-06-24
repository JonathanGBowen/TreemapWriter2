// Anthropic transport. The ONE file that imports `@anthropic-ai/sdk`.
//
// Notes that the Claude API forces on us (verified against the claude-api skill):
//  - `dangerouslyAllowBrowser` is required to call the API from the webview;
//    it sets the sanctioned anthropic-dangerous-direct-browser-access header.
//  - `max_tokens` is REQUIRED (Gemini doesn't need it) — we supply per-call defaults.
//  - There is no responseMimeType. We force JSON via a system instruction; the
//    app's tolerant `safeJsonParse` handles any stray fences/prose.
//  - Thinking is adaptive-only on the modern models and `budget_tokens` 400s on
//    Opus 4.x — so we NEVER forward the numeric Gemini budget. We enable adaptive
//    thinking for the models that support it, and omit it elsewhere (and for
//    streaming dialogue, to keep the first token snappy).

import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMRequest, LLMMessage } from './llm-client';
import { trimToFirstUser } from './llm-client';

// Non-streaming default. Adaptive thinking is counted INSIDE max_tokens, so this
// must leave room for both the reasoning pass and the JSON body — callers pass an
// explicit value, but the default stays generous so a future caller can't truncate.
const DEFAULT_MAX_TOKENS = 16000;
/** Streaming dialogue default; a chat turn rarely needs more. */
const STREAM_MAX_TOKENS = 16000;

const JSON_INSTRUCTION =
  'Respond with only valid JSON. Do not wrap it in markdown code fences and do not add any text before or after the JSON.';

/** Models that accept (and benefit from) adaptive thinking. budget_tokens 400s here. */
export function supportsAdaptiveThinking(model: string): boolean {
  return (
    /claude-opus-4-(6|7|8)/.test(model) ||
    model.includes('sonnet-4-6') ||
    model.includes('fable-5') ||
    model.includes('mythos-5')
  );
}

export class AnthropicClient implements LLMClient {
  private apiKey: string;
  private clientCached: Anthropic | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  setApiKey(apiKey: string): void {
    if (apiKey === this.apiKey) return;
    this.apiKey = apiKey;
    this.clientCached = null;
  }

  private get client(): Anthropic {
    if (!this.apiKey) throw new Error('Anthropic API Key missing');
    if (!this.clientCached) {
      this.clientCached = new Anthropic({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
    return this.clientCached;
  }

  async generateText(req: LLMRequest): Promise<string> {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: req.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: anthropicMessages(req),
    };
    const system = anthropicSystem(req);
    if (system) params.system = system;
    if (typeof req.temperature === 'number') params.temperature = req.temperature;
    // Adaptive thinking improves the one-shot reasoning calls (specs, analysis).
    if (supportsAdaptiveThinking(req.model)) {
      params.thinking = { type: 'adaptive' };
    }
    const res = await this.client.messages.create(params);
    return extractText(res);
  }

  async *streamText(req: LLMRequest): AsyncIterable<string> {
    // No thinking on the dialogue stream: a thinking pass before the first
    // token makes the chat feel dead (same reasoning as the Gemini path).
    const params: Anthropic.MessageCreateParamsStreaming = {
      model: req.model,
      max_tokens: req.maxTokens ?? STREAM_MAX_TOKENS,
      messages: anthropicMessages(req),
      stream: true,
    };
    const system = anthropicSystem(req);
    if (system) params.system = system;

    const stream = this.client.messages.stream(params);
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }
}

function anthropicSystem(req: LLMRequest): string | undefined {
  const parts = [req.systemInstruction, req.json ? JSON_INSTRUCTION : ''].filter(Boolean);
  return parts.length ? parts.join('\n\n') : undefined;
}

export function anthropicMessages(req: LLMRequest): Anthropic.MessageParam[] {
  const msgs: LLMMessage[] = req.messages
    ? trimToFirstUser(req.messages)
    : [{ role: 'user', text: req.prompt ?? '' }];
  return msgs.map((m) => ({
    role: m.role === 'model' ? 'assistant' : (m.role as 'user' | 'assistant'),
    content: m.text,
  }));
}

function extractText(res: Anthropic.Message): string {
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
