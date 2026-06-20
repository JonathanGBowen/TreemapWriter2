import { useCallback } from 'react';
import type React from 'react';

/**
 * The canonical column-resize primitive. Both the main-page panels (sidebar,
 * tests panel) and the full-screen workspaces (revision, compare) drag-resize
 * their columns through this, so the clamp + delta-sign + CodeMirror-relayout
 * invariants live in exactly one place. The pure pieces (`clampWidth`,
 * `nextWidth`) are unit-tested; the hook wires them to pointer events.
 */

/** Clamp a candidate width to [min, max]. Pure. */
export const clampWidth = (width: number, min: number, max: number): number =>
  Math.max(min, Math.min(width, max));

/**
 * The next width for a drag delta. A handle on the RIGHT edge of a panel grows it
 * as the pointer moves right (clientX increases); a LEFT-edge handle grows it as
 * the pointer moves left. Pure.
 */
export const nextWidth = (
  edge: 'left' | 'right',
  startWidth: number,
  startX: number,
  clientX: number,
  min: number,
  max: number,
): number => {
  const delta = edge === 'right' ? clientX - startX : startX - clientX;
  return clampWidth(startWidth + delta, min, max);
};

export interface ColumnResizeOptions {
  width: number;
  setWidth: (w: number) => void;
  /** Which edge the handle sits on (selects the delta sign). */
  edge: 'left' | 'right';
  min: number;
  max: number;
  /**
   * Fired once on pointer release. Defaults to dispatching a window `resize` so
   * CodeMirror (which several columns host) reflows to the new width — load-bearing.
   */
  onEnd?: () => void;
}

/** A column-resize drag handler. Spread the returned `onMouseDown` onto a `ResizeHandle`. */
export const useColumnResize = ({ width, setWidth, edge, min, max, onEnd }: ColumnResizeOptions) =>
  useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const onMove = (ev: MouseEvent) =>
        setWidth(nextWidth(edge, startWidth, startX, ev.clientX, min, max));
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = 'default';
        (onEnd ?? (() => window.dispatchEvent(new Event('resize'))))();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
    },
    [width, setWidth, edge, min, max, onEnd],
  );
