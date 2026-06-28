import { useCallback } from 'react';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { computeHash } from '../../lib/utils';
import { buildStructuralSurround, formatStructuralSurround } from '../../lib/diagnostic-helpers';
import { deriveTopo } from '../modals/topo/topo-derive';
import { computeCentering, formatStructuralEvidence } from '../modals/topo/topo-centering';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { useCurrentSection } from './use-current-section';

/**
 * Sections with a gestalt op (whole-from-part or recenter) in flight. Module-level
 * so the guard survives a remount, like the analysis hook's `inFlight`.
 */
const inFlight = new Set<string>();

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * The Phase-2 gestalt whole/part operations (docs/gestalt-design-II.md L3a · L4),
 * surfaced beside the diagnostic. Both are one-shot, regenerable, and stored only
 * in ephemeral testSuite fields (`wholeFromPart` / `recenterings`) — never the
 * sidecar — so there is no `saveCurrentState()` here. They share the global
 * `isProcessing` lock with the other heavyweight AI calls.
 */
export const useGestaltActions = () => {
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setWholeFromPart = useStore((s) => s.setWholeFromPart);
  const setRecenterings = useStore((s) => s.setRecenterings);
  const currentSection = useCurrentSection();

  const runReconstructWhole = useCallback(async () => {
    if (!currentSection) return;
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    // The Beethoven test reconstructs the WHOLE from a part; the whole itself has
    // no "part" to read it from.
    if (sectionId === 'root') return;
    const { testSuite, sections, promptsConfig, isProcessing, modelConfig, globalModelDefault, modelCatalog } =
      useStore.getState();
    if (isProcessing || inFlight.has(sectionId)) return;

    const documentClaim = testSuite['root']?.spec?.mainClaim?.trim() || undefined;
    const topo = deriveTopo(sections, testSuite);
    const structuralEvidence = formatStructuralEvidence(topo, computeCentering(topo), sectionId) || undefined;
    const choice = resolveModelChoice('reconstructWhole', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text: sectionText,
        what: 'This section',
        setting: 'Whole from part',
      })
    ) {
      return;
    }

    inFlight.add(sectionId);
    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Reconstructing whole…' });
    try {
      const result = await aiProvider.reconstructWhole({
        sectionTitle,
        sectionText,
        documentClaim,
        structuralEvidence,
        config: promptsConfig,
      });
      if (!result) {
        notifyAiError(new Error('empty response'), 'Whole-from-part returned no usable reconstruction.');
        return;
      }
      setWholeFromPart(sectionId, {
        ...result,
        timestamp: Date.now(),
        inputHash: computeHash(sectionText),
      });
    } catch (e) {
      notifyAiError(e, `Whole-from-part failed: ${errMessage(e)}`);
    } finally {
      inFlight.delete(sectionId);
      setIsProcessing(false);
      useStore.getState().endOp(opId);
    }
  }, [currentSection, setIsProcessing, setWholeFromPart]);

  const runRecenter = useCallback(async () => {
    if (!currentSection) return;
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    const { testSuite, sections, promptsConfig, isProcessing, modelConfig, globalModelDefault, modelCatalog } =
      useStore.getState();
    if (isProcessing || inFlight.has(sectionId)) return;

    const spec = testSuite[sectionId]?.spec;
    const specs = Object.fromEntries(Object.entries(testSuite).map(([id, e]) => [id, e?.spec]));
    const structuralSurround =
      sectionId === 'root'
        ? undefined
        : formatStructuralSurround(buildStructuralSurround(sectionId, sections, specs)) || undefined;
    const topo = deriveTopo(sections, testSuite);
    const structuralEvidence = formatStructuralEvidence(topo, computeCentering(topo), sectionId) || undefined;

    const choice = resolveModelChoice('proposeRecenterings', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text: sectionText,
        what: 'This section',
        setting: 'Recenter',
      })
    ) {
      return;
    }

    inFlight.add(sectionId);
    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Proposing recenterings…' });
    try {
      const result = await aiProvider.proposeRecenterings({
        sectionTitle,
        sectionText,
        currentClaim: spec?.mainClaim,
        currentFunction: spec?.function,
        requiredMoves: spec?.requiredMoves.map((m) => m.description),
        structuralSurround,
        structuralEvidence,
        config: promptsConfig,
      });
      if (!result) {
        notifyAiError(new Error('empty response'), 'Recenter returned no usable proposal.');
        return;
      }
      setRecenterings(sectionId, {
        ...result,
        timestamp: Date.now(),
        inputHash: computeHash(sectionText),
      });
    } catch (e) {
      notifyAiError(e, `Recenter failed: ${errMessage(e)}`);
    } finally {
      inFlight.delete(sectionId);
      setIsProcessing(false);
      useStore.getState().endOp(opId);
    }
  }, [currentSection, setIsProcessing, setRecenterings]);

  return { runReconstructWhole, runRecenter };
};
