import type { ReactNode } from 'react';
import { BulletCell } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// A reverse-outline column header + a stacked cell, to read as a real column.
const Column = ({ accent, title, children }: { accent: string; title: string; children: ReactNode }) => (
  <div className="max-w-[340px] border border-hld-border bg-hld-surface">
    <div className={`px-3.5 py-2 border-b border-hld-border font-mono uppercase tracking-[0.14em] text-[9px] bg-hld-surface2 ${accent}`}>
      {title}
    </div>
    <div className="flex">{children}</div>
  </div>
);

// The faithful-distillation column (outlineA, accent "a"). Editable prose cell —
// one sentence that restates the original paragraph for fidelity-checking.
export const FaithfulOutline = () => (
  <Frame>
    <Column accent="text-hld-cyan" title="Reverse outline">
      <BulletCell
        value="The treemap is the document re-projected: area is argument-weight, hue is how finished it reads."
        editable
        accent="a"
        placeholder="distill this paragraph…"
        onChange={noop}
        onBlur={noop}
      />
    </Column>
  </Frame>
);

// The target column (outlineB, accent "b"). An edited row tints green and carries
// the insert/delete affordances on its lower-right corner.
export const TargetEdited = () => (
  <Frame>
    <Column accent="text-hld-green" title="Your outline">
      <BulletCell
        value="State the claim directly in the first sentence, then give the area-as-weight mapping."
        editable
        accent="b"
        status="edited"
        placeholder="state what this paragraph should say…"
        onChange={noop}
        onInsert={noop}
        onDelete={noop}
      />
    </Column>
  </Frame>
);

// A non-prose block (heading/list) is its own distillation — shown read-only in
// muted italic, never editable.
export const ReadOnlyBlock = () => (
  <Frame>
    <Column accent="text-hld-cyan" title="Reverse outline">
      <BulletCell
        value="## 3 · Projection, not decoration"
        editable={false}
        accent="a"
      />
    </Column>
  </Frame>
);
