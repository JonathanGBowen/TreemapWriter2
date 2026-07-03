import { useCallback, useState } from 'react';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import type { FunctionTag, StructuralEdgeKind } from '../../types';
import {
  acceptEdge,
  edgeId,
  mergeDiscoveredEdges,
  seedRealizations,
  tagRealization,
} from '../../lib/structural-graph-helpers';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';

/** Single-flight guard for the edge-discovery pass (module-level, like the parts hook). */
let edgesInFlight = false;

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * The W₁ GRAPH authoring actions (Arpeggio Phase 2), sibling of
 * `useStructuralPartsActions`. Owns the edge-set (AI discovery + hand-authoring +
 * accept/reject), the realization function-tags, and the declared-center toggle.
 * Each mutation lands in the domain store and persists via `saveCurrentState()` to
 * the committed `.twriter/structural-edges.json` / `.twriter/realizations.json`
 * sidecars. AI-proposed edges are ADVISORY — they arrive `status: 'proposed'` and
 * are never auto-committed; the writer accepts each.
 */
export const useStructuralGraphActions = () => {
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setStructuralEdges = useStore((s) => s.setStructuralEdges);
  const setStructuralParts = useStore((s) => s.setStructuralParts);
  const setRealizations = useStore((s) => s.setRealizations);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const [discoveringEdges, setDiscoveringEdges] = useState(false);

  const discoverEdges = useCallback(async () => {
    const { structuralParts, projectName, promptsConfig, isProcessing, modelConfig, globalModelDefault, modelCatalog } =
      useStore.getState();
    if (isProcessing || edgesInFlight) return;
    if (structuralParts.length < 2) {
      notifyAiError(new Error('too few parts'), 'Discover at least two structural parts before discovering edges.');
      return;
    }

    const choice = resolveModelChoice('discoverStructuralEdges', modelConfig, globalModelDefault);
    const partsText = structuralParts.map((p) => `${p.kind}: ${p.claim}`).join('\n');
    if (!guardContextFit({ catalog: modelCatalog, choice, text: partsText, what: 'These parts', setting: 'Discover edges' })) {
      return;
    }

    edgesInFlight = true;
    setDiscoveringEdges(true);
    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Discovering structural edges…' });
    try {
      const proposed = await aiProvider.discoverStructuralEdges({
        parts: structuralParts.map((p) => ({ id: p.id, kind: p.kind, claim: p.claim })),
        documentTitle: projectName,
        config: promptsConfig,
      });
      if (!proposed || proposed.length === 0) {
        notifyAiError(new Error('empty response'), 'Edge discovery proposed no relations.');
        return;
      }
      // Merge advisory: authored/accepted edges stay untouched; new ones land proposed.
      setStructuralEdges(mergeDiscoveredEdges(useStore.getState().structuralEdges, proposed));
      await saveCurrentState();
    } catch (e) {
      notifyAiError(e, `Discover edges failed: ${errMessage(e)}`);
    } finally {
      edgesInFlight = false;
      setDiscoveringEdges(false);
      setIsProcessing(false);
      useStore.getState().endOp(opId);
    }
  }, [setIsProcessing, setStructuralEdges, saveCurrentState]);

  /** Hand-author an accepted edge (deduped by `edgeId`); the Phase-4 canvas will do this richer. */
  const addEdge = useCallback(
    async (fromPartId: string, toPartId: string, kind: StructuralEdgeKind) => {
      if (fromPartId === toPartId) return;
      const id = edgeId(kind, fromPartId, toPartId);
      const edges = useStore.getState().structuralEdges;
      if (edges.some((e) => e.id === id)) return; // already present
      setStructuralEdges([...edges, { id, kind, fromPartId, toPartId, origin: 'authored', status: 'accepted' }]);
      await saveCurrentState();
    },
    [setStructuralEdges, saveCurrentState],
  );

  const acceptProposedEdge = useCallback(
    async (id: string) => {
      setStructuralEdges(acceptEdge(useStore.getState().structuralEdges, id));
      await saveCurrentState();
    },
    [setStructuralEdges, saveCurrentState],
  );

  const rejectEdge = useCallback(
    async (id: string) => {
      setStructuralEdges(useStore.getState().structuralEdges.filter((e) => e.id !== id));
      await saveCurrentState();
    },
    [setStructuralEdges, saveCurrentState],
  );

  /** Tag (or clear) a realization by id — operates on the full seeded set so the id exists. */
  const tag = useCallback(
    async (id: string, functionTag: FunctionTag | undefined) => {
      const { structuralParts, sections, realizations } = useStore.getState();
      const full = seedRealizations(structuralParts, sections, realizations);
      setRealizations(tagRealization(full, id, functionTag));
      await saveCurrentState();
    },
    [setRealizations, saveCurrentState],
  );

  const toggleDeclaredCenter = useCallback(
    async (partId: string) => {
      setStructuralParts(
        useStore.getState().structuralParts.map((p) =>
          p.id === partId ? { ...p, declaredCenter: !p.declaredCenter } : p,
        ),
      );
      await saveCurrentState();
    },
    [setStructuralParts, saveCurrentState],
  );

  return { discoverEdges, discoveringEdges, addEdge, acceptProposedEdge, rejectEdge, tag, toggleDeclaredCenter };
};
