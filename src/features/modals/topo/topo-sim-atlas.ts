/* eslint-disable no-restricted-syntax -- the SEA colour is drawn into the SVG/
   canvas topology map, where CSS `var()` does not resolve; it must be literal. */
/* topo-sim-atlas.ts — ATLAS (continental) position derivation.

   A small force-directed simulation (no d3) ported from the design prototype
   (topo-land.jsx). Sections are bodies; same-Part bodies cohere into a
   continent; dependency edges are springs (the OPTIMISE objective).

   Determinism: the settled target for OPTIMISE is computed SYNCHRONOUSLY (a
   for-loop), so the result + metrics never depend on requestAnimationFrame
   firing (which hosts throttle off-screen / in screenshot harnesses). The view
   animates current→target purely for the visual, with a setTimeout fallback
   that snaps to the precomputed target. Pure module — no React. */

import type { TopoModel, Arc, Status } from './topo-derive';

export interface Canvas {
  w: number;
  h: number;
}
export interface SimNode {
  id: string;
  part: string; // partId
  r: number; // radius ∝ √words
  status: Status;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Metrics {
  len: number;
  cross: number;
}
export interface SimOpts {
  deps: boolean;
  cross: boolean;
}
export interface Transform {
  k: number;
  x: number;
  y: number;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ── colour helpers (metaball land tint) ─────────────────────────────
function hex2rgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgb2hex(r: number[]): string {
  return '#' + r.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function mix(a: string, b: string, t: number): string {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
}
export const SEA = '#060d18';
export const landColor = (hue: string) => mix(hue, SEA, 0.7); // dark hue-tinted interior
export const coastColor = (hue: string) => hue; // bright shoreline rim

// radius from word count (≥120 word floor so empty sections still read)
export function radiusOf(words: number): number {
  return 20 + (Math.sqrt(Math.max(words, 120)) - 11) * 0.62;
}

// Canvas extents derived from counts (the prototype hardcoded 1240×740 for 18
// stations). Column spread and 78px row pitch match initialLayout below.
export function canvasFor(model: TopoModel): Canvas {
  const P = Math.max(1, model.lines.length);
  const maxPer = model.lines.length
    ? Math.max(1, ...model.lines.map((l) => l.stationIds.length))
    : 1;
  return {
    w: Math.max(900, 300 + (P - 1) * 235),
    h: Math.max(560, 240 + (maxPer - 1) * 78),
  };
}

// Initial (un-optimised) layout: one column per Part in chapter order, stations
// stacked, slight ±16 stagger so same-Part provinces settle touching.
export function initialLayout(model: TopoModel, canvas: Canvas): SimNode[] {
  const P = model.lines.length;
  const cols = model.lines.map((_, i) =>
    P <= 1 ? canvas.w / 2 : 175 + (i * (canvas.w - 300)) / (P - 1),
  );
  const nodes: SimNode[] = [];
  model.lines.forEach((line, ci) => {
    const ids = line.stationIds;
    const n = ids.length;
    const top = canvas.h / 2 - ((n - 1) * 78) / 2;
    ids.forEach((id, ri) => {
      const st = model.stationById[id];
      nodes.push({
        id,
        part: line.id,
        r: radiusOf(st?.words ?? 0),
        status: st?.status ?? 'idle',
        x: cols[ci] + (ri % 2 ? 16 : -16),
        y: top + ri * 78,
        vx: 0,
        vy: 0,
      });
    });
  });
  return nodes;
}

// One integration step (mutates nodes in place).
export function simStep(
  nodes: SimNode[],
  arcs: Arc[],
  alpha: number,
  opts: SimOpts,
  canvas: Canvas,
): void {
  const idx: Record<string, number> = {};
  nodes.forEach((n, i) => {
    idx[n.id] = i;
  });
  const cx = canvas.w / 2;
  const cy = canvas.h / 2;

  // part centroids (for cohesion — keeps continents contiguous)
  const cent: Record<string, { x: number; y: number }> = {};
  const cnt: Record<string, number> = {};
  nodes.forEach((n) => {
    (cent[n.part] ||= { x: 0, y: 0 }).x += n.x;
    cent[n.part].y += n.y;
    cnt[n.part] = (cnt[n.part] || 0) + 1;
  });
  Object.keys(cent).forEach((p) => {
    cent[p].x /= cnt[p];
    cent[p].y /= cnt[p];
  });

  const fx = nodes.map(() => 0);
  const fy = nodes.map(() => 0);

  // pairwise repulsion (cross-part strong; same-part mild so they settle touching)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const same = a.part === b.part;
      if (!same && !opts.cross) continue; // initial settle: no cross-continent interaction
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const minD = a.r + b.r + (same ? -6 : 46);
      const nx = dx / d;
      const ny = dy / d;
      let rep = same ? 1400 / (d * d) : 12000 / (d * d);
      if (d < minD) rep += (minD - d) * (same ? 0.35 : 1.4);
      fx[i] += nx * rep;
      fy[i] += ny * rep;
      fx[j] -= nx * rep;
      fy[j] -= ny * rep;
    }
  }

