import type { ReactNode } from 'react';
import { SegControl } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// The modal "DEPTH" instrument — cyan accent, middle option selected (bracketed
// corners + tinted bg). Static render of the selected state.
export const Depth = () => (
  <Frame>
    <div className="max-w-[360px]">
      <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-hld-muted-text mb-2">Depth</div>
      <SegControl
        ariaLabel="Depth"
        value={1}
        onChange={noop}
        options={[
          { glyph: '◇', label: 'Section', fine: '1 level' },
          { glyph: '◈', label: 'Branch', fine: '2 levels' },
          { glyph: '◆', label: 'Whole', fine: 'all' },
        ]}
      />
    </div>
  </Frame>
);

// Magenta accent variant (destructive / scope axis), first option selected.
export const ScopeMagenta = () => (
  <Frame>
    <div className="max-w-[300px]">
      <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-hld-muted-text mb-2">Scope</div>
      <SegControl
        ariaLabel="Scope"
        accent="magenta"
        value={0}
        onChange={noop}
        options={[
          { glyph: '◐', label: 'Draft' },
          { glyph: '▣', label: 'Final' },
        ]}
      />
    </div>
  </Frame>
);
