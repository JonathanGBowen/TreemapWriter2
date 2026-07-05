// The W₁ CANVAS workspace (Arpeggio Phase 4, user decision 3) — the argument's
// authored spatial home. A full-screen, pan/zoom plane where the StructuralParts
// live as hand-placed cards and the StructuralEdges as typed lines, all authored
// directly (the topo modal stays the DERIVED-analysis lens; this is the co-edited
// W₁ layer §2.1). Rendering: an HTML card overlay over an SVG edge layer, both in
// ONE world-coordinate container transformed by `translate(tx,ty) scale(k)` (the
// fresh world-px `useCanvasPanZoom`, not the SVG-viewBox topo camera). Positions
// and the quarry `body` persist through the existing parts sidecar — no new sidecar.
//
// Keyboard authoring (Arpeggio §6.1), inert while typing (`isEditableTarget`):
//   N create a germ node at the cursor · E arm an edge from the selection, then a
//   kind letter (g/r/q/o/x/d/a) + a click on the target · C toggle declared-centre ·
//   1/2/3 set status germ/apprehended/articulated · Delete remove the selection ·
//   Esc blur a field, else cancel an armed edge, else close.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { useCanvasActions } from './use-canvas-actions';
import { useStructuralGraphActions } from '../structure/use-structural-graph-actions';
import { useCanvasPanZoom } from './useCanvasPanZoom';
import { isEditableTarget, KIND_BY_LETTER } from './canvas-keys';
import { positionSnapshot } from './canvas-helpers';
import type { Pt } from './canvas-geometry';
import { CanvasNode } from './CanvasNode';
import { CanvasEdges } from './CanvasEdges';
import { CanvasInspector } from './CanvasInspector';
import { CanvasListView } from './CanvasListView';
import { CanvasLegend } from './CanvasLegend';
import { CanvasTopBar } from './CanvasTopBar';
import { optimizeTarget, type SimNode } from '../modals/topo/topo-sim-atlas';
import type { Arc } from '../modals/topo/topo-derive';
import type { StructuralPart } from '../../types';

/** Node radius for the force settle (a constant — the canvas never sizes nodes by words). */
const SIM_R = 46;

const STATUS_BY_DIGIT: Record<string, NonNullable<StructuralPart['status']>> = {
  '1': 'germ',
  '2': 'apprehended',
  '3': 'articulated',
};

