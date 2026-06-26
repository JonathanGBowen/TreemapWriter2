import type { ReactNode } from 'react';
import { WandGlyph } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Cap = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">{children}</span>
);

// The wand-and-spark glyph — the AI-assist / auto-arrange affordance (13px
// native). Enlarged so the wand stroke and four-point spark read.
export const States = () => (
  <Frame>
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-purple" style={{ transform: 'scale(2.4)' }}>
          <WandGlyph c="#aa00ff" />
        </span>
        <Cap>AUTO-ARRANGE</Cap>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-cyan" style={{ transform: 'scale(2.4)' }}>
          <WandGlyph c="#00e8f5" />
        </span>
        <Cap>SUGGEST</Cap>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-hld-green" style={{ transform: 'scale(2.4)' }}>
          <WandGlyph c="#00e870" />
        </span>
        <Cap>APPLIED</Cap>
      </div>
    </div>
  </Frame>
);

// In context: the "auto-layout" assist button on the topology toolbar.
export const AssistButton = () => (
  <Frame>
    <button
      type="button"
      onClick={() => {}}
      className="flex items-center gap-2 bg-hld-surface border border-hld-border px-3 py-2 text-hld-purple hover:text-hld-text"
    >
      <WandGlyph c="#aa00ff" />
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">Auto-layout</span>
    </button>
  </Frame>
);
