// Pan/zoom for the W₁ Canvas — a small, world-px camera hook (NOT the SVG-viewBox
// `topo/usePanZoom`, whose 1100-unit space fights an HTML overlay). Owns the `Camera`
// {tx,ty,k}, pans the background on pointer-drag, zooms to the cursor on wheel, and
// exposes `screenToWorldClient` for create-at-cursor + drop. Node drag is handled in
// the card (it stops propagation so the background pan never fires).

import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { type Camera, type Pt, centerOn, fitView, screenToWorld, zoomAt } from './canvas-geometry';

const PAN_THRESHOLD = 3; // px before a press counts as a pan (vs a click-to-deselect)

export interface CanvasPanZoom {
  cam: Camera;
  setCam: (c: Camera) => void;
  panning: boolean;
  /** Bind to the viewport background: pan on drag, deselect on a clean click. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  };
  /** A DOM/React pointer event's client coords → world coords. */
  screenToWorldClient: (clientX: number, clientY: number) => Pt;
  /** Fit all `points` into the current viewport. */
  fit: (points: Pt[]) => void;
  /** Centre the camera on one world point (the topo deep-link focus). */
  focusOn: (p: Pt, k?: number) => void;
}

export function useCanvasPanZoom(viewportRef: RefObject<HTMLElement | null>, onEmptyClick?: () => void): CanvasPanZoom {
  const [cam, setCam] = useState<Camera>({ tx: 0, ty: 0, k: 1 });
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ startX: number; startY: number; camX: number; camY: number; moved: boolean } | null>(null);

  const rect = () => viewportRef.current?.getBoundingClientRect() ?? new DOMRect();

  const screenToWorldClient = useCallback(
    (clientX: number, clientY: number): Pt => {
      const r = rect();
      return screenToWorld(cam, clientX - r.left, clientY - r.top);
    },
    [cam],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only the background (not a card, which stops propagation) reaches here.
      if (e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      drag.current = { startX: e.clientX, startY: e.clientY, camX: cam.tx, camY: cam.ty, moved: false };
    },
    [cam],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
    d.moved = true;
    setPanning(true);
    setCam((c) => ({ ...c, tx: d.camX + dx, ty: d.camY + dy }));
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      setPanning(false);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (d && !d.moved) onEmptyClick?.(); // a clean click on the background = deselect
    },
    [onEmptyClick],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const r = rect();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setCam((c) => zoomAt(c, factor, e.clientX - r.left, e.clientY - r.top));
    },
    [],
  );

  const fit = useCallback(
    (points: Pt[]) => {
      const r = rect();
      setCam(fitView(points, r.width || 1000, r.height || 700));
    },
    [],
  );

  const focusOn = useCallback(
    (p: Pt, k = 1) => {
      const r = rect();
      setCam(centerOn(p, r.width || 1000, r.height || 700, k));
    },
    [],
  );

  return {
    cam,
    setCam,
    panning,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onWheel },
    screenToWorldClient,
    fit,
    focusOn,
  };
}
