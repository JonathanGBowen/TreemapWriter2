import type { ReactNode } from 'react';
import { Disclosure } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const Body = ({ children }: { children: ReactNode }) => (
  <p className="text-hld-text text-[13px] leading-relaxed">{children}</p>
);

// Text-heavy reading-index rows. One open (with a standing magenta pip + count),
// two collapsed — the canonical "objections / evidence" disclosure stack.
export const ReadingIndex = () => (
  <Frame>
    <div className="max-w-[440px]">
      <Disclosure label="Claim" count="3" pip="green" defaultOpen>
        <Body>
          The treemap is not a chart bolted onto a document — it is the document,
          re-projected. Every node is a section; its area is the weight of the
          argument it carries, and its hue is how finished that argument reads.
        </Body>
      </Disclosure>
      <Disclosure label="Objections" count="2" pip="magenta">
        <Body>Two unanswered counter-arguments remain in this branch.</Body>
      </Disclosure>
      <Disclosure label="Evidence" count="5" pip="cyan">
        <Body>Five supporting citations, collapsed.</Body>
      </Disclosure>
    </div>
  </Frame>
);

// Minimal single row, collapsed, no pip — the quiet default.
export const Plain = () => (
  <Frame>
    <div className="max-w-[440px]">
      <Disclosure label="Advanced options" count="4">
        <Body>Hidden until asked for.</Body>
      </Disclosure>
    </div>
  </Frame>
);
