import { useCallback } from 'react';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { segmentParagraphs } from '../../lib/paragraph-helpers';
import { resolvePart } from '../../lib/structural-part-helpers';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';

/**
 * Single-flight guard for the whole-document discovery pass. Module-level so it
 * survives a remount, like the gestalt hook's `inFlight` set — but a boolean
 * here, since this is one document-scoped op, not a per-section one.
 */
let inFlight = false;

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * The StructuralPart discovery action (docs/structural-part-audit.md §V), a
 * faithful sibling of `useGestaltActions` (Pattern B): guard on the module
 * `inFlight` flag + the global `isProcessing` lock, read live state, segment the
 * whole document, resolve the model + pre-flight its context window, call the
 * `discoverStructuralParts` faculty, then map each returned part onto the
 * sections it overlaps (deterministic — the model never supplies `sectionIds`).
 * Tier 1: the result is stored only in the regenerable `structuralParts` domain
 * array, not the sidecar, so there is no `saveCurrentState()` here.
 */
export const useStructuralPartsActions = () => {
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setStructuralParts = useStore((s) => s.setStructuralParts);

  const runDiscoverStructuralParts = useCallback(async () => {
    const {
      markdown,
      projectName,
      promptsConfig,
      isProcessing,
      modelConfig,
      globalModelDefault,
      modelCatalog,
    } = useStore.getState();
    if (isProcessing || inFlight) return;

    const blocks = segmentParagraphs(markdown);
    if (blocks.length === 0) {
      notifyAiError(new Error('empty document'), 'Write some prose before discovering its parts.');
      return;
    }

    const choice = resolveModelChoice('discoverStructuralParts', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text: markdown,
        what: 'This document',
        setting: 'Discover parts',
      })
    ) {
      return;
    }

    inFlight = true;
    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Discovering structural parts…' });
    try {
      const parts = await aiProvider.discoverStructuralParts({
        blocks: blocks.map((b) => ({ index: b.index, text: b.text, kind: b.kind })),
        documentTitle: projectName,
        config: promptsConfig,
      });
      if (!parts || parts.length === 0) {
        notifyAiError(new Error('empty response'), 'Structural-part discovery returned no usable parts.');
        return;
      }
      // Map each part onto the sections it overlaps, against the LIVE section tree.
      const sections = useStore.getState().sections;
      const resolved = parts.map((p) => ({ ...p, sectionIds: resolvePart(p, markdown, sections).sectionIds }));
      setStructuralParts(resolved);
    } catch (e) {
      notifyAiError(e, `Discover parts failed: ${errMessage(e)}`);
    } finally {
      inFlight = false;
      setIsProcessing(false);
      useStore.getState().endOp(opId);
    }
  }, [setIsProcessing, setStructuralParts]);

  return { runDiscoverStructuralParts };
};
