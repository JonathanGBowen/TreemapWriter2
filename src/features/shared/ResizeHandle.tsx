import type React from 'react';

interface ResizeHandleProps {
  /** Which edge of the panel the handle sits on. */
  side: 'left' | 'right';
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * The thin draggable column divider (HLD style): transparent until hover, then a
 * cyan hairline. Pair with `useColumnResize`. `side` places it on the panel's
 * left or right edge (the two class strings are complete literals so Tailwind's
 * JIT sees them).
 */
export const ResizeHandle: React.FC<ResizeHandleProps> = ({ side, onMouseDown }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize column"
    onMouseDown={onMouseDown}
    className={`absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-hld-cyan/50 hover:w-2 transition-all duration-150 z-50 ${
      side === 'right' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'
    }`}
  />
);
