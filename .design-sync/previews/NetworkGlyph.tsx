import type { ReactNode } from 'react';
import { NetworkGlyph } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Cap = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">{children}</span>
);

// The node-graph glyph that labels the dependency-spine view. Already 24px by
// default and accepts a size — shown enlarged with its hex color.
export const Glyph = () => (
  <Frame>
    <div className="flex items-center gap-4">
      <div
        className="bg-hld-surface border border-hld-border flex items-center justify-center"
        style={{ width: 64, height: 64 }}
      >
        <span className="text-hld-cyan"><NetworkGlyph c="#00e8f5" size={40} /></span>
      </div>
      <div className="flex flex-col gap-1">
        <Cap>SPINE MODE</Cap>
        <span className="text-[11px] text-hld-text">Dependency graph view</span>
      </div>
    </div>
  </Frame>
);

// Across mode hues — three nodes-and-edges marks at a readable size.
export const Hues = () => (
  <Frame>
    <div className="flex items-center gap-5">
      {[
        { hex: '#00e8f5', cls: 'text-hld-cyan', name: 'ACTIVE' },
        { hex: '#00e870', cls: 'text-hld-green', name: 'RESOLVED' },
        { hex: '#ff1060', cls: 'text-hld-magenta', name: 'BROKEN' },
      ].map((s) => (
        <div key={s.name} className="flex flex-col items-center gap-2">
          <span className={s.cls}><NetworkGlyph c={s.hex} size={32} /></span>
          <Cap>{s.name}</Cap>
        </div>
      ))}
    </div>
  </Frame>
);
