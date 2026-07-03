import { describe, expect, it } from 'vitest';
import {
  K_MAX,
  K_MIN,
  centerOn,
  clampK,
  fitView,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Camera,
} from '../canvas-geometry';

const cam: Camera = { tx: 120, ty: -40, k: 1.5 };

describe('canvas-geometry', () => {
  it('worldToScreen / screenToWorld round-trip', () => {
    for (const p of [
      { x: 0, y: 0 },
      { x: 250, y: -90 },
      { x: -333, y: 777 },
    ]) {
      const s = worldToScreen(cam, p.x, p.y);
      const back = screenToWorld(cam, s.x, s.y);
      expect(back.x).toBeCloseTo(p.x, 6);
      expect(back.y).toBeCloseTo(p.y, 6);
    }
  });

  it('worldToScreen matches the wx*k+tx model', () => {
    const s = worldToScreen(cam, 100, 200);
    expect(s.x).toBeCloseTo(100 * 1.5 + 120, 6);
    expect(s.y).toBeCloseTo(200 * 1.5 - 40, 6);
  });

  it('clampK bounds the zoom to [K_MIN, K_MAX]', () => {
    expect(clampK(0.01)).toBe(K_MIN);
    expect(clampK(99)).toBe(K_MAX);
    expect(clampK(1)).toBe(1);
  });

  it('zoomAt keeps the world point under the anchor fixed', () => {
    const anchor = { x: 400, y: 300 };
    const before = screenToWorld(cam, anchor.x, anchor.y);
    const next = zoomAt(cam, 1.1, anchor.x, anchor.y);
    const after = screenToWorld(next, anchor.x, anchor.y);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(next.k).toBeCloseTo(1.5 * 1.1, 6);
  });

  it('zoomAt respects the clamp (never past K_MAX)', () => {
    const next = zoomAt({ tx: 0, ty: 0, k: K_MAX }, 2, 100, 100);
    expect(next.k).toBe(K_MAX);
  });

  it('fitView centres the bounding box in the viewport', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    ];
    const c = fitView(pts, 1000, 700, 90);
    // The centre of the bbox (100,50) should map to the viewport centre.
    const mid = worldToScreen(c, 100, 50);
    expect(mid.x).toBeCloseTo(500, 4);
    expect(mid.y).toBeCloseTo(350, 4);
    // Both extremes fit inside the viewport.
    for (const p of pts) {
      const s = worldToScreen(c, p.x, p.y);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1000);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(700);
    }
  });

  it('fitView on an empty set centres at k=1', () => {
    const c = fitView([], 800, 600);
    expect(c).toEqual({ tx: 400, ty: 300, k: 1 });
  });

  it('centerOn maps the point to the viewport centre', () => {
    const c = centerOn({ x: 42, y: -17 }, 1000, 600, 2);
    const s = worldToScreen(c, 42, -17);
    expect(s.x).toBeCloseTo(500, 6);
    expect(s.y).toBeCloseTo(300, 6);
    expect(c.k).toBe(2);
  });
});
