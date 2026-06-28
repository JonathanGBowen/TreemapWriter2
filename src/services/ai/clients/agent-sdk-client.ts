// Claude Agent SDK transport — the ONE webview file that knows the local helper's
// HTTP contract. The Agent SDK itself is a Node library that spawns a Claude Code
// subprocess; it CANNOT run in the webview. So this client is a thin proxy: it
// forwards provider-agnostic LLMRequests to a small Node helper (see
// `agent-sidecar/`) on localhost, which runs the SDK against the user's Claude
// subscription. The SDK is never imported here — only an HTTP contract — so it
// never enters the browser bundle.
//
// Both endpoints stream the same typed NDJSON event schema (one JSON object per line):
//   { t: 'think',    delta }   // thinking-token delta (live reasoning)
//   { t: 'text',     delta }   // assistant text delta
//   { t: 'activity', label }   // coarse step / progress note
//   { t: 'done',     text  }   // terminal: the final result text
//   { t: 'error',    error }   // terminal: failure
// `generateText` collects to `done`; `streamText` yields `text` deltas. Both also
// forward every event to an injected trace sink (see setAgentTraceSink) so the UI
// can show a live thinking/activity trace and save it for optional auditing.

import type { LLMClient, LLMRequest } from './llm-client';
import { emitAgentTrace as emit, newRunId } from './agent-trace-sink';

export const DEFAULT_AGENT_SIDECAR_URL = 'http://localhost:8787';

export interface AgentSidecarHealth {
  ok: boolean;
  /** Whether the helper found a CLAUDE_CODE_OAUTH_TOKEN (Max subscription). */
  authed: boolean;
  model?: string;
}

/** Body sent to the helper. Pure + exported so it can be unit-tested. (Trace fields stay client-side.) */
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

export type TraceLine =
  | { t: 'think'; delta: string }
  | { t: 'text'; delta: string }
  | { t: 'activity'; label: string }
  | { t: 'done'; text: string };

/** Parse one NDJSON line into a typed event (or null to skip); throws on an error line. */
export function parseTraceLine(line: string): TraceLine | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof obj.error === 'string') throw new Error(obj.error);
  switch (obj.t) {
    case 'think':
      return typeof obj.delta === 'string' ? { t: 'think', delta: obj.delta } : null;
    case 'text':
      return typeof obj.delta === 'string' ? { t: 'text', delta: obj.delta } : null;
    case 'activity':
      return typeof obj.label === 'string' ? { t: 'activity', label: obj.label } : null;
    case 'done':
      return { t: 'done', text: typeof obj.text === 'string' ? obj.text : '' };
    default:
      return null;
  }
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
    const runId = this.startRun(req);
    let acc = '';
    let finalText = '';
    try {
      const res = await this.post('/generate', req);
      for await (const line of readNdjson(res)) {
        const ev = parseTraceLine(line);
        if (!ev) continue;
        if (ev.t === 'text') {
          acc += ev.delta;
          emit({ type: 'text', runId, delta: ev.delta, at: Date.now() });
        } else if (ev.t === 'think') {
          emit({ type: 'think', runId, delta: ev.delta, at: Date.now() });
        } else if (ev.t === 'activity') {
          emit({ type: 'activity', runId, label: ev.label, at: Date.now() });
        } else if (ev.t === 'done') {
          finalText = ev.text || acc;
        }
      }
      emit({ type: 'end', runId, status: 'success', at: Date.now() });
      return finalText || acc;
    } catch (e) {
      emit({ type: 'end', runId, status: 'error', errorMessage: errMsg(e), at: Date.now() });
      throw e;
    }
  }

  async *streamText(req: LLMRequest): AsyncIterable<string> {
    const runId = this.startRun(req);
    let yielded = false;
    try {
      const res = await this.post('/stream', req);
      for await (const line of readNdjson(res)) {
        const ev = parseTraceLine(line);
        if (!ev) continue;
        if (ev.t === 'text') {
          emit({ type: 'text', runId, delta: ev.delta, at: Date.now() });
          yielded = true;
          yield ev.delta;
        } else if (ev.t === 'think') {
          emit({ type: 'think', runId, delta: ev.delta, at: Date.now() });
        } else if (ev.t === 'activity') {
          emit({ type: 'activity', runId, label: ev.label, at: Date.now() });
        } else if (ev.t === 'done') {
          // Fallback: if no text deltas streamed (e.g. partials were sparse),
          // emit the authoritative final text so the caller isn't left empty.
          if (!yielded && ev.text) yield ev.text;
          break;
        }
      }
      emit({ type: 'end', runId, status: 'success', at: Date.now() });
    } catch (e) {
      emit({ type: 'end', runId, status: 'error', errorMessage: errMsg(e), at: Date.now() });
      throw e;
    }
  }

  private startRun(req: LLMRequest): string {
    const runId = newRunId();
    emit({
      type: 'start',
      runId,
      label: req.traceLabel,
      callKind: req.traceKind,
      model: req.model,
      at: Date.now(),
    });
    return runId;
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
    if (!res.ok || !res.body) {
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

/** Read a fetch response body as newline-delimited JSON lines. */
async function* readNdjson(res: Response): AsyncIterable<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield line;
    }
  }
  const tail = buffer.trim();
  if (tail) yield tail;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function normalizeBaseUrl(url: string): string {
  const trimmed = (url || DEFAULT_AGENT_SIDECAR_URL).trim();
  return trimmed.replace(/\/+$/, '');
}
