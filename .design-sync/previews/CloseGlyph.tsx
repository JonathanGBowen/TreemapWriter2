import type { ReactNode } from 'react';
import { CloseGlyph } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Cap = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">{children}</span>
);

// The dismiss "X" — uses currentColor, so the wrapper text color drives it.
// Shown at its default and a larger size, plus an interactive hit-target tint.
export const Sizes = () => (
  <Frame>
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-text"><CloseGlyph /></span>
        <Cap>16 · DEFAULT</Cap>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-text"><CloseGlyph size={28} /></span>
        <Cap>28 · LARGE</Cap>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-magenta"><CloseGlyph size={28} /></span>
        <Cap>HOVER · MAGENTA</Cap>
      </div>
    </div>
  </Frame>
);

// In context: the modal header close affordance, top-right of a panel bar.
export const HeaderButton = () => (
  <Frame>
    <div className="flex items-center justify-between bg-hld-surface border border-hld-border px-4 py-3 w-[300px]">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-hld-text">Argument Topology</span>
      <button
        type="button"
        onClick={() => {}}
        className="text-hld-muted-text hover:text-hld-text flex items-center"
        aria-label="Close"
      >
        <CloseGlyph size={18} />
      </button>
    </div>
  </Frame>
);
