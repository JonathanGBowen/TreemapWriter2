import type { ReactNode } from 'react';
import { RefreshGlyph } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Cap = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">{children}</span>
);

// The re-layout / recompute glyph (13px native). Shown scaled up so the curved
// arrow and its tick read, across the states it appears in.
export const States = () => (
  <Frame>
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-cyan" style={{ transform: 'scale(2.2)' }}>
          <RefreshGlyph c="#00e8f5" />
        </span>
        <Cap>RE-LAYOUT</Cap>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-yellow" style={{ transform: 'scale(2.2)' }}>
          <RefreshGlyph c="#ffe600" />
        </span>
        <Cap>STALE · RECOMPUTE</Cap>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-muted-text" style={{ transform: 'scale(2.2)' }}>
          <RefreshGlyph c="#6f8cab" />
        </span>
        <Cap>IDLE</Cap>
      </div>
    </div>
  </Frame>
);

// In context: the "recompute topology" toolbar control.
export const ToolbarButton = () => (
  <Frame>
    <button
      type="button"
      onClick={() => {}}
      className="flex items-center gap-2 bg-hld-surface border border-hld-border px-3 py-2 text-hld-cyan hover:text-hld-text"
    >
      <RefreshGlyph c="#00e8f5" />
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">Recompute</span>
    </button>
  </Frame>
);
