import type { ReactNode } from 'react';
import { Zone } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// The eyebrow + hairline rule that titles a section — never a box. Three zones
// stacked, each capping a short block of content below it.
export const Sections = () => (
  <Frame>
    <div className="max-w-[420px] flex flex-col gap-5">
      <div>
        <Zone label="Document" meta="12 sections" />
        <p className="mt-2 text-[13px] leading-relaxed text-hld-text">
          The treemap is not a chart bolted onto a document — it is the document,
          re-projected.
        </p>
      </div>
      <div>
        <Zone label="Reverse outline" meta="8 bullets" />
        <p className="mt-2 text-[13px] leading-relaxed text-hld-muted-text">
          Every node is a section; its area is the weight of the argument it carries.
        </p>
      </div>
    </div>
  </Frame>
);

// meta-only and label-only variants — the rule still organizes the surface when
// one side is empty. The hairline always spans the gap.
export const Variants = () => (
  <Frame>
    <div className="max-w-[420px] flex flex-col gap-6">
      <Zone label="Evidence" />
      <Zone meta="last saved 14:02" />
      <Zone label="Objections" meta="2 unanswered" />
    </div>
  </Frame>
);

// `children` renders raw on the right — here a quiet function chip past the rule.
export const WithControl = () => (
  <Frame>
    <div className="max-w-[420px]">
      <Zone label="Regenerate">
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 border border-hld-border text-hld-cyan hover:bg-hld-cyan/10 transition-colors"
        >
          run pass
        </button>
      </Zone>
    </div>
  </Frame>
);
