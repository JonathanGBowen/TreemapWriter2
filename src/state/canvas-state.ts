// The W₁ Canvas workspace slice (Arpeggio Phase 4) — EPHEMERAL view state only.
// The durable graph (parts + positions + bodies + edges) lives in document-state
// (`structuralParts` / `structuralEdges`), persisted through the parts sidecar; this
// slice holds only what drives the canvas view: open flag, the focus-on-open target,
// the current selection, an in-progress edge draft, and the list-view toggle. All of
// it is lost on reload, by design.

import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { StructuralEdgeKind } from '../types';

export interface CanvasSlice {
  canvasOpen: boolean;
  /** The part to centre the camera on when the canvas opens (the topo deep-link); consumed once. */
  canvasFocusPartId: string | null;
  /** The selected node (a part id) — the target of C / E / Delete / status keys. */
  canvasSelectedId: string | null;
  /** While arming an edge (after `E`): the source part id, or null. */
  canvasEdgeDraftFrom: string | null;
  /** The kind the armed edge will take (defaults to 'grounds'; a kind letter changes it). */
  canvasEdgeDraftKind: StructuralEdgeKind;
  /** The visible list-view (a keyboard/SR-navigable outline of the same graph). */
  canvasListView: boolean;

  openCanvas: (focusPartId?: string) => void;
  closeCanvas: () => void;
  setCanvasSelected: (id: string | null) => void;
  /** Arm an edge from a source (kind defaults to 'grounds'). */
  armCanvasEdge: (fromPartId: string) => void;
  /** Change the kind the armed edge will take (a kind-letter press). */
  setCanvasEdgeKind: (kind: StructuralEdgeKind) => void;
  clearCanvasEdgeDraft: () => void;
  toggleCanvasListView: () => void;
  /** Clear the focus target once the workspace has centred on it. */
  clearCanvasFocus: () => void;
}

/** View state cleared on every open/close (the selection + edge draft don't survive). */
const CLEARED = {
  canvasSelectedId: null as string | null,
  canvasEdgeDraftFrom: null as string | null,
  canvasEdgeDraftKind: 'grounds' as StructuralEdgeKind,
};

export const createCanvasSlice: StateCreator<AppState, [], [], CanvasSlice> = (set) => ({
  canvasOpen: false,
  canvasFocusPartId: null,
  canvasListView: false,
  ...CLEARED,

  openCanvas: (focusPartId) => set({ canvasOpen: true, canvasFocusPartId: focusPartId ?? null, ...CLEARED }),
  closeCanvas: () => set({ canvasOpen: false, canvasFocusPartId: null, ...CLEARED }),
  setCanvasSelected: (canvasSelectedId) => set({ canvasSelectedId }),
  armCanvasEdge: (fromPartId) => set({ canvasEdgeDraftFrom: fromPartId, canvasEdgeDraftKind: 'grounds' }),
  setCanvasEdgeKind: (canvasEdgeDraftKind) => set({ canvasEdgeDraftKind }),
  clearCanvasEdgeDraft: () => set({ canvasEdgeDraftFrom: null }),
  toggleCanvasListView: () => set((s) => ({ canvasListView: !s.canvasListView })),
  clearCanvasFocus: () => set({ canvasFocusPartId: null }),
});
