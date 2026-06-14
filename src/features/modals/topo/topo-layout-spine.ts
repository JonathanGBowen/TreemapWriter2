/* topo-layout-spine.ts — SPINE (metro) position derivation.

   Deterministic per-Part column layout: one vertical column per Line (Part),
   stations stacked top-to-bottom in document order. This replaces the
   prototype's hand-authored COL/ROW table and the current modal's dagre
   TB/LR aspect-flip — the metro reading requires "one straight line per Part",
   which a column layout gives exactly and reproducibly. Dependency arcs are
   drawn as bowed curves ON TOP, so layout-time crossing minimisation is moot. */

import type { TopoModel, Arc } from './topo-derive';

export interface XY {
  x: number;
  y: number;
}
export interface SpineLayout {
  pos: Record<string, XY>;
  width: number;
  height: number;
}

export interface SpineOpts {
  colGap: number;
  rowGap: number;
  marginX: number;
  marginY: number;
}
const DEFAULTS: SpineOpts = { colGap: 250, rowGap: 168, marginX: 200, marginY: 120 };

export function layoutSpine(model: TopoModel, opts: Partial<SpineOpts> = {}): SpineLayout {
  const o = { ...DEFAULTS, ...opts };
  const pos: Record<string, XY> = {};
  let maxRows = 0;
  model.lines.forEach((line, ci) => {
    const x = o.marginX + ci * o.colGap;
    line.stationIds.forEach((id, ri) => {
      pos[id] = { x, y: o.marginY + ri * o.rowGap };
    });
    maxRows = Math.max(maxRows, line.stationIds.length);
  });
  const cols = Math.max(0, model.lines.length - 1);
  const rows = Math.max(0, maxRows - 1);
  return {
    pos,
    width: o.marginX * 2 + cols * o.colGap,
    height: o.marginY * 2 + rows * o.rowGap,
  };
}

// A Part line's track = straight segments through its stations in order.
export function lineTrackPath(stationIds: string[], pos: Record<string, XY>): string {
  const pts = stationIds.map((id) => pos[id]).filter(Boolean) as XY[];
  if (pts.length === 0) return '';
  return 'M' + pts.map((p) => `${p.x},${p.y}`).join(' L');
}

export interface DepGeom {
  d: string;
  arrow: { x: number; y: number; angle: number };
  dir: number;
}

// A dependency arc = smooth cubic from source → target with horizontal handles;
// the curve ends just before the target ring so the arrowhead sits at the edge.
export function depGeom(arc: Arc, pos: Record<string, XY>, R = 13): DepGeom | null {
  const s = pos[arc.source];
  const t = pos[arc.target];
  if (!s || !t) return null;
  const dir = Math.sign(t.x - s.x) || 1;
  const k = Math.max(70, Math.abs(t.x - s.x) * 0.46);
  const ex = t.x - dir * (R + 7);
  const ey = t.y;
  const d = `M${s.x},${s.y} C ${s.x + dir * k},${s.y} ${ex - dir * k},${ey} ${ex},${ey}`;
  const angle = dir > 0 ? 0 : 180;
  return { d, arrow: { x: ex, y: ey, angle }, dir };
}

export function depMidpoint(arc: Arc, pos: Record<string, XY>): XY | null {
  const s = pos[arc.source];
  const t = pos[arc.target];
  if (!s || !t) return null;
  return { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
}
