import type { ReactNode } from 'react';
import { StructuredJsonEditor } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

const noop = () => {};

// The inline tree editor for a project spec: nested object with strings, a
// boolean, a number, and an array. Keys in cyan, strings in emerald, numbers
// in purple, the boolean as a select — every leaf is directly editable.
export const ProjectSpec = () => (
  <Frame>
    <StructuredJsonEditor
      data={{
        projectName: 'On the Weight of Arguments',
        testSuite: 'thesis-coherence',
        promptsConfig: {
          advisor: 'Challenge every unsupported claim.',
          temperature: 0.4,
          streaming: true,
        },
        customPersonas: ['Skeptic', 'Editor', 'Reader'],
      }}
      onChange={noop}
    />
  </Frame>
);

// A single section spec — finer leaves: level, status, and a short claim. Shows
// the same editor at the granularity it sees inside the section tab.
export const SectionSpec = () => (
  <Frame>
    <StructuredJsonEditor
      data={{
        id: 'sec-03',
        title: 'The Treemap Is the Document',
        level: 2,
        finished: false,
        claim: 'Area encodes argumentative weight; hue encodes finish.',
      }}
      onChange={noop}
    />
  </Frame>
);
