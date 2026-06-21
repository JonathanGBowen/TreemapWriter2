// Local Node helper for TreemapWriter's experimental "Agent mode".
//
// The Claude Agent SDK is a Node library that spawns a Claude Code subprocess;
// it cannot run in the Tauri webview. This tiny HTTP server runs the SDK and
// exposes the same provider-agnostic contract the webview's AgentSdkClient
// speaks (see src/services/ai/clients/agent-sdk-client.ts):
//
//   GET  /health   -> { ok, authed, model }
//   POST /generate -> { text }                          (final result text)
//   POST /stream   -> NDJSON: { delta } per chunk, then { done: true } (or { error })
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
//   assistant msg -> message.message.content;
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
    includePartialMessages: false,
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

/** Concatenate the text blocks of an assistant message. */
function assistantText(message) {
  const content = message?.message?.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function handleGenerate(body, res) {
  let acc = '';
  let finalText = '';
  for await (const message of query({ prompt: buildPrompt(body), options: buildOptions(body) })) {
    if (message.type === 'assistant') {
      acc += assistantText(message);
    } else if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(message.result || `Agent run failed (${message.subtype}).`);
      }
      finalText = message.result || acc;
    }
  }
  // The final result text is returned as-is. For JSON kinds the app reads it
  // back through its tolerant safeJsonParse (which extracts the object even from
  // surrounding prose) + a defensive normalizer — the same path the Anthropic
  // and Ollama providers use.
  send(res, 200, { text: finalText || acc });
}

async function handleStream(body, res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', ...CORS });
  try {
    for await (const message of query({ prompt: buildPrompt(body), options: buildOptions(body) })) {
      if (message.type === 'assistant') {
        const text = assistantText(message);
        if (text) res.write(JSON.stringify({ delta: text }) + '\n');
      } else if (message.type === 'result' && message.subtype !== 'success') {
        res.write(JSON.stringify({ error: message.result || 'Agent run failed.' }) + '\n');
      }
    }
    res.write(JSON.stringify({ done: true }) + '\n');
  } catch (e) {
    res.write(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) + '\n');
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
    if (req.method === 'POST' && req.url === '/generate') {
      await handleGenerate(await readJson(req), res);
      return;
    }
    if (req.method === 'POST' && req.url === '/stream') {
      await handleStream(await readJson(req), res);
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
