import { useCallback } from 'react';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { segmentParagraphs } from '../../lib/paragraph-helpers';
import { reanchoredPart, resolvePart } from '../../lib/structural-part-helpers';
import { pruneEdges, seedRealizations } from '../../lib/structural-graph-helpers';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { computeHash } from '../../lib/utils';
import { normalizeForHash } from '../../lib/gist-helpers';
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
 * Tier 2: each part is stamped with a `sourceHash` of its span at discovery
 * (the staleness anchor), stored in the `structuralParts` domain array, and
 * persisted via `saveCurrentState()` to the committed `.twriter/structural-parts.json`
 * sidecar (mirroring `use-gist-actions`).
 */
export const useStructuralPartsActions = () => {
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setStructuralParts = useStore((s) => s.setStructuralParts);
  const setStructuralEdges = useStore((s) => s.setStructuralEdges);
  const setRealizations = useStore((s) => s.setRealizations);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

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
      // Map each part onto the sections it overlaps, against the LIVE section tree,
      // and stamp its span's hash so Tier-2 staleness has an anchor to compare against
      // (mirrors gist `buildSegmentation`: computeHash∘normalizeForHash of the span).
      const sections = useStore.getState().sections;
      const resolved = parts.map((p) => {
        const { sectionIds, orphan, startOffset, endOffset } = resolvePart(p, markdown, sections);
        return {
          ...p,
          origin: 'discovered' as const,
          sectionIds,
          // Unresolved at discovery keeps no hash (recompute re-flags it as orphan).
          sourceHash: orphan ? p.sourceHash : computeHash(normalizeForHash(markdown.slice(startOffset, endOffset))),
        };
      });
      // MERGE, don't replace: hand-authored parts (Phase 4 canvas) survive re-discovery
      // unclobbered; only discovered parts are refreshed (Phase 2 groundwork).
      const authored = useStore.getState().structuralParts.filter((p) => p.origin === 'authored');
      const merged = [...authored, ...resolved];
      setStructuralParts(merged);
      // Seed the function-taggable realizations from the fresh part↔section overlap,
      // preserving any tags the writer already set (annotate-only).
      setRealizations(seedRealizations(merged, sections, useStore.getState().realizations));
      // Drop edges left dangling by a part that re-discovered under a new content-id,
      // so they don't linger in the sidecar or the AI-prompt summaries.
      setStructuralEdges(pruneEdges(useStore.getState().structuralEdges, merged));
      // Persist the discovery to the committed sidecar (mirrors use-gist-actions).
      await saveCurrentState();
    } catch (e) {
      notifyAiError(e, `Discover parts failed: ${errMessage(e)}`);
    } finally {
      inFlight = false;
      setIsProcessing(false);
      useStore.getState().endOp(opId);
    }
  }, [setIsProcessing, setStructuralParts, setStructuralEdges, setRealizations, saveCurrentState]);

  /**
   * Per-part repair — Mode 1 (pure re-anchor, NO AI). Re-stamp a stale part's
   * anchors + sourceHash + sectionIds from its current span so it reads fresh, then
   * persist. Orphans can't be re-anchored (no span to relocate), mirroring gist
   * hiding its refresh button for orphans; the RE-ANCHOR button is only shown for
   * `stale && !orphan`, so the orphan branch here is defensive.
   */
  const reanchorPart = useCallback(
    async (id: string) => {
      const { markdown, sections, structuralParts } = useStore.getState();
      const part = structuralParts.find((p) => p.id === id);
      if (!part) return;
      const fixed = reanchoredPart(part, markdown, sections);
      if (!fixed) {
        notifyAiError(
          new Error('orphan'),
          'This part can no longer be located in the text — re-run Discover parts.',
        );
        return;
      }
      setStructuralParts(structuralParts.map((p) => (p.id === id ? fixed : p)));
      await saveCurrentState();
    },
    [setStructuralParts, saveCurrentState],
  );

  return { runDiscoverStructuralParts, reanchorPart };
};