export function CanvasWorkspace() {
  const open = useStore((s) => s.canvasOpen);
  const parts = useStore((s) => s.structuralParts);
  const edges = useStore((s) => s.structuralEdges);
  const selectedId = useStore((s) => s.canvasSelectedId);
  const edgeDraftFrom = useStore((s) => s.canvasEdgeDraftFrom);
  const edgeDraftKind = useStore((s) => s.canvasEdgeDraftKind);
  const listView = useStore((s) => s.canvasListView);
  const setCanvasSelected = useStore((s) => s.setCanvasSelected);
  const clearCanvasEdgeDraft = useStore((s) => s.clearCanvasEdgeDraft);
  const toggleCanvasListView = useStore((s) => s.toggleCanvasListView);
  const closeCanvas = useStore((s) => s.closeCanvas);
  const removeInboxItem = useStore((s) => s.removeInboxItem);

  const { createPartAt, movePartLive, commit, deletePart, deleteEdge, updatePart, setPositions, seedInitialPositions } =
    useCanvasActions();
  const { addEdge, toggleDeclaredCenter } = useStructuralGraphActions();

  const viewportRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, Pt> | null>(null);

  // A clean click on the background deselects everything (and cancels an armed edge).
  const onEmptyClick = useCallback(() => {
    setCanvasSelected(null);
    setSelectedEdgeId(null);
    clearCanvasEdgeDraft();
  }, [setCanvasSelected, clearCanvasEdgeDraft]);

  const pan = useCanvasPanZoom(viewportRef, onEmptyClick);
  const { cam, panning, screenToWorldClient, fit, focusOn } = pan;

  const selectedPart = useMemo(() => parts.find((p) => p.id === selectedId) ?? null, [parts, selectedId]);
  const claimOf = useCallback((id: string) => parts.find((p) => p.id === id)?.claim ?? id, [parts]);

  // Seed never-placed nodes once, then fit the camera (or focus the deep-link target).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      await seedInitialPositions();
      if (cancelled) return;
      const state = useStore.getState();
      const live = state.structuralParts;
      const pts = live.filter((p) => p.position).map((p) => p.position!);
      const focusId = state.canvasFocusPartId;
      if (focusId) {
        const fp = live.find((p) => p.id === focusId);
        if (fp?.position) {
          focusOn(fp.position, 1);
          state.setCanvasSelected(focusId);
        } else {
          fit(pts);
        }
        state.clearCanvasFocus();
      } else {
        fit(pts);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, seedInitialPositions, fit, focusOn]);

  // A live drag persists only on `pointerup` (`movePartLive` is store-only). If the
  // workspace closes mid-drag — Escape, or the ✕ — that `pointerup` never lands on the
  // unmounting card, so flush on close so a reload can't lose the move.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) void commit();
    wasOpen.current = open;
  }, [open, commit]);

  const selectNode = useCallback(
    (id: string) => {
      const s = useStore.getState();
      // Completing an armed edge takes precedence over a plain select.
      if (s.canvasEdgeDraftFrom && s.canvasEdgeDraftFrom !== id) {
        void addEdge(s.canvasEdgeDraftFrom, id, s.canvasEdgeDraftKind);
        clearCanvasEdgeDraft();
        setSelectedEdgeId(null);
        setCanvasSelected(id);
        return;
      }
      clearCanvasEdgeDraft();
      setSelectedEdgeId(null);
      setCanvasSelected(id);
    },
    [addEdge, clearCanvasEdgeDraft, setCanvasSelected],
  );

  const selectEdge = useCallback(
    (id: string) => {
      clearCanvasEdgeDraft();
      setCanvasSelected(null);
      setSelectedEdgeId(id);
    },
    [clearCanvasEdgeDraft, setCanvasSelected],
  );

  // Suggest layout: settle the placed nodes + their edges into a preview the writer
  // accepts or rejects (never auto-applied; accept is undoable). Spatial memory is
  // sacred — this only ever runs on explicit request.
  const suggestLayout = useCallback(() => {
    const state = useStore.getState();
    const placed = state.structuralParts.filter((p) => p.position);
    if (placed.length < 2) {
      toast('Place at least two nodes before suggesting a layout.');
      return;
    }
    const n = placed.length;
    const side = Math.max(900, Math.ceil(Math.sqrt(n)) * 280);
    const canvas = { w: side, h: side };
    const nodes: SimNode[] = placed.map((p) => ({ id: p.id, part: p.id, r: SIM_R, status: 'idle', x: p.position!.x, y: p.position!.y, vx: 0, vy: 0 }));
    const ids = new Set(placed.map((p) => p.id));
    const arcs: Arc[] = state.structuralEdges
      .filter((e) => ids.has(e.fromPartId) && ids.has(e.toPartId))
      .map((e) => ({ id: e.id, source: e.fromPartId, target: e.toPartId, type: 'prerequisite' as const }));
    const target = optimizeTarget(nodes, arcs, canvas);
    const map: Record<string, Pt> = {};
    for (const t of target) map[t.id] = { x: t.x, y: t.y };
    setPreview(map);
    fit(Object.values(map));
  }, [fit]);

  const acceptLayout = useCallback(async () => {
    if (!preview) return;
    const before = positionSnapshot(useStore.getState().structuralParts);
    await setPositions(preview);
    setPreview(null);
    toast('Layout applied.', {
      action: { label: 'Undo', onClick: () => void setPositions(before) },
      duration: 10000,
    });
  }, [preview, setPositions]);

  // The workspace keyboard map (window-scoped, open-gated). Reads fresh state so the
  // once-bound listener never goes stale; a ref mirrors the local edge selection.
  const selEdgeRef = useRef<string | null>(null);
  selEdgeRef.current = selectedEdgeId;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape first (works even from a field): blur a focused editor, else cancel
      // an armed edge, else close the workspace.
      if (e.key === 'Escape') {
        if (isEditableTarget(e.target)) {
          (e.target as HTMLElement).blur();
          return;
        }
        const s = useStore.getState();
        if (s.canvasEdgeDraftFrom) {
          s.clearCanvasEdgeDraft();
          return;
        }
        if (preview) {
          setPreview(null);
          return;
        }
        s.closeCanvas();
        return;
      }
      // Single-key authoring is inert while typing or under a chord.
      if (isEditableTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      const s = useStore.getState();
      const sel = s.canvasSelectedId;
      const key = e.key.toLowerCase();

      // A kind letter only matters while an edge is armed.
      if (s.canvasEdgeDraftFrom && KIND_BY_LETTER[key]) {
        e.preventDefault();
        s.setCanvasEdgeKind(KIND_BY_LETTER[key]);
        return;
      }

      if (key === 'n') {
        e.preventDefault();
        const r = viewportRef.current?.getBoundingClientRect();
        const p = lastPointer.current ?? (r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 });
        void createPartAt(screenToWorldClient(p.x, p.y)).then((id) => {
          setSelectedEdgeId(null);
          setCanvasSelected(id);
        });
        return;
      }
      if (key === 'e') {
        if (!sel) return;
        e.preventDefault();
        s.armCanvasEdge(sel);
        return;
      }
      if (key === 'c') {
        if (!sel) return;
        e.preventDefault();
        void toggleDeclaredCenter(sel);
        return;
      }
      if (STATUS_BY_DIGIT[e.key]) {
        if (!sel) return;
        e.preventDefault();
        void updatePart(sel, { status: STATUS_BY_DIGIT[e.key] });
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        if (selEdgeRef.current) {
          e.preventDefault();
          void deleteEdge(selEdgeRef.current);
          setSelectedEdgeId(null);
        } else if (sel) {
          e.preventDefault();
          void deletePart(sel);
          setCanvasSelected(null);
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, preview, createPartAt, screenToWorldClient, setCanvasSelected, toggleDeclaredCenter, updatePart, deleteEdge, deletePart]);

  if (!open) return null;

  const ghostEdges = preview
    ? edges.filter((e) => preview[e.fromPartId] && preview[e.toPartId])
    : [];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-hld-bg text-hld-text overflow-hidden font-sans">
      <CanvasTopBar
        nodeCount={parts.length}
        edgeCount={edges.length}
        previewing={!!preview}
        onAccept={() => void acceptLayout()}
        onReject={() => setPreview(null)}
        onSuggest={suggestLayout}
        listView={listView}
        onToggleList={toggleCanvasListView}
        onClose={closeCanvas}
      />

      <div className="flex-1 flex min-h-0">
        <CanvasListView parts={parts} edges={edges} selectedId={selectedId} visible={listView} onSelect={selectNode} />

        {/* The pan/zoom viewport (screen space) holding the transformed world layer. */}
        <div
          ref={viewportRef}
          className="relative flex-1 min-w-0 overflow-hidden"
          style={{ cursor: panning ? 'grabbing' : 'default', touchAction: 'none' }}
          onPointerDown={pan.handlers.onPointerDown}
          onPointerMove={(e) => {
            lastPointer.current = { x: e.clientX, y: e.clientY };
            pan.handlers.onPointerMove(e);
          }}
          onPointerUp={pan.handlers.onPointerUp}
          onWheel={pan.handlers.onWheel}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const text = e.dataTransfer.getData('text/plain');
            if (!text.trim()) return;
            const inboxId = e.dataTransfer.getData('application/x-inbox-id');
            const world = screenToWorldClient(e.clientX, e.clientY);
            void createPartAt(world, text).then((id) => {
              setSelectedEdgeId(null);
              setCanvasSelected(id);
              if (inboxId) void removeInboxItem(inboxId);
            });
          }}
        >
          {/* World layer — one transform carries both the edges and the cards. */}
          <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.k})` }}>
            <CanvasEdges parts={parts} edges={edges} selectedEdgeId={selectedEdgeId} onSelectEdge={selectEdge} />

            {parts.map((p) => (
              <CanvasNode
                key={p.id}
                part={p}
                selected={p.id === selectedId}
                camK={cam.k}
                onClick={selectNode}
                onOpen={selectNode}
                onLiveMove={movePartLive}
                onCommitMove={commit}
              />
            ))}

            {/* Ghost preview of a suggested layout (pointer-inert). */}
            {preview && (
              <>
                <svg style={{ position: 'absolute', overflow: 'visible', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
                  {ghostEdges.map((e) => {
                    const a = preview[e.fromPartId];
                    const b = preview[e.toPartId];
                    return <line key={`g-${e.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-hld-cyan)" strokeWidth={1.2} strokeDasharray="3 4" opacity={0.4} />;
                  })}
                </svg>
                {Object.entries(preview).map(([id, pt]) => (
                  <div
                    key={`ghost-${id}`}
                    style={{ position: 'absolute', left: pt.x, top: pt.y, transform: 'translate(-50%, -50%)', width: 180, pointerEvents: 'none', opacity: 0.55 }}
                    className="rounded-sm border border-dashed border-hld-cyan bg-hld-cyan/5 px-[10px] py-[8px]"
                  >
                    <div className="text-[11px] leading-snug text-hld-cyan line-clamp-2">{claimOf(id) || 'untitled'}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Empty-state hint (screen space). */}
          {parts.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center font-mono text-[10px] tracking-[0.14em] uppercase text-hld-muted leading-[2]">
                An empty configuration.<br />Press <span className="text-hld-cyan">N</span> to author a germ node, or drag a thought in from the inbox.
              </div>
            </div>
          )}

          {/* Edge-draft banner (screen space). */}
          {edgeDraftFrom && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-[12px] left-1/2 -translate-x-1/2 flex items-center gap-[8px] px-[12px] py-[7px] bg-hld-surface border border-hld-purple/60"
            >
              <span aria-hidden className="w-[5px] h-[5px] rotate-45 bg-hld-purple" />
              <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-hld-purple">
                Drawing <span className="text-hld-feat-glow">{edgeDraftKind}</span> from “{claimOf(edgeDraftFrom)}”
              </span>
              <span className="font-mono text-[8px] tracking-[0.06em] uppercase text-hld-muted">g/r/q/o/x/d/a to retype · click a target · Esc</span>
            </div>
          )}

          {/* Legend (screen space, bottom-left). */}
          <div className="absolute bottom-[12px] left-[12px]" onPointerDown={(e) => e.stopPropagation()}>
            <CanvasLegend />
          </div>

          {/* Key hints (screen space, bottom-right). */}
          <div className="absolute bottom-[12px] right-[12px] font-mono text-[8px] tracking-[0.08em] uppercase text-hld-muted/70 leading-[1.7] text-right pointer-events-none">
            N node · E edge · C centre · 1/2/3 status · Del remove
          </div>
        </div>

        {selectedPart && <CanvasInspector part={selectedPart} onClose={() => setCanvasSelected(null)} />}
      </div>
    </div>
  );
}
