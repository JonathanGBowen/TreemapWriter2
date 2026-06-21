# agent-sidecar — Claude Agent SDK helper

A tiny, standalone Node service that runs the **Claude Agent SDK**
(`@anthropic-ai/claude-agent-sdk`) for TreemapWriter's experimental **Agent
mode**. It exists because the Agent SDK is a Node library that spawns a Claude
Code subprocess — it **cannot** run inside the Tauri webview where the app's AI
calls normally happen.

The app's webview talks to this helper over `localhost` (see
`src/services/ai/clients/agent-sdk-client.ts`). It is **optional and off by
default** — with Agent mode off, the app never contacts it and behaves exactly
as before.

> ⚠️ **Authentication uses your personal Claude Max/Pro subscription.** Anthropic's
> Consumer Terms position subscription OAuth tokens for Claude Code / claude.ai
> use; running one through a custom app is a gray area. This is intended for your
> own single-user tool on your own machine.

## Setup (once)

```sh
cd agent-sidecar
npm install                 # installs the Agent SDK (separate from the app's deps)
claude setup-token          # prints a long-lived OAuth token for your subscription
export CLAUDE_CODE_OAUTH_TOKEN=<paste-the-token>
```

(Alternatively, run `claude login` once and skip the token — the SDK will use
the cached `~/.claude` credentials. The helper deletes `ANTHROPIC_API_KEY` /
`ANTHROPIC_AUTH_TOKEN` at startup so your subscription is used, not API billing.)

## Run

From the repo root:

```sh
npm run agent               # = node agent-sidecar/server.mjs
```

…in a second terminal alongside `npm run dev` (or `npm run tauri:dev`). Then in
the app: **AI settings → Experimental — Claude Agent SDK → Agent mode: On**, and
hit **Check** to confirm the helper is reachable and authenticated.

## Contract

| Route | Method | Body / Response |
|---|---|---|
| `/health` | GET | → `{ ok, authed, model }` |
| `/generate` | POST | `{ model, prompt?, messages?, systemInstruction?, json?, responseJsonSchema?, maxTokens? }` → `{ text }` |
| `/stream` | POST | same body → NDJSON: `{ delta }` per chunk, then `{ done: true }` (or `{ error }`) |

When `responseJsonSchema` is present, the helper uses the SDK's
`outputFormat: { type: 'json_schema', schema }` and serializes the validated
object back as `text` (the app parses it with the same tolerant JSON parser it
uses for every provider).

## Notes

- Runs **tool-less** (`allowedTools: []`, `settingSources: []`) — a pure
  dialogue / structured-output engine, not a coding agent. It will not touch your
  filesystem.
- Default port `8787` (override with `AGENT_SIDECAR_PORT`); must match the
  "Helper URL" in the app's AI settings.
- This folder is excluded from the app's `tsconfig`/ESLint and has its own
  `package.json`, so the Node-only SDK never enters the browser bundle.
