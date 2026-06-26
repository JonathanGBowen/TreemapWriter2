import type { ReactNode } from 'react';
import { SpineGlyph } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Cap = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hld-muted-text">{children}</span>
);

// The spine glyph — vertical station-stops with a dashed reference branch. It is
// the icon for the dependency-spine layout. Shown enlarged so the three nodes
// and the dotted limb are legible.
export const Glyph = () => (
  <Frame>
    <div className="flex items-center gap-4">
      <div
        className="bg-hld-surface border border-hld-border flex items-center justify-center"
        style={{ width: 56, height: 56 }}
      >
        <span className="text-hld-cyan" style={{ transform: 'scale(2.6)' }}>
          <SpineGlyph c="#00e8f5" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <Cap>DEPENDENCY SPINE</Cap>
        <span className="text-[11px] text-hld-text">Station-stop layout</span>
      </div>
    </div>
  </Frame>
);

// Across mode hues — the spine mark tinted by status.
export const Hues = () => (
  <Frame>
    <div className="flex items-center gap-6">
      {[
        { hex: '#00e8f5', cls: 'text-hld-cyan', name: 'ACTIVE' },
        { hex: '#00e870', cls: 'text-hld-green', name: 'COMPLETE' },
        { hex: '#aa00ff', cls: 'text-hld-purple', name: 'SECONDARY' },
      ].map((s) => (
        <div key={s.name} className="flex flex-col items-center gap-2">
          <span className={s.cls} style={{ transform: 'scale(2)' }}>
            <SpineGlyph c={s.hex} />
          </span>
          <Cap>{s.name}</Cap>
        </div>
      ))}
    </div>
  </Frame>
);
