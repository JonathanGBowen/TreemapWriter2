import type { ReactNode } from 'react';
import { Confidence } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// The gold trust numeral at both sizes, beside a faux section title so the
// right-aligned engine signal reads in context.
export const Default = () => (
  <Frame>
    <div className="flex items-center justify-between border border-hld-border bg-hld-surface px-4 py-3 max-w-[320px]">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-hld-muted-text-2">Thesis · §2</span>
      <Confidence score={4.2} />
    </div>
  </Frame>
);

export const Large = () => (
  <Frame>
    <div className="flex items-center gap-6">
      <Confidence score={2.7} />
      <Confidence score={5.0} large />
    </div>
  </Frame>
);
