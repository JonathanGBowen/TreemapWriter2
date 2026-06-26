import type { ReactNode } from 'react';
import { ShapeCard } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// An Argument Shape — name + move-count/duration eyebrow, one-line description,
// and a phase strip whose blocks are weighted by relative effort and hued by move
// role (cyan frame · orange stress · yellow marshal · purple synthesize).

// Selected: cyan wash + lit name + cyan pip. The "Objection & Reply" shape.
export const Selected = () => (
  <Frame>
    <div className="max-w-[460px]">
      <ShapeCard
        selected
        onSelect={noop}
        shape={{
          id: 'objection-reply',
          name: 'Objection & Reply',
          description:
            'Steelman a challenge, locate the premise it hits, answer or concede-and-narrow, name what it costs you.',
          moves: [
            { title: 'Reinstate', role: 'reinstate', weight: 3, instructions: [] },
            { title: 'Steelman the objection', role: 'stress', weight: 8, instructions: [] },
            { title: 'Locate the premise', role: 'frame', weight: 6, instructions: [] },
            { title: 'Draft the reply', role: 'draft', weight: 12, instructions: [] },
            { title: 'Name the residue', role: 'synthesize', weight: 6, instructions: [] },
          ],
        }}
      />
    </div>
  </Frame>
);

// Unselected (idle pip, white name, hover border) — the "Analytic Argument" shape.
export const Unselected = () => (
  <Frame>
    <div className="max-w-[460px]">
      <ShapeCard
        selected={false}
        onSelect={noop}
        shape={{
          id: 'analytic-argument',
          name: 'Analytic Argument',
          description:
            'Frame the single claim, marshal considerations, draft one move per paragraph, stress-test, bridge.',
          moves: [
            { title: 'Reinstate', role: 'reinstate', weight: 3, instructions: [] },
            { title: 'Frame the claim', role: 'frame', weight: 5, instructions: [] },
            { title: 'Marshal', role: 'marshal', weight: 6, instructions: [] },
            { title: 'Draft the steps', role: 'draft', weight: 13, instructions: [] },
            { title: 'Stress-test', role: 'stress', weight: 7, instructions: [] },
            { title: 'Bridge', role: 'bridge', weight: 4, instructions: [] },
          ],
        }}
      />
    </div>
  </Frame>
);

// A stacked pair — the chooser as the writer sees it: one lit, one quiet.
export const Stack = () => (
  <Frame>
    <div className="max-w-[460px] flex flex-col">
      <ShapeCard
        selected
        onSelect={noop}
        shape={{
          id: 'literature-synthesis',
          name: 'Literature Synthesis',
          description:
            "Name the camps, one sentence per source's core move, find the axis they disagree on, position yourself.",
          moves: [
            { title: 'Reinstate', role: 'reinstate', weight: 3, instructions: [] },
            { title: 'Name the camps', role: 'marshal', weight: 6, instructions: [] },
            { title: 'Core moves', role: 'draft', weight: 10, instructions: [] },
            { title: 'Find the axis', role: 'frame', weight: 6, instructions: [] },
            { title: 'Position yourself', role: 'synthesize', weight: 6, instructions: [] },
          ],
        }}
      />
      <ShapeCard
        selected={false}
        onSelect={noop}
        shape={{
          id: 'conceptual-distinction',
          name: 'Conceptual Distinction',
          description:
            'Name the conflation, draw the line, test it against a hard case, state what now follows.',
          moves: [
            { title: 'Reinstate', role: 'reinstate', weight: 3, instructions: [] },
            { title: 'Name the conflation', role: 'stress', weight: 7, instructions: [] },
            { title: 'Draw the line', role: 'draft', weight: 9, instructions: [] },
            { title: 'Hard case + upshot', role: 'stress', weight: 6, instructions: [] },
          ],
        }}
      />
    </div>
  </Frame>
);
