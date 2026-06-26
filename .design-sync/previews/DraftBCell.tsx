import type { ReactNode } from 'react';
import { DraftBCell } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

const Column = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[340px] border border-hld-border bg-hld-surface">
    <div className="px-5 py-2 border-b border-hld-border font-mono uppercase tracking-[0.14em] text-[9px] bg-hld-surface2 text-hld-green">
      New draft
    </div>
    <div className="flex">{children}</div>
  </div>
);

// A row's working state. Only the fields DraftBCell reads need be real.
const row = (over: Record<string, unknown>) => ({
  id: 'row_1',
  kind: 'prose',
  draftA: 'The treemap is not a chart bolted onto a document; it is the document, re-projected.',
  outlineA: '',
  outlineB: '',
  draftB: null,
  anchor: '',
  ...over,
}) as never;

// Column 4 — a regenerated proposal (green), with Accept / reset controls.
export const Proposal = () => (
  <Frame>
    <Column>
      <DraftBCell
        row={row({
          status: 'regenerated',
          draftB:
            'The treemap is the document re-projected: each node a section, its area the weight of the argument it carries.',
        })}
        regenerating={false}
        onAccept={noop}
        onReset={noop}
      />
    </Column>
  </Frame>
);

// The applied state — the rewrite has been written through to the document and
// recedes with a green "applied" stamp.
export const Applied = () => (
  <Frame>
    <Column>
      <DraftBCell
        row={row({
          status: 'accepted',
          draftB: 'The treemap is the document re-projected — area is argument-weight, hue is finish.',
        })}
        regenerating={false}
        onAccept={noop}
        onReset={noop}
      />
    </Column>
  </Frame>
);

// A deletion proposal — the struck original in magenta, with Apply deletion / reset.
export const Deletion = () => (
  <Frame>
    <Column>
      <DraftBCell
        row={row({ status: 'deleted', draftB: '' })}
        regenerating={false}
        onAccept={noop}
        onReset={noop}
      />
    </Column>
  </Frame>
);

// The in-flight spinner while the AI regenerates this one paragraph.
export const Regenerating = () => (
  <Frame>
    <Column>
      <DraftBCell row={row({ status: 'edited' })} regenerating onAccept={noop} onReset={noop} />
    </Column>
  </Frame>
);
