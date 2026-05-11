// Phase 3.5 — AI provider registry / dependency injection point.
// Phase 4f — key sourcing tries the OS keyring first, env as fallback.
//
// Picks the active AIProvider at module load. Today the only impl is Gemini,
// but the indirection is what lets components and slices stay ignorant of
// the SDK. Mirrors `repository-registry.ts` deliberately — one concern, one
// registry, frozen for the session.
//
// Key sourcing:
//   1. Eager construction with the env API_KEY so the registry is sync and
//      existing .env.local users see no behavior change.
//   2. Background `await getSecret('gemini')` — if a key is in the OS
//      keyring, the registry calls `setApiKey` on the GeminiProvider, which
//      invalidates its cached SDK client. Next AI call uses the keyring key.
//
// Vite defines both `process.env.API_KEY` and `process.env.GEMINI_API_KEY`
// from the same `.env` entry; we use API_KEY as the canonical name.

import { GeminiProvider } from './gemini-provider';
import { getSecret } from './credentials';
import type { AIProvider } from './ai-provider';

const envKey = process.env.API_KEY || '';

const impl = new GeminiProvider(envKey);

export const aiProvider: AIProvider = impl;

// Fire-and-forget keyring lookup. If the user has set the Gemini key via
// PersonaSettingsModal, that supersedes the env fallback. Errors (browser
// mode, keyring unavailable on Linux without Secret Service, etc.) are
// silently absorbed — the env key still works as the fallback path.
void getSecret('gemini')
  .then((keyringKey) => {
    if (keyringKey && keyringKey.length > 0) {
      impl.setApiKey(keyringKey);
    }
  })
  .catch(() => {
    // Intentionally swallowed — env fallback remains in effect.
  });

/**
 * Phase 4f — let the UI inform the registry that the user just set a new
 * key in the keyring. Called by PersonaSettingsModal's save handler so
 * the next AI call picks up the new value without a restart.
 */
export function refreshGeminiKey(newKey: string): void {
  if (newKey && newKey.length > 0) {
    impl.setApiKey(newKey);
  }
}
