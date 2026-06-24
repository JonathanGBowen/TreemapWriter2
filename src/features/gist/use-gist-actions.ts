import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { notifyAiError } from '../shared/ai-error';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { computeHash } from '../../lib/utils';
import { anchorFor } from '../../lib/paragraph-helpers';
import {
  buildSegmentation,
  computeBudgets,
  flattenGistSegments,
  grainSegmentIds,
  normalizeForHash,
  perSegmentBudgets,
  recomputeStale,
  validateGist,
  type PanelMetrics,
} from '../../lib/gist-helpers';
import type { AICallKind } from '../../services/ai/model-types';
import type { StoredGist } from '../../types';

/** The model id that will run a kind, for the StoredGist's calibrated-trust record. */
const resolveModelId = (kind: AICallKind): string => {
  const s = useStore.getState();
  return resolveModelChoice(kind, s.modelConfig, s.globalModelDefault, {
    enabled: s.agentModeEnabled,
    model: s.agentSdkModel,
  }).model;
};

const weightsOf = (gist: StoredGist) =>
  gist.fine.map((sp) => ({ id: sp.id, weight: gist.analysis.segments.find((a) => a.id === sp.id)?.weight ?? 2 }));

/**
 * Orchestration for the Gist Editor: generate (Stage A → Stage B → validate → atomic
 * swap), per-span refresh (Prompt C), re-fit (Prompt D), and staleness recompute.
 * Components → this hook → slice actions + aiProvider; the AI SDK never crosses into
 * feature code. Live state is read via getState() at call time (mirrors the other
 * workspace action hooks); failures toast and leave the old gist standing (P6).
 */
