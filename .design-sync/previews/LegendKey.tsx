import type { ReactNode } from 'react';
import { LegendKey } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// LegendKey positions itself absolutely (left/top: 12) over the map surface, so
// each cell supplies a relative, sized stage standing in for the topology canvas.
const Stage = ({ children }: { children: ReactNode }) => (
  <div
    className="relative bg-hld-bgDeep border border-hld-border overflow-hidden"
    style={{ width: 320, height: 280 }}
  >
    {children}
  </div>
);

// Atlas mode — the route/land key as it sits over the map projection, with the
// area-and-fog rows that only appear in the landmass view.
export const AtlasMode = () => (
  <Frame>
    <Stage>
      <LegendKey mode="atlas" />
    </Stage>
  </Frame>
);

// Spine mode — the dependency/station key; drops the land-area rows.
export const SpineMode = () => (
  <Frame>
    <Stage>
      <LegendKey mode="spine" />
    </Stage>
  </Frame>
);
