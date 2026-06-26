import type { ReactNode } from 'react';
import { SprintSequenceRail } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// The runner's "where am I in the arc" rail: green check for done moves, a pulsing
// cyan pip for the current one, hollow idle pips for what's next — each with its
// mono minute count. It is `h-full` + `border-l`, so it gets a sized stage.

const MOVES = [
  { id: 'm-reinstate', title: 'Reinstate', role: 'reinstate' as const, instructions: [], durationSec: 120 },
  { id: 'm-frame', title: 'Frame the claim', role: 'frame' as const, instructions: [], durationSec: 300 },
  { id: 'm-marshal', title: 'Marshal considerations', role: 'marshal' as const, instructions: [], durationSec: 360 },
  { id: 'm-draft', title: 'Draft the steps', role: 'draft' as const, instructions: [], durationSec: 780 },
  { id: 'm-stress', title: 'Stress-test', role: 'stress' as const, instructions: [], durationSec: 420 },
  { id: 'm-bridge', title: 'Bridge to next section', role: 'bridge' as const, instructions: [], durationSec: 240 },
];

const Stage = ({ children }: { children: ReactNode }) => (
  <div className="relative h-[320px] w-[260px] bg-hld-surface">{children}</div>
);

// Mid-sprint: first two moves done, drafting now, three ahead.
export const Drafting = () => (
  <Frame>
    <Stage>
      <SprintSequenceRail moves={MOVES} currentIndex={3} />
    </Stage>
  </Frame>
);

// Fresh start — sitting on the reinstate opener, everything ahead.
export const JustStarted = () => (
  <Frame>
    <Stage>
      <SprintSequenceRail moves={MOVES} currentIndex={0} />
    </Stage>
  </Frame>
);

// Final stretch — only the bridge remains, the rest checked green.
export const NearlyDone = () => (
  <Frame>
    <Stage>
      <SprintSequenceRail moves={MOVES} currentIndex={5} />
    </Stage>
  </Frame>
);
