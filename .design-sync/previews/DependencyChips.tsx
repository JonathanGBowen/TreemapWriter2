import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { DependencyChips } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// DependencyChips wraps its whole body in a Disclosure that is closed at rest, so
// a plain static shot would show only the collapsed header. For the preview card
// we open it on mount (the preview drives the real component — no source change).
const OpenOnMount = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
  }, []);
  return <div ref={ref}>{children}</div>;
};

const flatSections = [
  { id: 'a', title: 'Methodological Preliminaries', level: 1 },
  { id: 'b', title: 'The Knowledge Argument', level: 1 },
  { id: 'c', title: 'Mary the Color Scientist', level: 2 },
  { id: 'd', title: 'The Ability Hypothesis', level: 2 },
  { id: 'e', title: 'Phenomenal Concepts', level: 1 },
] as never;

const noop = () => {};

// A diagnosed mix: prerequisites that pass (green pip, lit border) and one still
// unmet (idle pip, muted) — the at-a-glance "is my ground laid?" read, plus + Add.
export const MetAndUnmet = () => (
  <Frame>
    <div className="max-w-[400px] bg-hld-surface border border-hld-border px-[14px] py-[10px]">
      <OpenOnMount>
        <DependencyChips
          sectionId="d"
          dependencies={[
            { id: 'a', type: 'prerequisite' },
            { id: 'b', type: 'prerequisite' },
            { id: 'c', type: 'reference' },
          ]}
          flatSections={flatSections}
          testSuite={{
            a: { status: 'success' },
            b: { status: 'success' },
            c: { status: 'fail' },
          } as never}
          onUpdate={noop}
        />
      </OpenOnMount>
    </div>
  </Frame>
);

// All dependencies satisfied — every chip green, "3 met / 3". The "ready to build on" state.
export const AllMet = () => (
  <Frame>
    <div className="max-w-[400px] bg-hld-surface border border-hld-border px-[14px] py-[10px]">
      <OpenOnMount>
        <DependencyChips
          sectionId="e"
          dependencies={[
            { id: 'a', type: 'prerequisite' },
            { id: 'b', type: 'prerequisite' },
            { id: 'd', type: 'reference' },
          ]}
          flatSections={flatSections}
          testSuite={{
            a: { status: 'success' },
            b: { status: 'success' },
            d: { status: 'success' },
          } as never}
          onUpdate={noop}
        />
      </OpenOnMount>
    </div>
  </Frame>
);
