import type { ReactNode } from 'react';
import { SectionRow } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// Minimal section shape — only the fields SectionRow reads.
const sec = (id: string, title: string, level: number, wordCount: number) =>
  ({ id, title, level, wordCount } as never);

// The full status vocabulary, one row each: green = passing, magenta = failing,
// yellow = stale, cyan = running (pulses), dim = idle/untested.
export const StatusVocabulary = () => (
  <Frame>
    <div className="max-w-[320px] bg-hld-surface border border-hld-border py-[4px]">
      <SectionRow section={sec('s1', 'The Hard Problem of Consciousness', 1, 642)} selected={false} status="success" onSelect={() => {}} />
      <SectionRow section={sec('s2', 'Against Type-Identity Theory', 1, 318)} selected={false} status="fail" onSelect={() => {}} />
      <SectionRow section={sec('s3', 'Qualia and the Knowledge Argument', 1, 1204)} selected={false} status="stale" onSelect={() => {}} />
      <SectionRow section={sec('s4', 'Functionalist Rejoinders', 1, 540)} selected={false} status="running" onSelect={() => {}} />
      <SectionRow section={sec('s5', 'Methodological Preliminaries', 1, 0)} selected={false} status="idle" onSelect={() => {}} />
    </div>
  </Frame>
);

// Selected row — cyan rail + bold cyan title — over a nested tree showing the
// level indent. The active section is the focus of the writing surface.
export const SelectedAndNested = () => (
  <Frame>
    <div className="max-w-[320px] bg-hld-surface border border-hld-border py-[4px]">
      <SectionRow section={sec('p1', 'Part II · Phenomenal Concepts', 1, 2890)} selected={false} status="success" onSelect={() => {}} />
      <SectionRow section={sec('c1', 'The Phenomenal Concept Strategy', 2, 1130)} selected={true} status="success" onSelect={() => {}} />
      <SectionRow section={sec('c2', 'Conceptual Isolation', 3, 470)} selected={false} status="stale" onSelect={() => {}} />
      <SectionRow section={sec('c3', 'The Master Argument, Restated', 3, 96)} selected={false} status="fail" onSelect={() => {}} />
    </div>
  </Frame>
);
