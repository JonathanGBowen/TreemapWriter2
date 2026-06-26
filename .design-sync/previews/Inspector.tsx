import type { ReactNode } from 'react';
import { Inspector } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// Inspector is the right rail: a fixed 348px aside that fills its parent's
// height. Stage it in a sized dark panel so it reads as the modal's side rail.
const Stage = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-hld-surface border border-hld-border flex overflow-hidden"
    style={{ width: 348, height: 620 }}
  >
    {children}
  </div>
);

const noop = () => {};

// ── A real argument topology, built to the shape deriveTopo emits ──────
// Two Parts (continents / metro lines) of sections; cyan dependency arcs; one
// broken link (source still a draft) so the inspector's warning states show.
const PART_HUES = ['#6ea8ff', '#00e870'];
type St = {
  id: string; partId: string; sym: string; short: string; title: string; words: number;
  fn: string | null; status: string; readiness: string | null; fog: boolean;
  labelDir: 'left' | 'right'; level: number; docIndex: number;
};
type Ar = { id: string; source: string; target: string; type: 'prerequisite' | 'reference' };
type Bd = { claim: string | null; readiness: string | null; next: string | null; coherence: string | null };

const stationData: St[] = [
  { id: 'intro', partId: 'intro', sym: '§0', short: 'Introduction', title: 'Introduction', words: 50, fn: 'introduce', status: 'success', readiness: 'solid', fog: false, labelDir: 'left', level: 1, docIndex: 0 },
  { id: 'intro-problem', partId: 'intro', sym: '§0.1', short: 'The Two-World Problem', title: 'The Two-World Problem', words: 820, fn: 'explicate', status: 'success', readiness: 'nearly-there', fog: false, labelDir: 'left', level: 2, docIndex: 1 },
  { id: 'theory', partId: 'theory', sym: '§1', short: 'The Framework', title: 'The Framework', words: 60, fn: 'introduce', status: 'success', readiness: 'developing', fog: false, labelDir: 'right', level: 1, docIndex: 2 },
  { id: 'theory-manifest', partId: 'theory', sym: '§1.1', short: 'The Manifest Image', title: 'The Manifest Image', words: 1180, fn: 'argue', status: 'success', readiness: 'solid', fog: false, labelDir: 'right', level: 2, docIndex: 3 },
  { id: 'theory-fusion', partId: 'theory', sym: '§1.2', short: 'Stereoscopic Fusion', title: 'Stereoscopic Fusion', words: 320, fn: 'synthesize', status: 'idle', readiness: 'draft', fog: true, labelDir: 'right', level: 2, docIndex: 4 },
];

const arcData: Ar[] = [
  { id: 'intro-problem->theory-manifest', source: 'intro-problem', target: 'theory-manifest', type: 'prerequisite' },
  { id: 'theory-fusion->theory-manifest', source: 'theory-fusion', target: 'theory-manifest', type: 'prerequisite' },
  { id: 'intro->intro-problem', source: 'intro', target: 'intro-problem', type: 'reference' },
];

const boardData: Record<string, Bd> = {
  'theory-manifest': {
    claim: 'The manifest image is not a folk error to be eliminated but a standing achievement the scientific image must answer to.',
    readiness: 'solid',
    next: 'Tighten the transition from §1.1 into Stereoscopic Fusion — the bridge currently asserts the fusion rather than earning it.',
    coherence: 'Reads cleanly against the intro; one citation (§0.1) is load-bearing and well-placed.',
  },
};

type Model = {
  stations: St[]; stationById: Record<string, St>;
  lines: { id: string; label: string; sub: string; num: string; color: string; stationIds: string[] }[];
  arcs: Ar[]; interchange: Set<string>;
  inbound: (id: string) => Ar[]; outbound: (id: string) => Ar[];
  health: (a: Ar) => 'solid' | 'weak' | 'broken'; board: (id: string) => Bd;
};

function buildModel(): Model {
  const stationById: Record<string, St> = {};
  stationData.forEach((s) => (stationById[s.id] = s));
  const lineIds = [...new Set(stationData.map((s) => s.partId))];
  const lines = lineIds.map((pid, i) => {
    const root = stationById[pid];
    return {
      id: pid, label: root.title.toUpperCase(), sub: root.title.toLowerCase(),
      num: String(i), color: PART_HUES[i % PART_HUES.length],
      stationIds: stationData.filter((s) => s.partId === pid).map((s) => s.id),
    };
  });
  const inboundMap: Record<string, Ar[]> = {};
  const outboundMap: Record<string, Ar[]> = {};
  const interchange = new Set<string>();
  arcData.forEach((a) => {
    (inboundMap[a.target] ||= []).push(a);
    (outboundMap[a.source] ||= []).push(a);
    interchange.add(a.source);
    interchange.add(a.target);
  });
  const health = (a: Ar): 'solid' | 'weak' | 'broken' => {
    const src = stationById[a.source];
    if (!src) return 'solid';
    if (src.status === 'fail' || src.readiness === 'draft') return 'broken';
    if (src.status === 'stale') return 'weak';
    return 'solid';
  };
  const board = (id: string): Bd =>
    boardData[id] ?? { claim: null, readiness: null, next: null, coherence: null };
  return {
    stations: stationData, stationById, lines, arcs: arcData, interchange,
    inbound: (id) => inboundMap[id] ?? [], outbound: (id) => outboundMap[id] ?? [],
    health, board,
  };
}

const model = buildModel() as never;

// Station selected — the full board: claim, depends-on / feeds dependency lists
// (with a broken link), the readiness ladder, and the next-move card.
export const StationBoard = () => (
  <Frame>
    <Stage>
      <Inspector
        model={model}
        station={stationById('theory-manifest')}
        arc={null}
        editorId="theory-manifest"
        linkMode={false}
        setLinkMode={noop}
        onOpen={noop}
        onSelectStation={noop}
        onToggleDep={noop}
        onRemoveDep={noop}
      />
    </Stage>
  </Frame>
);

// Dependency arc selected — the arc editor: the source → target chips, the
// broken-link warning, and the toggle/remove controls.
export const ArcEditor = () => (
  <Frame>
    <Stage>
      <Inspector
        model={model}
        station={null}
        arc={arcById('theory-fusion->theory-manifest')}
        editorId={null}
        linkMode={false}
        setLinkMode={noop}
        onOpen={noop}
        onSelectStation={noop}
        onToggleDep={noop}
        onRemoveDep={noop}
      />
    </Stage>
  </Frame>
);

// Nothing selected — the "reading the map" guide state.
export const Guide = () => (
  <Frame>
    <Stage>
      <Inspector
        model={model}
        station={null}
        arc={null}
        editorId={null}
        linkMode={false}
        setLinkMode={noop}
        onOpen={noop}
        onSelectStation={noop}
        onToggleDep={noop}
        onRemoveDep={noop}
      />
    </Stage>
  </Frame>
);

function stationById(id: string): never {
  return stationData.find((s) => s.id === id) as never;
}
function arcById(id: string): never {
  return arcData.find((a) => a.id === id) as never;
}
