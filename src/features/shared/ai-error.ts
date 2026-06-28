import { toast } from 'sonner';
import { useStore } from '../../store';
import { AllModelsExhaustedError, formatResetEt } from '../../services/ai/model-fallback';

/** Soonest daily-quota reset across the models currently on cooldown, e.g. "3:00 AM ET". */
function soonestResetLabel(): string | null {
  const snapshot = useStore.getState().modelCooldowns;
  if (!Array.isArray(snapshot) || snapshot.length === 0) return null;
  const soonest = snapshot.reduce((a, b) => (a.resetUtc <= b.resetUtc ? a : b));
  return formatResetEt(soonest.resetUtc);
}

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
  if (e instanceof AllModelsExhaustedError) {
    const openSettings = {
      action: {
        label: 'AI Settings',
        onClick: () => useStore.getState().setShowPersonaModal(true),
      },
    };
    if (e.reason === 'context') {
      toast.error(
        'No available model can hold this request. Try a larger-context model or shorter input.',
        openSettings,
      );
      return;
    }
    if (e.reason === 'rate-limit') {
      // A per-MINUTE limit (or transient overload), NOT the daily quota — the user
      // should wait seconds, not hours. This is the distinction that was conflated.
      const secs = e.retryAfterMs ? Math.max(1, Math.round(e.retryAfterMs / 1000)) : null;
      toast.error(
        secs
          ? `Models are briefly rate-limited (per-minute quota). Wait ~${secs}s and try again.`
          : 'Models are briefly rate-limited (per-minute quota). Wait a moment and try again.',
        openSettings,
      );
      return;
    }
    // reason === 'quota' — every model is out of its per-DAY quota until the reset.
    const reset = soonestResetLabel();
    toast.error(
      reset
        ? `All fallback models are out of their daily quota (resets ${reset}). Try again later, or adjust the fallback ladder in AI Settings.`
        : 'All fallback models are out of their daily quota. Try again later, or adjust the fallback ladder in AI Settings.',
      openSettings,
    );
    return;
  }
  toast.error(fallback);
}
