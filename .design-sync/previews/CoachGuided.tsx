import type { ReactNode } from 'react';
import { CoachGuided } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// The guided coach (no AI): one prompt per screen. The yellow coach turn names
// the move, a dark textarea takes the answer, and the lit primary advances. WOOP
// walks wish → obstacle → if-then; plain is the wish alone. Static render of the
// opening (wish) screen.

// WOOP coach, first screen — shows the "1/3" step counter on the coach turn.
export const Woop = () => (
  <Frame>
    <div className="max-w-[460px]">
      <CoachGuided goalModel="woop" onReady={noop} />
    </div>
  </Frame>
);

// Plain coach — a single wish prompt, no step counter, with the hybrid
// "Talk it through first" escape hatch offered alongside the primary.
export const PlainWithEscape = () => (
  <Frame>
    <div className="max-w-[460px]">
      <CoachGuided
        goalModel="plain"
        onReady={noop}
        secondaryAction={{ label: 'Talk it through first', onClick: noop }}
      />
    </div>
  </Frame>
);
