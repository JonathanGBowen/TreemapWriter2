import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { DEFAULT_COMPARE_LENSES } from '../../lib/defaultCompareLenses';
import { DEFAULT_SPELLS } from '../../lib/defaultSpells';
import { resolveOperand, sharedTitles } from '../../lib/compareHelpers';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { checkContextFit } from '../../services/ai/context-budget';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * Orchestration for the Version Compare workspace: resolve the two operands +
 * the active lens, pre-flight the context budget, call the provider, and land
 * the verdict in the slice. Components → this hook → slice actions + aiProvider;
 * the SDK never crosses into feature code.
 *
 * Reads live state via `getState()` at call time so the callback keeps a stable
 * identity and always sees the current selection.
 */
export const useComparisonActions = () => {
  const setComparison = useStore((s) => s.setComparison);
  const setComparisonStatus = useStore((s) => s.setComparisonStatus);

  const runComparison = useCallback(async () => {
    const {
      localContent,
      versionAId,
      versionBId,
      loadedA,
      loadedB,
      activeCompareLensId,
      compareMode,
      comparisonStatus,
      promptsConfig,
      customSpells,
      modelConfig,
      globalModelDefault,
      modelCatalog,
    } = useStore.getState();

    if (comparisonStatus === 'running') return;

    const a = resolveOperand(versionAId, loadedA, localContent);
    const b = resolveOperand(versionBId, loadedB, localContent);
    if (!a || !b) {
      toast.error('That version is still loading — try again in a moment.');
      return;
    }
    if (a.markdown === b.markdown) {
      toast.error('Pick two different versions to compare.');
      return;
    }

    // The active lens, if any: built-in compare lenses + built-in Grimoire spells
    // + the user's custom spells. null id = a plain comparison with no overlay.
    const lens = activeCompareLensId
      ? [...DEFAULT_COMPARE_LENSES, ...DEFAULT_SPELLS, ...customSpells].find(
          (s) => s.id === activeCompareLensId,
        )
      : undefined;

    // Pre-flight the context budget on both drafts (mirrors whole-document
    // analysis): abort and ask for a larger-context model rather than truncating.
    const choice = resolveModelChoice('compareVersions', modelConfig, globalModelDefault);
    const fit = checkContextFit(modelCatalog, choice, `${a.markdown}\n\n${b.markdown}`);
    if (fit.overflow) {
      toast.error(
        `Both versions together (~${Math.round(fit.estimatedTokens / 1000)}k tokens) exceed ${choice.model}'s context window. Switch the "Compare versions" model to a larger-context one (e.g. Gemini 3.1 Pro) to compare without truncation.`,
      );
      return;
    }

    setComparisonStatus('running');
    try {
      const result = await aiProvider.compareVersions({
        labelA: a.label,
        labelB: b.label,
        markdownA: a.markdown,
        markdownB: b.markdown,
        sharedTitles: sharedTitles(a.markdown, b.markdown),
        lens: lens ? { persona: lens.persona, lens: lens.lens } : undefined,
        mode: compareMode,
        config: promptsConfig,
      });
      setComparison({ ...result, mode: compareMode, ...(lens ? { lensName: lens.name } : {}) });
      setComparisonStatus('idle');
    } catch (e) {
      setComparisonStatus('error');
      toast.error(`Comparison failed: ${errMessage(e)}`);
    }
  }, [setComparison, setComparisonStatus]);

  return { runComparison };
};
