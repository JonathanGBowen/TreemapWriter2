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

import {
  GeminiClient,
  AnthropicClient,
  OllamaClient,
  AgentSdkClient,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_AGENT_SIDECAR_URL,
} from './ai/clients';
import type { AgentSidecarHealth } from './ai/clients';
// Re-exported so boot can wire the trace store into the agent client without the
// client importing the store (mirrors setModelConfigSource).
export { setAgentTraceSink } from './ai/clients';
export type { AgentTraceSinkEvent } from './ai/clients';
import { MultiProviderAIProvider } from './ai/ai-provider.impl';
import { resolveModelChoice } from './ai/resolve-model-choice';
import { ModelCooldowns } from './ai/model-fallback';
import type { CooldownSnapshot, FallbackSettings } from './ai/model-fallback';
import { DEFAULT_FALLBACK_SETTINGS } from './ai/model-defaults';
import { RequestThrottle } from './ai/request-throttle';
import { DEFAULT_CATALOG } from './ai/model-catalog';
import type { CatalogModel } from './ai/model-catalog';
import { getSecret } from './credentials';
import { isTauri } from './tauri-environment';
import type { AIProvider } from './ai-provider';
import type { AICallKind, ModelConfig, ProviderId } from './ai/model-types';

const geminiKey = process.env.API_KEY || '';
const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

const gemini = new GeminiClient(geminiKey);
const anthropic = new AnthropicClient(anthropicKey);
const ollama = new OllamaClient(DEFAULT_OLLAMA_BASE_URL);
// Experimental: proxies to the local Node helper running the Claude Agent SDK.
// Constructed unconditionally but only dispatched to when Agent mode routes a
// call kind to the 'agent-sdk' provider (default off).
const agentSdk = new AgentSdkClient(DEFAULT_AGENT_SIDECAR_URL);

/** Where the resolver reads the active per-project + global model config from. */
export interface ModelConfigSource {
  projectConfig?: ModelConfig | null;
  globalDefault?: ModelConfig | null;
  /** Global "Agent mode" toggle — routes dialogue + coaching to the Agent SDK. */
  agentMode?: boolean;
  /** The agent-sdk model id to run when Agent mode is on. */
  agentModel?: string;
}

let configSource: () => ModelConfigSource = () => ({});

/** Boot wires the store in here so resolution sees the live config. */
export function setModelConfigSource(source: () => ModelConfigSource): void {
  configSource = source;
}

const resolveChoice = (kind: AICallKind) => {
  const { projectConfig, globalDefault, agentMode, agentModel } = configSource();
  const agent =
    agentMode && agentModel ? { enabled: true, model: agentModel } : undefined;
  return resolveModelChoice(kind, projectConfig, globalDefault, agent);
};

// --- Quota fallback ------------------------------------------------------
// The shared cooldown registry + the live fallback settings/catalog source. The
// dispatch wrapper in MultiProviderAIProvider reads these. Boot wires the store
// in via setFallbackSource (mirrors setModelConfigSource) and forwards cooldown
// changes to the UI via setCooldownSink (mirrors setAgentTraceSink). Cooldown
// persistence is the store's write-through job (see ai-state.setModelCooldowns).

const cooldowns = new ModelCooldowns();
let cooldownSink: ((snapshot: CooldownSnapshot) => void) | null = null;
cooldowns.setSink((snapshot) => cooldownSink?.(snapshot));

/** Boot forwards cooldown changes into the store so the settings UI can show them. */
export function setCooldownSink(sink: (snapshot: CooldownSnapshot) => void): void {
  cooldownSink = sink;
}

/** Seed the cooldown registry from persisted state at boot. */
export function seedCooldowns(snapshot: CooldownSnapshot): void {
  cooldowns.load(snapshot);
}

/** Lift a cooldown manually (the settings UI's "Clear"). */
export function clearModelCooldown(provider: ProviderId, model: string): void {
  cooldowns.clear(provider, model);
}

interface FallbackContext {
  settings: FallbackSettings;
  catalog: CatalogModel[];
}
let fallbackSource: () => FallbackContext = () => ({
  settings: DEFAULT_FALLBACK_SETTINGS,
  catalog: DEFAULT_CATALOG,
});

/** Boot wires the store's fallback settings + catalog in here. */
export function setFallbackSource(source: () => FallbackContext): void {
  fallbackSource = source;
}

// Proactive per-minute throttle (limits read from the catalog's requestsPerMinute).
// Its "is anything waiting?" signal is forwarded to the UI so a throttle wait reads
// as "queued", never as a hang. Boot wires the sink in (mirrors setCooldownSink).
let throttleWaitSink: ((waiting: boolean) => void) | null = null;
const throttle = new RequestThrottle(undefined, (waiting) => throttleWaitSink?.(waiting));

/** Boot forwards throttle-wait changes into the store so the activity pill can show "queued". */
export function setThrottleWaitSink(sink: (waiting: boolean) => void): void {
  throttleWaitSink = sink;
}

const impl = new MultiProviderAIProvider({ gemini, anthropic, ollama, agentSdk }, resolveChoice, {
  getContext: () => fallbackSource(),
  cooldowns,
  throttle,
});

export const aiProvider: AIProvider = impl;

// Fire-and-forget keyring lookups. The env fallback remains in effect either
// way. In the browser a failure is expected (no keyring) and stays silent; on
// desktop a failure is worth a distinct console warning — it explains why a key
// saved to the keyring isn't taking effect (e.g. Linux without a Secret Service
// daemon), which is otherwise indistinguishable from "no key set".
const onKeyringFail = (provider: string) => (e: unknown) => {
  if (isTauri()) console.warn(`Keyring lookup for ${provider} failed; using env/.env.local fallback if present.`, e);
};
void getSecret('gemini')
  .then((k) => { if (k && k.length > 0) gemini.setApiKey(k); })
  .catch(onKeyringFail('Gemini'));
void getSecret('anthropic')
  .then((k) => { if (k && k.length > 0) anthropic.setApiKey(k); })
  .catch(onKeyringFail('Anthropic'));

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

/** Point the Agent SDK transport at the local helper's URL (global preference). */
export function setAgentSidecarUrl(url: string): void {
  if (url && url.length > 0) agentSdk.setBaseUrl(url);
}

/** Probe the Agent SDK helper for reachability + auth (for the settings UI). */
export async function pingAgentSidecar(url?: string): Promise<AgentSidecarHealth> {
  if (url) agentSdk.setBaseUrl(url);
  return agentSdk.ping();
}

/** List installed Ollama models for the editable catalog (GET /api/tags). */
export async function detectOllamaModels(baseUrl?: string): Promise<string[]> {
  if (baseUrl) ollama.setBaseUrl(baseUrl);
  return ollama.listModels();
}
