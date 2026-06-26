import type { ReactNode } from 'react';
import { EmptyState } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// EmptyState fills its parent (flex-1, centers itself) — give it a fixed-height
// panel column to center within.
const Panel = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[320px] h-[320px] flex flex-col bg-hld-surface border border-hld-border">
    {children}
  </div>
);

const noop = () => {};

// The no-spec default: hollow diamond, the prompt copy, the lit GENERATE SPEC
// bracket-button, and the quiet "write it manually" escape hatch.
export const NoSpec = () => (
  <Frame>
    <Panel>
      <EmptyState goals="" onGoalsChange={noop} onGenerate={noop} />
    </Panel>
  </Frame>
);

// Manual mode — goals present, so the legacy goals textarea is revealed inline
// in place of the "write it manually" link.
export const ManualGoals = () => (
  <Frame>
    <Panel>
      <EmptyState
        goals="Motivate the explanatory gap, then argue that no functional story closes it."
        onGoalsChange={noop}
        onGenerate={noop}
      />
    </Panel>
  </Frame>
);
