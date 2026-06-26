import type { ReactNode } from 'react';
import { SprintStepRow } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// One row of the plan editor: chevron, a role-hued diamond, the (inline-editable)
// title, its minute count, and the reorder / break-down / remove controls. The
// reinstate opener renders locked; ordinary moves render with the full toolbar.

const baseHandlers = {
  onEditTitle: noop,
  onEditInstructions: noop,
  onBreakDown: noop,
  onMoveUp: noop,
  onMoveDown: noop,
  onRemove: noop,
};

// The locked reinstate opener (no edits, no reorder, no removal) above an
// ordinary editable draft move — the editor's two row archetypes, stacked.
export const PlanRows = () => (
  <Frame>
    <div className="max-w-[460px] border border-hld-border bg-hld-surface">
      <SprintStepRow
        {...baseHandlers}
        isReinstate
        busy={false}
        canRemove={false}
        disableUp
        disableDown={false}
        move={{
          id: 'reinstate-0',
          title: 'Reinstate',
          role: 'reinstate',
          durationSec: 120,
          instructions: [
            'Reread the section goal + your last sentence.',
            'State in one line where you are.',
            'Skim the reattached fragments.',
          ],
        }}
      />
      <SprintStepRow
        {...baseHandlers}
        isReinstate={false}
        busy={false}
        canRemove
        disableUp={false}
        disableDown={false}
        move={{
          id: 'objection-reply-m1',
          title: 'Draft the reply',
          role: 'draft',
          durationSec: 720,
          instructions: ['Answer it, or concede-and-narrow.', 'One move per paragraph.'],
        }}
      />
    </div>
  </Frame>
);

// A single editable stress-test move with the break-down spinner running
// (busy = the recursive "decompose this step" call is in flight).
export const BreakingDown = () => (
  <Frame>
    <div className="max-w-[460px] border border-hld-border bg-hld-surface">
      <SprintStepRow
        {...baseHandlers}
        isReinstate={false}
        busy
        canRemove
        disableUp={false}
        disableDown
        move={{
          id: 'analytic-argument-m4',
          title: 'Stress-test the claim',
          role: 'stress',
          durationSec: 420,
          instructions: [
            'Write the strongest objection.',
            'Answer it in two sentences, or concede and narrow.',
          ],
        }}
      />
    </div>
  </Frame>
);
