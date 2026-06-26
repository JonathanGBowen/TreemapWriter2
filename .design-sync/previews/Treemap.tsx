import type { ReactNode } from 'react';
import { Treemap } from 'treemap-writer';
import type { Section, TestSuite } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// Treemap sizes to its container (w-full h-full) — without a fixed-size box it
// collapses. This is the app's namesake plotly view, the document re-projected
// as area-weighted, status-coloured tiles.
const Stage = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-hld-bgDeep border border-hld-border overflow-hidden"
    style={{ width: 560, height: 380 }}
  >
    {children}
  </div>
);

const noop = () => {};

// A small section helper — only the fields flattenTree/Treemap read need to be
// real; the rest are cast away so the data stays legible.
type Node = { id: string; title: string; wordCount: number; children?: Node[] };
const sec = (n: Node): Section =>
  ({
    id: n.id,
    title: n.title,
    level: 1,
    content: '',
    fullContent: '',
    startLine: 0,
    endLine: 0,
    startOffset: 0,
    wordCount: n.wordCount,
    parentId: null,
    children: (n.children ?? []).map(sec),
  }) as Section;

// A real dissertation outline — three Parts, each with subsections sized by word
// count. Area is the weight of the argument; hue is how finished it reads. Each
// Part's wordCount is the sum of its subsections' (plotly treemap uses
// branchvalues:"total", so a parent must total its children or the branch blanks).
const sections: Section[] = [
  sec({
    id: 'intro',
    title: 'Introduction',
    wordCount: 1360,
    children: [
      { id: 'intro-problem', title: 'The Two-World Problem', wordCount: 820 },
      { id: 'intro-thesis', title: 'Thesis & Roadmap', wordCount: 540 },
    ],
  }),
  sec({
    id: 'theory',
    title: 'The Framework',
    wordCount: 2790,
    children: [
      { id: 'theory-manifest', title: 'The Manifest Image', wordCount: 1180 },
      { id: 'theory-scientific', title: 'The Scientific Image', wordCount: 970 },
      { id: 'theory-fusion', title: 'Stereoscopic Fusion', wordCount: 640 },
    ],
  }),
  sec({
    id: 'application',
    title: 'Application',
    wordCount: 1470,
    children: [
      { id: 'app-case', title: 'A Worked Case', wordCount: 760 },
      { id: 'app-objections', title: 'Objections & Replies', wordCount: 430 },
      { id: 'app-conclusion', title: 'Conclusion', wordCount: 280 },
    ],
  }),
];

// Status + readiness drive the tile colour & border weight: solid (green),
// nearly-there (cyan), developing (yellow), draft (faint magenta), fail
// (magenta), running (purple), and blocked-by-dependency (slate).
const diag = (overallReadiness: string) =>
  ({ moveResults: [], coherenceNotes: [], overallReadiness, nextPriority: '' }) as never;

const testSuite: TestSuite = {
  'intro-problem': { goals: '', status: 'success', lastDiagnostic: diag('solid') } as never,
  'intro-thesis': { goals: '', status: 'success', lastDiagnostic: diag('nearly-there') } as never,
  'theory-manifest': { goals: '', status: 'success', lastDiagnostic: diag('solid') } as never,
  'theory-scientific': { goals: '', status: 'success', lastDiagnostic: diag('developing') } as never,
  'theory-fusion': { goals: '', status: 'fail' } as never,
  'app-case': { goals: '', status: 'running' } as never,
  'app-objections': { goals: '', status: 'success', lastDiagnostic: diag('draft') } as never,
  'app-conclusion': { goals: '', status: 'stale' } as never,
};

// The full status vocabulary, nothing selected — every readiness hue at once.
export const DocumentMap = () => (
  <Frame>
    <Stage>
      <Treemap
        sections={sections}
        onSelect={noop}
        selectedId=""
        hiddenSectionIds={[]}
        testSuite={testSuite}
      />
    </Stage>
  </Frame>
);

// Focus mode — one tile selected (cyan ring); the rest recede but stay legible.
export const FocusMode = () => (
  <Frame>
    <Stage>
      <Treemap
        sections={sections}
        onSelect={noop}
        selectedId="theory-manifest"
        hiddenSectionIds={[]}
        testSuite={testSuite}
      />
    </Stage>
  </Frame>
);
