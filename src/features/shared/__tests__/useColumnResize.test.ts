import { describe, expect, it } from 'vitest';
import { clampWidth, nextWidth } from '../useColumnResize';

describe('clampWidth', () => {
  it('clamps to the [min, max] range', () => {
    expect(clampWidth(150, 200, 800)).toBe(200);
    expect(clampWidth(900, 200, 800)).toBe(800);
    expect(clampWidth(400, 200, 800)).toBe(400);
  });
});

describe('nextWidth', () => {
  it('a right-edge handle grows the panel as the pointer moves right', () => {
    // start 300px wide, pointer drags +50px to the right.
    expect(nextWidth('right', 300, 100, 150, 200, 800)).toBe(350);
    // dragging left shrinks it.
    expect(nextWidth('right', 300, 100, 60, 200, 800)).toBe(260);
  });

  it('a left-edge handle grows the panel as the pointer moves left', () => {
    // start 300px wide, pointer drags 50px to the left → wider.
    expect(nextWidth('left', 300, 150, 100, 200, 800)).toBe(350);
    // dragging right shrinks it.
    expect(nextWidth('left', 300, 150, 200, 200, 800)).toBe(250);
  });

  it('respects the clamp at the extremes', () => {
    expect(nextWidth('right', 790, 0, 100, 200, 800)).toBe(800); // would be 890
    expect(nextWidth('left', 210, 0, 100, 200, 800)).toBe(200); // would be 110
  });
});