  // dependency springs (attraction) — the optimisation objective
  if (opts.deps) {
    arcs.forEach((dep) => {
      const ai = idx[dep.source];
      const bi = idx[dep.target];
      if (ai === undefined || bi === undefined) return;
      const a = nodes[ai];
      const b = nodes[bi];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const ideal = a.r + b.r + 92;
      const k = dep.type === 'reference' ? 0.016 : 0.04;
      const f = (d - ideal) * k;
      const nx = dx / d;
      const ny = dy / d;
      fx[ai] += nx * f;
      fy[ai] += ny * f;
      fx[bi] -= nx * f;
      fy[bi] -= ny * f;
    });
  }

  // part cohesion (always) + centre gravity (optimise only)
  nodes.forEach((n, i) => {
    fx[i] += (cent[n.part].x - n.x) * 0.05;
    fy[i] += (cent[n.part].y - n.y) * 0.05;
    if (opts.cross) {
      fx[i] += (cx - n.x) * 0.006;
      fy[i] += (cy - n.y) * 0.006;
    }
  });

  // integrate
  const damp = 0.84;
  const max = 14;
  nodes.forEach((n, i) => {
    n.vx = (n.vx + fx[i] * alpha) * damp;
    n.vy = (n.vy + fy[i] * alpha) * damp;
    n.vx = clamp(n.vx, -max, max);
    n.vy = clamp(n.vy, -max, max);
    n.x += n.vx;
    n.y += n.vy;
    n.x = clamp(n.x, 70, canvas.w - 70);
    n.y = clamp(n.y, 60, canvas.h - 60);
  });
}

const cloneNodes = (nodes: SimNode[]): SimNode[] => nodes.map((n) => ({ ...n }));

// Step count scales DOWN with node count so large docs stay responsive.
const stepBudget = (n: number) => Math.round(clamp(20000 / Math.max(1, n), 80, 340));

// Build the initial landscape: continents compacted in place by chapter order
// (synchronous, dependency springs OFF — deliberately un-optimised).
export function buildInitial(model: TopoModel, canvas: Canvas): SimNode[] {
  const nodes = initialLayout(model, canvas);
  const steps = Math.min(90, stepBudget(nodes.length));
  for (let i = 0; i < steps; i++) simStep(nodes, model.arcs, 0.55, { deps: false, cross: false }, canvas);
  return nodes;
}

// Compute the OPTIMISED target synchronously (springs + cross-continent forces).
export function optimizeTarget(nodes: SimNode[], arcs: Arc[], canvas: Canvas): SimNode[] {
  const target = cloneNodes(nodes).map((n) => ({ ...n, vx: 0, vy: 0 }));
  const steps = stepBudget(target.length);
  for (let i = 0; i < steps; i++) simStep(target, arcs, 0.6, { deps: true, cross: true }, canvas);
  return target;
}

// ── metrics: total route length + crossing count ───────────────────
export function metrics(nodes: SimNode[], arcs: Arc[]): Metrics {
  const m: Record<string, SimNode> = {};
  nodes.forEach((n) => {
    m[n.id] = n;
  });
  let len = 0;
  const segs: [SimNode, SimNode][] = [];
  arcs.forEach((d) => {
    const a = m[d.source];
    const b = m[d.target];
    if (!a || !b) return;
    len += Math.hypot(b.x - a.x, b.y - a.y);
    segs.push([a, b]);
  });
  let cross = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segInt(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) cross++;
    }
  }
  return { len: Math.round(len), cross };
}

export function segInt(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-6) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98;
}

// Fit camera to the bounding box of a set of nodes (after optimisation).
export function fitNodes(nodes: SimNode[], vbW: number, vbH: number, canvas?: Canvas): Transform {
  if (!nodes.length) {
    const w = canvas?.w ?? 1000;
    const h = canvas?.h ?? 600;
    const k = clamp(Math.min(vbW / (w + 220), vbH / (h + 180)), 0.4, 2.2);
    return { k, x: vbW / 2 - (w / 2) * k, y: vbH / 2 - (h / 2) * k };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - n.r);
    minY = Math.min(minY, n.y - n.r);
    maxX = Math.max(maxX, n.x + n.r);
    maxY = Math.max(maxY, n.y + n.r);
  });
  const padX = 150;
  const padY = 120;
  const w = maxX - minX + padX * 2;
  const h = maxY - minY + padY * 2;
  const k = clamp(Math.min(vbW / w, vbH / h), 0.4, 2.2);
  const cxw = (minX + maxX) / 2;
  const cyw = (minY + maxY) / 2;
  return { k, x: vbW / 2 - cxw * k, y: vbH / 2 - cyw * k };
}
