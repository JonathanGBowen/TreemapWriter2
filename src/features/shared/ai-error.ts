import { toast } from 'sonner';
import { useStore } from '../../store';

// Matches the "no/!invalid API key" family of messages thrown by the LLM
// clients ("API Key missing", "Anthropic API Key missing") and by the provider
// SDKs on a bad key ("invalid x-api-key", "API key not valid").
const KEY_ERROR_RE = /api[\s_-]?key|missing key/i;

/** True when a failed AI call is attributable to a missing/invalid API key. */
export function isMissingKeyError(e: unknown): boolean {
  return KEY_ERROR_RE.test(String((e as { message?: string })?.message ?? ''));
}

/**
 * Surface a failed AI call to the user. A missing-key failure (the common
 * first-run case) gets a specific message and a one-click shortcut into the AI
 * settings, instead of the old generic "check your connection and API key"
 * toast that left the user guessing which it was. The AI settings live inside
 * the persona/settings modal (`showPersonaModal`).
 */
export function notifyAiError(e: unknown, fallback: string): void {
  if (isMissingKeyError(e)) {
    toast.error('No API key set for the selected model. Add your Gemini or Anthropic key in AI Settings.', {
      action: {
        label: 'AI Settings',
        onClick: () => useStore.getState().setShowPersonaModal(true),
      },
    });
    return;
  }
  toast.error(fallback);
}
