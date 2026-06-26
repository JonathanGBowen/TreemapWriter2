import type { ReactNode } from 'react';
import { OriginalCell } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Column = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[340px] border border-hld-border bg-hld-surface">
    <div className="px-5 py-2 border-b border-hld-border font-mono uppercase tracking-[0.14em] text-[9px] bg-hld-surface2 text-hld-muted-text">
      Original
    </div>
    <div className="flex">{children}</div>
  </div>
);

// Column 1 — the original paragraph, read-only serif reference prose.
export const Paragraph = () => (
  <Frame>
    <Column>
      <OriginalCell text="The treemap is not a chart bolted onto a document — it is the document, re-projected. Every node is a section; its area is the weight of the argument it carries, and its hue is how finished that argument reads." />
    </Column>
  </Frame>
);

// The empty case — an inserted row has no original paragraph, so the cell shows
// its quiet placeholder instead.
export const Inserted = () => (
  <Frame>
    <Column>
      <OriginalCell text="" />
    </Column>
  </Frame>
);
