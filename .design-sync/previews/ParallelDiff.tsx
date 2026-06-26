import type { ReactNode } from 'react';
import type { Change } from 'diff';
import { ParallelDiff } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// ParallelDiff is flex-1/min-h-0 and its body scrolls — give it a sized,
// bordered viewport standing in for the Version Compare pane.
const Pane = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-hld-surface border border-hld-border flex flex-col overflow-hidden"
    style={{ width: 560, height: 360 }}
  >
    {children}
  </div>
);

const part = (value: string, kind?: 'added' | 'removed'): Change =>
  ({ value, added: kind === 'added', removed: kind === 'removed' }) as Change;

// A realistic line-level diff of the thesis section between two saved drafts.
// Unchanged lines align across both columns; a removed run pairs row-for-row
// with the following added run (a replacement); leftover lines get a blank
// gutter on the other side.
const revisedThesis: Change[] = [
  part('## The Two-World Problem\n'),
  part('\n'),
  part(
    'Sellars argues that the manifest and scientific images cannot simply be\nlayered onto one another.\n',
    'removed',
  ),
  part(
    'Sellars argues that the manifest and scientific images stand in genuine\ntension — neither reducible to nor dispensable for the other.\n',
    'added',
  ),
  part('\n'),
  part('The task, then, is a stereoscopic fusion of the two.\n'),
  part('We adopt this framing throughout.\n', 'removed'),
];

// A pure addition: a new evidence paragraph appears only in draft B, so the
// left column shows blank green-tinted gutters beside it.
const addedEvidence: Change[] = [
  part('### Evidence\n'),
  part('\n'),
  part('The case rests on three converging lines of support.\n'),
  part(
    'First, the historical record of revisions to the manifest image.\nSecond, the explanatory indispensability of the scientific image.\nThird, the failure of every eliminativist reduction proposed to date.\n',
    'added',
  ),
];

// Replacement diff — A on the left (removals magenta), B on the right
// (additions green), unchanged text muted and aligned.
export const Replacement = () => (
  <Frame>
    <Pane>
      <ParallelDiff diff={revisedThesis} aLabel="Draft A · yesterday" bLabel="Current draft" />
    </Pane>
  </Frame>
);

// Pure addition — the left column holds blank gutters where draft B grows.
export const Addition = () => (
  <Frame>
    <Pane>
      <ParallelDiff diff={addedEvidence} aLabel="Pre-AI snapshot" bLabel="Current draft" />
    </Pane>
  </Frame>
);
