// Local Node helper for TreemapWriter's experimental "Agent mode".
//
// The Claude Agent SDK is a Node library that spawns a Claude Code subprocess;
// it cannot run in the Tauri webview. This tiny HTTP server runs the SDK and
// exposes the same provider-agnostic contract the webview's AgentSdkClient
// speaks (see src/services/ai/clients/agent-sdk-client.ts):
//
//   GET  /health           -> { ok, authed, model }
//   POST /generate|/stream -> typed NDJSON, one object per line:
//        { t:'think', delta } | { t:'text', delta } | { t:'activity', label }
//        | { t:'done', text } (terminal) | { t:'error', error } (terminal)
//   The client collects `done.text` (generateText) or yields `text` deltas
//   (streamText); both forward every line to the UI thinking/activity trace.
//
// JSON is produced via a system-prompt instruction and read back by the app's
// tolerant safeJsonParse + normalizers (Anthropic/Ollama parity) — NOT the SDK's
// strict output_format, which would add a hard-failure mode on the app's
// permissive schemas.
//
// Auth: Max subscription only. We DELETE ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN
// from the environment at startup so the SDK uses the subscription OAuth token
// (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`, or a `claude login`
// session) instead — the API key would otherwise take precedence.
//
// Verified against @anthropic-ai/claude-agent-sdk 0.3.185:
//   query({ prompt, options }); options.{model,systemPrompt,allowedTools,
//   settingSources,permissionMode,includePartialMessages};
//   partial frames -> { type:'stream_event', event: BetaRawMessageStreamEvent }
//   (content_block_delta -> delta.text / delta.thinking);
//   result msg -> { type:'result', subtype:'success', result }.

import { createServer } from 'node:http';

// Max subscription only: clear API-key credentials so subscription OAuth wins.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

const { query } = await import('@anthropic-ai/claude-agent-sdk');

const PORT = Number(process.env.AGENT_SIDECAR_PORT) || 8787;
const DEFAULT_MODEL = process.env.AGENT_SDK_MODEL || 'claude-opus-4-8';
const JSON_INSTRUCTION =
  'Respond with only valid JSON. Do not wrap it in markdown code fences and do not add any text before or after the JSON.';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Flatten the app's provider-agnostic request into a single prompt string. */
function buildPrompt(body) {
  if (Array.isArray(body.messages) && body.messages.length) {
    // Stateless multi-turn (matches the app's design: full history each turn).
    return body.messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n\n');
  }
  return body.prompt ?? '';
}

/** Build the SDK options from the request. Tool-less: a dialogue/structured engine. */
function buildOptions(body) {
  const wantsJson = !!body.json || body.responseJsonSchema !== undefined;
  const systemParts = [body.systemInstruction, wantsJson ? JSON_INSTRUCTION : '']
    .filter(Boolean);
  const options = {
    model: body.model || DEFAULT_MODEL,
    // No tools, no project settings — run purely as a conversation/JSON engine.
    allowedTools: [],
    settingSources: [],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    // Surface live thinking/text deltas so the UI can show an activity trace.
    // (Adds no latency; thinking depth is left at the model's default. Whatever
    // the model exposes — readable thinking deltas, or only token estimates when
    // the chain of thought is redacted — is forwarded as trace events.)
    includePartialMessages: true,
  };
  if (systemParts.length) options.systemPrompt = systemParts.join('\n\n');
  // NOTE: we deliberately do NOT use the SDK's strict `outputFormat`. The app
  // reads JSON back through a tolerant parser (safeJsonParse + a defensive
  // normalizer) exactly as it does for the Anthropic/Ollama providers, so the
  // JSON instruction above is sufficient. Strict output_format adds a
  // hard-failure mode (error_max_structured_output_retries) and risks rejecting
  // the app's permissive schemas (no additionalProperties:false) — not worth it.
  return options;
}

/**
 * Map one SDK message to zero or more typed trace lines. Text + thinking come
 * from the partial `stream_event` frames (includePartialMessages); the redacted
 * thinking phase only yields token estimates, surfaced as an activity line.
 */
function sdkMessageToTraceLines(message) {
  const out = [];
  if (message.type === 'stream_event') {
    const ev = message.event;
    if (ev && ev.type === 'content_block_delta' && ev.delta) {
      if (ev.delta.type === 'text_delta' && ev.delta.text) {
        out.push({ t: 'text', delta: ev.delta.text });
      } else if (ev.delta.type === 'thinking_delta' && ev.delta.thinking) {
        out.push({ t: 'think', delta: ev.delta.thinking });
      }
    }
  } else if (message.type === 'system' && message.subtype === 'thinking_tokens') {
    out.push({ t: 'activity', label: `thinking… ~${message.estimated_tokens ?? '?'} tokens` });
  }
  return out;
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

/**
 * Shared handler for /generate and /stream: runs the SDK and streams typed NDJSON
 * trace events. The client collects the terminal `done` (generateText) or yields
 * `text` deltas (streamText); both forward all events to the UI trace.
 */
async function handleRun(body, res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', ...CORS });
  const write = (obj) => res.write(JSON.stringify(obj) + '\n');
  let acc = '';
  try {
    for await (const message of query({ prompt: buildPrompt(body), options: buildOptions(body) })) {
      if (message.type === 'result') {
        if (message.subtype !== 'success') {
          write({ t: 'error', error: message.result || `Agent run failed (${message.subtype}).` });
          res.end();
          return;
        }
        // Final text comes from the authoritative `result`. For JSON kinds the app
        // reads it back via its tolerant safeJsonParse — Anthropic/Ollama parity.
        write({ t: 'done', text: message.result || acc });
      } else {
        for (const line of sdkMessageToTraceLines(message)) {
          if (line.t === 'text') acc += line.delta;
          write(line);
        }
      }
    }
  } catch (e) {
    write({ t: 'error', error: e instanceof Error ? e.message : String(e) });
  }
  res.end();
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  try {
    if (req.method === 'GET' && req.url === '/health') {
      send(res, 200, {
        ok: true,
        authed: !!process.env.CLAUDE_CODE_OAUTH_TOKEN,
        model: DEFAULT_MODEL,
      });
      return;
    }
    if (req.method === 'POST' && (req.url === '/generate' || req.url === '/stream')) {
      await handleRun(await readJson(req), res);
      return;
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) send(res, 502, { error: msg });
    else res.end();
  }
});

server.listen(PORT, () => {
  const authed = !!process.env.CLAUDE_CODE_OAUTH_TOKEN;
  console.log(`[agent-sidecar] listening on http://localhost:${PORT} (model: ${DEFAULT_MODEL})`);
  if (!authed) {
    console.warn(
      '[agent-sidecar] No CLAUDE_CODE_OAUTH_TOKEN set. Run `claude setup-token` and export it,\n' +
        '                 or `claude login` so the SDK can use your Max subscription.',
    );
  }
});
