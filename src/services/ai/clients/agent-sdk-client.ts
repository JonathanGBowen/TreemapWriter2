// Claude Agent SDK transport — the ONE webview file that knows the local helper's
// HTTP contract. The Agent SDK itself is a Node library that spawns a Claude Code
// subprocess; it CANNOT run in the webview. So this client is a thin proxy: it
// forwards provider-agnostic LLMRequests to a small Node helper (see
// `agent-sidecar/`) on localhost, which runs the SDK against the user's Claude
// subscription and streams text back. The SDK is never imported here — only an
// HTTP contract — so it never enters the browser bundle.
//
// Wire contract (kept deliberately tiny, mirrors the Ollama NDJSON streaming):
//   GET  /health   -> { ok: boolean, authed: boolean, model?: string }
//   POST /generate -> { text: string }            (or { error } on failure)
//   POST /stream   -> NDJSON lines: { delta } per chunk, then { done: true }
//                     (or a { error } line); same framing as Ollama's /api/chat.

import type { LLMClient, LLMRequest } from './llm-client';

export const DEFAULT_AGENT_SIDECAR_URL = 'http://localhost:8787';

export interface AgentSidecarHealth {
  ok: boolean;
  /** Whether the helper found a CLAUDE_CODE_OAUTH_TOKEN (Max subscription). */
  authed: boolean;
  model?: string;
}

/** Body sent to the helper. Pure + exported so it can be unit-tested. */
export interface AgentRequestBody {
  model: string;
  prompt?: string;
  messages?: { role: 'user' | 'model' | 'assistant'; text: string }[];
  systemInstruction?: string;
  json?: boolean;
  responseJsonSchema?: unknown;
  maxTokens?: number;
}

export function buildAgentRequestBody(req: LLMRequest): AgentRequestBody {
  return {
    model: req.model,
    ...(req.prompt !== undefined ? { prompt: req.prompt } : {}),
    ...(req.messages ? { messages: req.messages } : {}),
    ...(req.systemInstruction ? { systemInstruction: req.systemInstruction } : {}),
    ...(req.json ? { json: true } : {}),
    ...(req.responseJsonSchema !== undefined
      ? { responseJsonSchema: req.responseJsonSchema }
      : {}),
    ...(typeof req.maxTokens === 'number' ? { maxTokens: req.maxTokens } : {}),
  };
}

/** Parse one NDJSON stream line into a delta, or throw on an error line. */
export function parseStreamLine(line: string): string | null {
  let obj: { delta?: unknown; error?: unknown; done?: unknown };
  try {
    obj = JSON.parse(line) as typeof obj;
  } catch {
    return null;
  }
  if (typeof obj.error === 'string') throw new Error(obj.error);
  if (obj.done) return null;
  return typeof obj.delta === 'string' ? obj.delta : null;
}

const UNREACHABLE =
  'Claude Agent SDK helper not reachable. Start it (npm run agent) or turn off Agent mode in AI settings.';

export class AgentSdkClient implements LLMClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_AGENT_SIDECAR_URL) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  /** Reachability + auth probe for the AI Settings status indicator. */
  async ping(): Promise<AgentSidecarHealth> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return { ok: false, authed: false };
      const json = (await res.json()) as Partial<AgentSidecarHealth>;
      return { ok: !!json.ok, authed: !!json.authed, model: json.model };
    } catch {
      return { ok: false, authed: false };
    }
  }

  async generateText(req: LLMRequest): Promise<string> {
    const res = await this.post('/generate', req);
    const json = (await res.json()) as { text?: string; error?: string };
    if (json.error) throw new Error(json.error);
    return json.text ?? '';
  }

  async *streamText(req: LLMRequest): AsyncIterable<string> {
    const res = await this.post('/stream', req);
    if (!res.body) throw new Error('Agent SDK helper returned no stream body.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // Newline-delimited JSON, one object per chunk (same framing as Ollama).
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const delta = parseStreamLine(line);
        if (delta) yield delta;
      }
    }
    const tail = buffer.trim();
    if (tail) {
      const delta = parseStreamLine(tail);
      if (delta) yield delta;
    }
  }

  private async post(path: string, req: LLMRequest): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAgentRequestBody(req)),
      });
    } catch {
      throw new Error(UNREACHABLE);
    }
    if (!res.ok) {
      // The helper sends a JSON { error } body on known failures; fall back to status.
      const detail = await res
        .clone()
        .json()
        .then((j: { error?: string }) => j.error)
        .catch(() => undefined);
      throw new Error(detail || `Agent SDK helper failed: ${res.status}`);
    }
    return res;
  }
}

function normalizeBaseUrl(url: string): string {
  const trimmed = (url || DEFAULT_AGENT_SIDECAR_URL).trim();
  return trimmed.replace(/\/+$/, '');
}
