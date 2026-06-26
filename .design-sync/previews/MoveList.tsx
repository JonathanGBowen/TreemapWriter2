import type { ReactNode } from 'react';
import { MoveList } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const spec = (moves: { id: string; description: string }[]) =>
  ({
    function: 'argue',
    mainClaim: 'Mental content is partly constituted by the external environment.',
    requiredMoves: moves,
    incomingContext: [],
    outgoingCommitments: [],
  } as never);

const noop = () => {};

// A diagnosed spec sweeping the full verdict vocabulary: present (green/done),
// partial (yellow), missing (magenta), unclear (purple). Off-verdict rows
// auto-expand to show WHERE / diagnosis / ACTION.
export const Diagnosed = () => (
  <Frame>
    <div className="max-w-[440px] bg-hld-surface border border-hld-border p-[16px]">
      <MoveList
        spec={spec([
          { id: 'm1', description: 'State the Twin Earth thought experiment and isolate the relevant intuition.' },
          { id: 'm2', description: 'Derive the anti-individualist conclusion about "water".' },
          { id: 'm3', description: 'Block the narrow-content reply by showing it cannot fix reference.' },
          { id: 'm4', description: 'Extend the argument from natural kinds to mental states generally.' },
        ])}
        diagnostic={{
          overallReadiness: 'developing',
          coherenceNotes: [],
          nextPriority: '',
          moveResults: [
            { moveId: 'm1', moveDescription: '', status: 'present', location: '¶1–2' },
            {
              moveId: 'm2',
              moveDescription: '',
              status: 'partial',
              location: '¶3',
              diagnosis: 'The conclusion is asserted but the inference from differing extensions is left implicit.',
              suggestedAction: 'Add a sentence making the extension-to-content step explicit.',
            },
            {
              moveId: 'm3',
              moveDescription: '',
              status: 'missing',
              location: 'should follow ¶3',
              diagnosis: 'The narrow-content reply is never raised, so the argument looks question-begging.',
              suggestedAction: 'Introduce the reply, then show narrow content underdetermines reference.',
            },
            {
              moveId: 'm4',
              moveDescription: '',
              status: 'unclear',
              diagnosis: 'It is ambiguous whether the generalization is claimed or merely gestured at.',
            },
          ],
        } as never}
        onEdit={noop}
        onAdd={noop}
        onRemove={noop}
        onRefine={noop}
      />
    </div>
  </Frame>
);

// Undiagnosed spec — idle pips, no verdict words, the "+ Move" affordance and
// the zone tally reading raw move count. The pre-diagnostic editing state.
export const Undiagnosed = () => (
  <Frame>
    <div className="max-w-[440px] bg-hld-surface border border-hld-border p-[16px]">
      <MoveList
        spec={spec([
          { id: 'm1', description: 'Distinguish semantic from epistemic notions of analyticity.' },
          { id: 'm2', description: 'Show that synonymy cannot be defined without circularity.' },
          { id: 'm3', description: 'Conclude that the analytic/synthetic distinction is untenable.' },
        ])}
        onEdit={noop}
        onAdd={noop}
        onRemove={noop}
        onRefine={noop}
      />
    </div>
  </Frame>
);
