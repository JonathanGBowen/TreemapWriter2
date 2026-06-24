// Ollama transport. No SDK — Ollama exposes a plain HTTP API on the local
// machine. No API key; the base URL is a per-machine global preference.
//
// CORS caveat: from the Tauri webview the request origin may be blocked unless
// the user sets OLLAMA_ORIGINS to include it. Errors are surfaced to the caller
// (the AI Settings panel shows a hint).

import type { LLMClient, LLMRequest, LLMMessage } from './llm-client';
import { trimToFirstUser } from './llm-client';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaClient implements LLMClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_OLLAMA_BASE_URL) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  /** Installed local models, from GET /api/tags. Used to auto-populate the catalog. */
  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status}`);
    const json = (await res.json()) as { models?: Array<{ name?: string }> };
    return (json.models ?? []).map((m) => m.name).filter((n): n is string => !!n);
  }

  async generateText(req: LLMRequest): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.model,
        messages: ollamaMessages(req),
        stream: false,
        ...(req.json ? { format: 'json' } : {}),
        ...(typeof req.temperature === 'number' ? { options: { temperature: req.temperature } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Ollama /api/chat failed: ${res.status}`);
    const json = (await res.json()) as { message?: { content?: string } };
    return json.message?.content ?? '';
  }

  async *streamText(req: LLMRequest): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.model,
        messages: ollamaMessages(req),
        stream: true,
        ...(req.json ? { format: 'json' } : {}),
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama /api/chat failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // Ollama streams newline-delimited JSON objects, one per chunk.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const chunk = parseChunk(line);
        if (chunk) yield chunk;
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const chunk = parseChunk(tail);
      if (chunk) yield chunk;
    }
  }
}

function parseChunk(line: string): string | null {
  try {
    const obj = JSON.parse(line) as { message?: { content?: string } };
    return obj.message?.content ?? null;
  } catch {
    return null;
  }
}

export function ollamaMessages(req: LLMRequest): OllamaChatMessage[] {
  const out: OllamaChatMessage[] = [];
  if (req.systemInstruction) out.push({ role: 'system', content: req.systemInstruction });
  const history: LLMMessage[] = req.messages
    ? trimToFirstUser(req.messages)
    : [{ role: 'user', text: req.prompt ?? '' }];
  for (const m of history) {
    out.push({ role: m.role === 'model' ? 'assistant' : (m.role as 'user' | 'assistant'), content: m.text });
  }
  return out;
}

function normalizeBaseUrl(url: string): string {
  const trimmed = (url || DEFAULT_OLLAMA_BASE_URL).trim();
  return trimmed.replace(/\/+$/, '');
}
