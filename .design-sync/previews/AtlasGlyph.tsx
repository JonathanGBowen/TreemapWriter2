import type { ReactNode } from 'react';
import { AtlasGlyph } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Cap = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">{children}</span>
);

// The "atlas" landmass glyph — the map-mode toggle marker. Rendered enlarged in
// a tile so the coastline curve and capital dot are legible.
export const Marker = () => (
  <Frame>
    <div className="flex items-center gap-4">
      <div
        className="bg-hld-surface border border-hld-border flex items-center justify-center"
        style={{ width: 56, height: 56 }}
      >
        <span className="text-hld-cyan" style={{ transform: 'scale(2.4)' }}>
          <AtlasGlyph c="#00e8f5" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <Cap>ATLAS MODE</Cap>
        <span className="text-[11px] text-hld-text">Land &amp; route projection</span>
      </div>
    </div>
  </Frame>
);

// The glyph across the accent palette — how it tints under different mode hues.
export const Palette = () => (
  <Frame>
    <div className="flex items-center gap-4">
      {[
        { hex: '#00e8f5', cls: 'text-hld-cyan', name: 'CYAN' },
        { hex: '#00e870', cls: 'text-hld-green', name: 'GREEN' },
        { hex: '#ffe600', cls: 'text-hld-yellow', name: 'AMBER' },
        { hex: '#aa00ff', cls: 'text-hld-purple', name: 'PURPLE' },
      ].map((s) => (
        <div key={s.name} className="flex flex-col items-center gap-2">
          <span className={s.cls} style={{ transform: 'scale(1.8)' }}>
            <AtlasGlyph c={s.hex} />
          </span>
          <Cap>{s.name}</Cap>
        </div>
      ))}
    </div>
  </Frame>
);
