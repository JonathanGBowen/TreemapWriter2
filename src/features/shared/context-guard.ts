// Shared token-budget pre-flight for AI callers.
//
// The architectural law (AGENTS.md / services/ai/context-budget) is "never
// silently truncate": before a call that sends source/section text we estimate
// the token cost and compare it to the chosen model's context window. On genuine
// overflow the caller aborts and asks for a larger-context model rather than
// slicing the text. This wraps that check + the standard toast so every caller
// behaves identically (cf. the inline checks in use-comparison-actions,
// use-analysis-actions, and App.tsx, which predate this helper).

import { toast } from 'sonner';
import type { CatalogModel } from '../../services/ai/model-catalog';
import type { ModelChoice } from '../../services/ai/model-types';
import { checkContextFit } from '../../services/ai/context-budget';

interface GuardContextFitArgs {
  catalog: CatalogModel[];
  choice: ModelChoice;
  /** The full text about to be sent — never a slice. */
  text: string;
  /** Sentence subject for the toast, e.g. "This section and its sources". */
  what: string;
  /** The model-picker label to point the user at, e.g. "Generate revisions". */
  setting: string;
}

/**
 * Returns true when it is safe to send `text` whole. On genuine overflow it
 * shows the standard toast and returns false so the caller aborts instead of
 * truncating. An unknown window (e.g. a detected Ollama model) proceeds.
 */
export const guardContextFit = ({
  catalog,
  choice,
  text,
  what,
  setting,
}: GuardContextFitArgs): boolean => {
  const fit = checkContextFit(catalog, choice, text);
  if (fit.overflow) {
    toast.error(
      `${what} (~${Math.round(fit.estimatedTokens / 1000)}k tokens) exceeds ${choice.model}'s ` +
        `context window. Switch the "${setting}" model to a larger-context one ` +
        `(e.g. Gemini 3.1 Pro) to send the full text without truncation.`,
    );
    return false;
  }
  return true;
};
