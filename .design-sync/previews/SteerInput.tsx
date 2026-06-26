import type { ReactNode } from 'react';
import { SteerInput } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// SteerInput is flex-1/min-h-0 — it fills its pane. Give it a sized, bordered
// stand-in for the level-generation rail it lives in.
const Pane = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-hld-surface border border-hld-border flex flex-col"
    style={{ width: 440, height: 360 }}
  >
    {children}
  </div>
);

const noop = () => {};

// The idle state: a written steer note and the primary "generate" button.
// Once a proposal exists the button reads "↻ Regenerate this level".
export const Written = () => (
  <Frame>
    <Pane>
      <SteerInput
        steer={
          'Frame the Introduction around the two-world problem: foreground the gap between the manifest and scientific images, and keep the methodology subordinate to the central thesis.'
        }
        status="idle"
        hasProposal
        onSteerChange={noop}
        onGenerate={noop}
      />
    </Pane>
  </Frame>
);

// The empty default — no steer yet, no proposal. The placeholder and the
// "▸ Generate this level" primary show the first-run affordance.
export const Empty = () => (
  <Frame>
    <Pane>
      <SteerInput
        steer=""
        status="idle"
        hasProposal={false}
        onSteerChange={noop}
        onGenerate={noop}
      />
    </Pane>
  </Frame>
);

// Mid-generation: the primary is disabled and reads "Generating…".
export const Generating = () => (
  <Frame>
    <Pane>
      <SteerInput
        steer={'Keep the framework chapter tight; emphasise the move from description to evaluation.'}
        status="generating"
        hasProposal={false}
        onSteerChange={noop}
        onGenerate={noop}
      />
    </Pane>
  </Frame>
);
