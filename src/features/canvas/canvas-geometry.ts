// Pure world↔screen geometry for the W₁ Canvas (Arpeggio Phase 4). The canvas is an
// HTML card overlay + SVG edge layer inside ONE world-coordinate container transformed
// by `translate(tx,ty) scale(k)`. World coords are px in an unbounded plane; a node's
// `position` is its CENTRE. No React here — unit-tested like the other lib helpers.

export interface Camera {
  tx: number;
  ty: number;
  k: number;
}

export interface Pt {
  x: number;
  y: number;
}

export const K_MIN = 0.25;
export const K_MAX = 2.5;
export const clampK = (k: number): number => Math.max(K_MIN, Math.min(K_MAX, k));

/** A screen point (relative to the viewport top-left) → world coords. */
export function screenToWorld(cam: Camera, sx: number, sy: number): Pt {
  return { x: (sx - cam.tx) / cam.k, y: (sy - cam.ty) / cam.k };
}

/** A world point → screen coords (relative to the viewport top-left). */
export function worldToScreen(cam: Camera, wx: number, wy: number): Pt {
  return { x: wx * cam.k + cam.tx, y: wy * cam.k + cam.ty };
}

/** Zoom by `factor` about a screen anchor, keeping the world point under the anchor fixed. */
export function zoomAt(cam: Camera, factor: number, sx: number, sy: number): Camera {
  const k = clampK(cam.k * factor);
  const w = screenToWorld(cam, sx, sy);
  return { k, tx: sx - w.x * k, ty: sy - w.y * k };
}

/** Fit a set of world points into a viewport (with padding), centred. */
export function fitView(points: Pt[], viewW: number, viewH: number, pad = 90): Camera {
  if (points.length === 0) return { tx: viewW / 2, ty: viewH / 2, k: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const k = clampK(Math.min((viewW - 2 * pad) / w, (viewH - 2 * pad) / h));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { k, tx: viewW / 2 - cx * k, ty: viewH / 2 - cy * k };
}

/** Centre the camera on one world point at a given zoom. */
export function centerOn(p: Pt, viewW: number, viewH: number, k: number): Camera {
  return { k, tx: viewW / 2 - p.x * k, ty: viewH / 2 - p.y * k };
}
