// The W₁ Canvas mutation hook (Arpeggio Phase 4). Every mutation follows the
// established idiom — build the next array via a pure `canvas-helpers` transform,
// `setStructuralParts` / `setStructuralEdges` / `setRealizations`, then persist with
// `saveCurrentState()` (into the existing `.twriter/structural-*.json` sidecars; no
// new sidecar). A live drag uses `movePartLive` (no save) + `commit()` on drag-end,
// so edges follow the node during the drag without one disk write per pointer move.

import { useCallback } from 'react';
import { useStore } from '../../state';
import type { StructuralPart } from '../../types';
import type { Pt } from './canvas-geometry';
import {
  applyPositions,
  deletePartFrom,
  makeGermPart,
  moveIn,
  patchIn,
  seedPositions,
} from './canvas-helpers';

export const useCanvasActions = () => {
  const setStructuralParts = useStore((s) => s.setStructuralParts);
  const setStructuralEdges = useStore((s) => s.setStructuralEdges);
  const setRealizations = useStore((s) => s.setRealizations);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

  /** Persist the current graph (call after a burst of live moves, or any mutation). */
  const commit = useCallback(async () => {
    await saveCurrentState();
  }, [saveCurrentState]);

  const createPartAt = useCallback(
    async (pos: Pt, claim = ''): Promise<string> => {
      const parts = useStore.getState().structuralParts;
      const part = makeGermPart(claim, pos, new Set(parts.map((p) => p.id)));
      setStructuralParts([...parts, part]);
      await saveCurrentState();
      return part.id;
    },
    [setStructuralParts, saveCurrentState],
  );

  /** Reposition during a drag — store only, no disk write (edges follow live). */
  const movePartLive = useCallback(
    (id: string, pos: Pt) => {
      setStructuralParts(moveIn(useStore.getState().structuralParts, id, pos));
    },
    [setStructuralParts],
  );

  const updatePart = useCallback(
    async (id: string, patch: Partial<StructuralPart>) => {
      setStructuralParts(patchIn(useStore.getState().structuralParts, id, patch));
      await saveCurrentState();
    },
    [setStructuralParts, saveCurrentState],
  );

  const deletePart = useCallback(
    async (id: string) => {
      const state = useStore.getState();
      const r = deletePartFrom(state.structuralParts, state.structuralEdges, state.realizations, id);
      setStructuralParts(r.parts);
      setStructuralEdges(r.edges);
      setRealizations(r.realizations);
      // Keep the ephemeral canvas view consistent: a deleted part must not linger as
      // the selection or — the data-integrity case — as an armed edge's source, which
      // a later target click would otherwise author into a dangling, persisted edge.
      if (state.canvasEdgeDraftFrom === id) state.clearCanvasEdgeDraft();
      if (state.canvasSelectedId === id) state.setCanvasSelected(null);
      await saveCurrentState();
    },
    [setStructuralParts, setStructuralEdges, setRealizations, saveCurrentState],
  );

  const deleteEdge = useCallback(
    async (id: string) => {
      setStructuralEdges(useStore.getState().structuralEdges.filter((e) => e.id !== id));
      await saveCurrentState();
    },
    [setStructuralEdges, saveCurrentState],
  );

  /** Bulk-apply an `{id → position}` map (suggest-layout accept / undo). */
  const setPositions = useCallback(
    async (map: Record<string, Pt>) => {
      setStructuralParts(applyPositions(useStore.getState().structuralParts, map));
      await saveCurrentState();
    },
    [setStructuralParts, saveCurrentState],
  );

  /** Fill positions for never-placed parts (grid), persisting once. Returns true if it did. */
  const seedInitialPositions = useCallback(async (): Promise<boolean> => {
    const { parts, changed } = seedPositions(useStore.getState().structuralParts);
    if (changed) {
      setStructuralParts(parts);
      await saveCurrentState();
    }
    return changed;
  }, [setStructuralParts, saveCurrentState]);

  return { commit, createPartAt, movePartLive, updatePart, deletePart, deleteEdge, setPositions, seedInitialPositions };
};
