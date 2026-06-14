/* usePanZoom — shared pan/zoom/fit for the bespoke SVG map surfaces.

   Both projections (ATLAS, SPINE) use the same interaction model: a viewBox of
   `box` units, a {k,x,y} transform on the inner <g>, wheel zoom-to-cursor, drag
   to pan, and click-on-empty to deselect (a 3px move threshold distinguishes a
   click from a drag). The "fit" target differs per view (layout bounds vs node
   bounds), so it's injected as a callback. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, type Transform } from './topo-sim-atlas';

export interface Box {
  w: number;
  h: number;
}

export interface PanZoom {
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  box: Box;
  t: Transform;
  setT: React.Dispatch<React.SetStateAction<Transform>>;
  fit: () => void;
  dragging: boolean;
  handlers: {
    onWheel: (e: React.WheelEvent) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
  };
}

type ComputeFit = (vbW: number, vbH: number) => Transform;

export function usePanZoom(computeFit: ComputeFit, onEmptyClick?: () => void): PanZoom {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [box, setBox] = useState<Box>({ w: 1100, h: 660 });
  const [dragging, setDragging] = useState(false);
  const [t, setT] = useState<Transform>(() => computeFit(1100, 660));

  // keep the latest fit + empty-click + transform without re-binding effects
  const fitRef = useRef(computeFit);
  fitRef.current = computeFit;
  const emptyRef = useRef(onEmptyClick);
  emptyRef.current = onEmptyClick;
  const tRef = useRef(t);
  tRef.current = t;

  // measure container → viewBox (fixed width 1100, height tracks aspect)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const w = 1100;
      const h = Math.round(clamp((w * r.height) / r.width, 460, 1600));
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => {
      if (ro) ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // refit on resize (unless mid-drag)
  useEffect(() => {
    if (!drag.current) setT(fitRef.current(box.w, box.h));
  }, [box.w, box.h]);

  const fit = useCallback(() => setT(fitRef.current(box.w, box.h)), [box.w, box.h]);

  const toVB = useCallback(
    (cx: number, cy: number) => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * box.w, y: ((cy - r.top) / r.height) * box.h };
    },
    [box.w, box.h],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const p = toVB(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setT((prev) => {
        const k = clamp(prev.k * factor, 0.45, 3.0);
        return { k, x: p.x - ((p.x - prev.x) / prev.k) * k, y: p.y - ((p.y - prev.y) / prev.k) * k };
      });
    },
    [toVB],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: tRef.current.x, oy: tRef.current.y, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - drag.current.sx) / r.width) * box.w;
      const dy = ((e.clientY - drag.current.sy) / r.height) * box.h;
      if (Math.abs(e.clientX - drag.current.sx) + Math.abs(e.clientY - drag.current.sy) > 3)
        drag.current.moved = true;
      const d = drag.current;
      setT((prev) => ({ ...prev, x: d.ox + dx, y: d.oy + dy }));
    },
    [box.w, box.h],
  );

  const onPointerUp = useCallback(() => {
    if (drag.current && !drag.current.moved) emptyRef.current?.();
    drag.current = null;
    setDragging(false);
  }, []);

  return {
    containerRef,
    svgRef,
    box,
    t,
    setT,
    fit,
    dragging,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
  };
}