export const useGistActions = () => {
  const setGist = useStore((s) => s.setGist);
  const setGenerating = useStore((s) => s.setGistGenerating);
  const setRefreshingId = useStore((s) => s.setGistRefreshingId);
  const setStale = useStore((s) => s.setGistStale);
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

  const generate = useCallback(
    async (metrics: PanelMetrics) => {
      const s = useStore.getState();
      const sections = s.sections;
      if (!sections.length) {
        toast.error('Add a heading or two first — the gist segments the document by section.');
        return;
      }
      const segInfos = flattenGistSegments(sections);
      const { fine: fineIds, coarse: coarseIds } = grainSegmentIds(sections);
      const config = s.promptsConfig;
      const documentTitle = s.projectName?.trim() || 'Untitled';

      setGenerating(true);
      setIsProcessing(true);
      try {
        // Stage A — analysis (inspectable intermediate state).
        const analysis = await aiProvider.analyzeGist({
          documentTitle,
          segments: segInfos.map((seg) => ({ id: seg.id, heading: seg.headingPath.join(' › '), text: seg.text })),
          config,
        });

        // Budgets from the measured panel + per-segment weights.
        const budgets = computeBudgets(metrics);
        const fineWeights = fineIds.map((id) => ({ id, weight: analysis.segments.find((a) => a.id === id)?.weight ?? 2 }));
        const perSpanBudgets = perSegmentBudgets(fineWeights, budgets.target);

        // Stage B — composition, with one corrective retry on a gate failure.
        let composition = await aiProvider.composeGist({ analysis, coarseIds, fineIds, budgets, perSpanBudgets, config });
        let check = validateGist(composition, { coarse: coarseIds, fine: fineIds }, budgets);
        if (!check.ok) {
          composition = await aiProvider.composeGist({
            analysis, coarseIds, fineIds, budgets, perSpanBudgets, config,
            retryReason: check.reasons.join(' '),
          });
          check = validateGist(composition, { coarse: coarseIds, fine: fineIds }, budgets);
          if (!check.ok) {
            // Second failure: keep a still-valid prior map standing (P6). With no
            // prior gist, an imperfect map beats none — warn but proceed.
            if (useStore.getState().gist) {
              toast.error("The new gist didn't pass its fidelity checks — keeping the previous one.");
              return;
            }
            toast.warning('Gist generated with minor fidelity warnings.');
          }
        }

        const stored: StoredGist = {
          generatedAt: Date.now(),
          model: resolveModelId('composeGist'),
          segmentation: buildSegmentation(sections),
          analysis,
          budgets,
          g0: composition.g0,
          coarse: composition.coarse,
          fine: composition.fine,
          staleSegmentIds: [],
          orphanedSegmentIds: [],
        };
        setGist(stored);
        setStale([], []);
        await saveCurrentState();
      } catch (e) {
        notifyAiError(e, 'Gist generation failed. Check your API key or try again.');
      } finally {
        setGenerating(false);
        setIsProcessing(false);
      }
    },
    [setGist, setGenerating, setStale, setIsProcessing, saveCurrentState],
  );

  /** Per-span refresh of one stale segment (Prompt C). Leaves the old span on failure. */
  const refreshSpan = useCallback(
    async (segmentId: string) => {
      const s = useStore.getState();
      const gist = s.gist;
      if (!gist) return;
      const seg = flattenGistSegments(s.sections).find((x) => x.id === segmentId);
      const analysis = gist.analysis.segments.find((a) => a.id === segmentId);
      const fineIdx = gist.fine.findIndex((sp) => sp.id === segmentId);
      if (!seg || !analysis || fineIdx < 0) {
        toast.error("Can't find that section anymore.");
        return;
      }
      const budget = perSegmentBudgets(weightsOf(gist), gist.budgets.target)[segmentId] ?? 30;

      setRefreshingId(segmentId);
      setIsProcessing(true);
      try {
        const span = await aiProvider.refreshGistSpan({
          segmentId,
          segmentSource: seg.text,
          analysis,
          budget,
          prevSpan: gist.fine[fineIdx - 1]?.text,
          nextSpan: gist.fine[fineIdx + 1]?.text,
        });
        if (!span) {
          toast.error("Couldn't refresh that part — leaving it as is.");
          return;
        }
        const fine = gist.fine.map((sp) => (sp.id === segmentId ? { ...sp, text: span.text } : sp));
        // Re-anchor the segment so it's no longer flagged stale.
        const segmentation = gist.segmentation.map((g) =>
          g.id === segmentId ? { ...g, anchor: anchorFor(seg.text), sourceHash: computeHash(normalizeForHash(seg.text)) } : g,
        );
        setGist({ ...gist, fine, segmentation });
        setStale(useStore.getState().gistStaleIds.filter((id) => id !== segmentId), useStore.getState().gistOrphanIds);
        await saveCurrentState();
      } catch (e) {
        notifyAiError(e, 'Refresh failed. Check your API key or try again.');
      } finally {
        setRefreshingId(null);
        setIsProcessing(false);
      }
    },
    [setGist, setRefreshingId, setStale, setIsProcessing, saveCurrentState],
  );

  /**
   * One automatic re-fit pass (Prompt D) when the fresh fine grain overflows on
   * render — compress it to the cap rather than immediately falling back a grain.
   * On {fits:false} it no-ops and the grain ladder handles the fallback (still no
   * scroll either way), so this only ever improves the result.
   */
  const refitFine = useCallback(
    async (newCap: number) => {
      const gist = useStore.getState().gist;
      if (!gist) return;
      setIsProcessing(true);
      try {
        const anchorTermsBySpan: Record<string, string[]> = {};
        for (const sp of gist.fine) anchorTermsBySpan[sp.id] = gist.analysis.segments.find((a) => a.id === sp.id)?.anchor_terms ?? [];
        const tighter = await aiProvider.refitGist({ grain: gist.fine, anchorTermsBySpan, newCap });
        if (tighter) {
          setGist({ ...useStore.getState().gist!, fine: tighter });
          await saveCurrentState();
        }
      } catch {
        // Silent: the grain-ladder fallback already guarantees the panel never scrolls.
      } finally {
        setIsProcessing(false);
      }
    },
    [setGist, setIsProcessing, saveCurrentState],
  );

  /** Recompute staleness + orphaning against the live document (debounced by the caller). */
  const recomputeStaleness = useCallback(() => {
    const s = useStore.getState();
    if (!s.gist) return;
    const { staleIds, orphanIds } = recomputeStale(s.gist.segmentation, s.sections);
    setStale(staleIds, orphanIds);
  }, [setStale]);

  return { generate, refreshSpan, refitFine, recomputeStaleness };
};
