import type { ReactNode } from 'react';
import { ArrowRightGlyph } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Cap = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">{children}</span>
);

// The flow chevron used between dependency hops in the topology map. Shown
// large with its hex color so the arrowhead reads clearly.
export const Directions = () => (
  <Frame>
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 bg-hld-surface border border-hld-border px-3 py-2">
        <span className="text-hld-text"><ArrowRightGlyph c="#c5d8e8" size={28} /></span>
        <Cap>FLOW · NEUTRAL</Cap>
      </div>
      <div className="flex items-center gap-3 bg-hld-surface border border-hld-border px-3 py-2">
        <span className="text-hld-cyan"><ArrowRightGlyph c="#00e8f5" size={28} /></span>
        <Cap>PREREQUISITE</Cap>
      </div>
      <div className="flex items-center gap-3 bg-hld-surface border border-hld-border px-3 py-2">
        <span className="text-hld-yellow"><ArrowRightGlyph c="#ffe600" size={28} /></span>
        <Cap>WEAK LINK</Cap>
      </div>
    </div>
  </Frame>
);

// In-context: an inline route between two stations on the dependency spine.
export const InlineRoute = () => (
  <Frame>
    <div className="flex items-center gap-3 bg-hld-surface border border-hld-border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em]">
      <span className="text-hld-text">Thesis</span>
      <ArrowRightGlyph c="#00e8f5" size={18} />
      <span className="text-hld-muted-text">Evidence</span>
      <ArrowRightGlyph c="#00e8f5" size={18} />
      <span className="text-hld-muted-text">Conclusion</span>
    </div>
  </Frame>
);
