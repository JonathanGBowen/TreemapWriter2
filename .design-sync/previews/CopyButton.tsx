import type { ReactNode } from 'react';
import { CopyButton } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// The quiet default — a muted hairline button on the prompt-inspector toolbar.
// Carries the system prompt as its clipboard payload; flips to a green "Copied"
// for 2s on click.
export const Quiet = () => (
  <Frame>
    <div className="max-w-[360px] bg-hld-surface border border-hld-border p-3">
      <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-hld-muted-text-2 mb-2.5">
        Regeneration prompt
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-hld-muted-text">opus-4 · 1,284 tokens</span>
        <CopyButton text="Rewrite this paragraph to state the claim directly, in one sentence." />
      </div>
    </div>
  </Frame>
);

// Custom label variants — same quiet affordance, different verbs across the app
// (copy a citation anchor, copy the distilled outline).
export const Labels = () => (
  <Frame>
    <div className="flex flex-col items-start gap-3">
      <CopyButton text="Section 3 — The treemap is the document, re-projected." label="Copy outline" />
      <CopyButton text="¶ anchor: a3f9-original-paragraph" label="Copy anchor" title="Copy the verbatim anchor" />
      <CopyButton text="Every node is a section; its area is the weight of its argument." label="Copy claim" />
    </div>
  </Frame>
);
