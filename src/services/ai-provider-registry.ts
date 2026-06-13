// AI provider registry / dependency-injection point.
//
// Picks the active AIProvider at module load and owns transport + key sourcing
// for all three providers. Components and slices import `aiProvider` and stay
// ignorant of which provider/model runs any given call. Mirrors
// `repository-registry.ts` — one concern, one registry.
//
// Key sourcing (per provider):
//   1. Eager construction with the build-time env key (Vite-baked from
//      .env.local) so existing setups keep working with no behavior change.
//   2. Background `getSecret(service)` — a key set in the OS keyring (via the
//      AI Settings modal) supersedes the env fallback. On desktop the Rust side
//      also falls back to the process env, so the keyring lookup returns the
//      .env.local value even when nothing was explicitly saved.
//
// Model resolution is injected: `setModelConfigSource` lets boot wire the store
// in without this module importing the store (avoids a cycle).

import { GeminiClient, AnthropicClient, OllamaClient, DEFAULT_OLLAMA_BASE_URL } from './ai/clients';
import { MultiProviderAIProvider } from './ai/ai-provider.impl';
import { resolveModelChoice } from './ai/resolve-model-choice';
import { getSecret } from './credentials';
import type { AIProvider } from './ai-provider';
import type { AICallKind, ModelConfig } from './ai/model-types';

const geminiKey = process.env.API_KEY || '';
const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

const gemini = new GeminiClient(geminiKey);
const anthropic = new AnthropicClient(anthropicKey);
const ollama = new OllamaClient(DEFAULT_OLLAMA_BASE_URL);

/** Where the resolver reads the active per-project + global model config from. */
export interface ModelConfigSource {
  projectConfig?: ModelConfig | null;
  globalDefault?: ModelConfig | null;
}

let configSource: () => ModelConfigSource = () => ({});

/** Boot wires the store in here so resolution sees the live config. */
export function setModelConfigSource(source: () => ModelConfigSource): void {
  configSource = source;
}

const resolveChoice = (kind: AICallKind) => {
  const { projectConfig, globalDefault } = configSource();
  return resolveModelChoice(kind, projectConfig, globalDefault);
};

const impl = new MultiProviderAIProvider({ gemini, anthropic, ollama }, resolveChoice);

export const aiProvider: AIProvider = impl;

// Fire-and-forget keyring lookups. Errors (browser mode, Linux without Secret
// Service, etc.) are swallowed — the env fallback remains in effect.
void getSecret('gemini')
  .then((k) => { if (k && k.length > 0) gemini.setApiKey(k); })
  .catch(() => {});
void getSecret('anthropic')
  .then((k) => { if (k && k.length > 0) anthropic.setApiKey(k); })
  .catch(() => {});

/** Called by the AI Settings modal after the user saves a Gemini key. */
export function refreshGeminiKey(newKey: string): void {
  if (newKey && newKey.length > 0) gemini.setApiKey(newKey);
}

/** Called by the AI Settings modal after the user saves an Anthropic key. */
export function refreshAnthropicKey(newKey: string): void {
  if (newKey && newKey.length > 0) anthropic.setApiKey(newKey);
}

/** Point the Ollama transport at a new local endpoint (global preference). */
export function setOllamaBaseUrl(url: string): void {
  if (url && url.length > 0) ollama.setBaseUrl(url);
}

/** List installed Ollama models for the editable catalog (GET /api/tags). */
export async function detectOllamaModels(baseUrl?: string): Promise<string[]> {
  if (baseUrl) ollama.setBaseUrl(baseUrl);
  return ollama.listModels();
}
