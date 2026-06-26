import type { ReactNode } from 'react';
import { ResizeHandle } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// On the right edge of an outline column — the draggable divider between two
// panels of the parallel view. The handle is a transparent hit-target that goes
// cyan on hover; shown here over a sized, relative panel so its track is visible.
export const RightEdge = () => (
  <Frame>
    <div className="flex">
      <div className="relative w-[260px] h-[200px] bg-hld-surface border border-hld-border p-4">
        <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-hld-cyan mb-2">
          Reverse outline
        </div>
        <p className="text-[12px] leading-relaxed text-hld-muted-text">
          The treemap is the document, re-projected — each node a section.
        </p>
        <ResizeHandle side="right" onMouseDown={noop} />
      </div>
      <div className="w-[160px] h-[200px] bg-hld-bgDeep border border-l-0 border-hld-border" />
    </div>
  </Frame>
);

// Left-edge placement — the same hairline mirrored onto the start of a panel.
export const LeftEdge = () => (
  <Frame>
    <div className="flex">
      <div className="w-[160px] h-[200px] bg-hld-bgDeep border border-r-0 border-hld-border" />
      <div className="relative w-[260px] h-[200px] bg-hld-surface border border-hld-border p-4">
        <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-hld-green mb-2">
          Your outline
        </div>
        <p className="text-[12px] leading-relaxed text-hld-muted-text">
          State what this paragraph should say, then regenerate to draft it.
        </p>
        <ResizeHandle side="left" onMouseDown={noop} />
      </div>
    </div>
  </Frame>
);
