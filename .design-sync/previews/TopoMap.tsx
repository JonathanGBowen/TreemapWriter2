import type { ReactNode } from 'react';
import { TopoMap } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// TopoMap is position:absolute/inset:0 over a dark canvas — stage it in a sized
// relative parent standing in for the map surface.
const Stage = ({ children }: { children: ReactNode }) => (
  <div
    className="relative bg-hld-bgDeep border border-hld-border overflow-hidden"
    style={{ width: 640, height: 460 }}
  >
    {children}
  </div>
);

const noop = () => {};

// ── A real argument topology, in the shape deriveTopo emits ────────────
// Three Parts (metro lines), stations stacked in reading order; cyan dependency
// arcs cross between them, one broken (its source is still a draft → magenta ✕).
const PART_HUES = ['#6ea8ff', '#00e870', '#ffd060'];
type St = {
  id: string; partId: string; sym: string; short: string; title: string; words: number;
  fn: string | null; status: string; readiness: string | null; fog: boolean;
  labelDir: 'left' | 'right'; level: number; docIndex: number;
};
type Ar = { id: string; source: string; target: string; type: 'prerequisite' | 'reference' };

const S = (
  id: string, partId: string, sym: string, title: string, words: number,
  status: string, readiness: string | null, labelDir: 'left' | 'right', i: number,
): St => ({
  id, partId, sym, short: title, title, words, fn: null, status, readiness,
  fog: status === 'idle' || readiness === 'draft', labelDir, level: sym.includes('.') ? 2 : 1, docIndex: i,
});

const stationData: St[] = [
  S('intro', 'intro', '§0', 'Introduction', 50, 'success', 'solid', 'left', 0),
  S('intro-problem', 'intro', '§0.1', 'The Two-World Problem', 820, 'success', 'nearly-there', 'left', 1),
  S('intro-thesis', 'intro', '§0.2', 'Thesis & Roadmap', 540, 'success', 'developing', 'left', 2),
  S('theory', 'theory', '§1', 'The Framework', 60, 'success', 'developing', 'right', 3),
  S('theory-manifest', 'theory', '§1.1', 'The Manifest Image', 1180, 'success', 'solid', 'right', 4),
  S('theory-fusion', 'theory', '§1.2', 'Stereoscopic Fusion', 320, 'idle', 'draft', 'right', 5),
  S('app', 'app', '§2', 'Application', 40, 'success', 'developing', 'right', 6),
  S('app-case', 'app', '§2.1', 'A Worked Case', 760, 'stale', null, 'right', 7),
  S('app-conclusion', 'app', '§2.2', 'Conclusion', 280, 'success', 'nearly-there', 'right', 8),
];

const arcData: Ar[] = [
  { id: 'intro-problem->theory-manifest', source: 'intro-problem', target: 'theory-manifest', type: 'prerequisite' },
  { id: 'theory-manifest->app-case', source: 'theory-manifest', target: 'app-case', type: 'prerequisite' },
  { id: 'theory-fusion->app-conclusion', source: 'theory-fusion', target: 'app-conclusion', type: 'prerequisite' },
  { id: 'intro-thesis->app-conclusion', source: 'intro-thesis', target: 'app-conclusion', type: 'reference' },
  { id: 'app-case->app-conclusion', source: 'app-case', target: 'app-conclusion', type: 'prerequisite' },
];

function buildModel() {
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
  return {
    stations: stationData, stationById, lines, arcs: arcData, interchange,
    inbound: (id: string) => inboundMap[id] ?? [],
    outbound: (id: string) => outboundMap[id] ?? [],
    health,
    board: (id: string) => ({ claim: null, readiness: stationById[id]?.readiness ?? null, next: null, coherence: null }),
  };
}

const model = buildModel() as never;

// The spine projection — Part lines, directed cyan dependency arcs, stations
// with status pips, and a "YOU ARE HERE" marker on the open section.
export const Spine = () => (
  <Frame>
    <Stage>
      <TopoMap
        model={model}
        selectedId={null}
        hoveredId={null}
        editorId="theory-manifest"
        filter={null}
        selectedDepId={null}
        fitNonce={1}
        showGhost={false}
        reduced
        onSelect={noop}
        onSelectDep={noop}
        onHover={noop}
        onOpen={noop}
      />
    </Stage>
  </Frame>
);

// A station selected — its Part stays lit while the others dim, and only the
// arcs touching the selection remain at full strength.
export const Selected = () => (
  <Frame>
    <Stage>
      <TopoMap
        model={model}
        selectedId="app-conclusion"
        hoveredId={null}
        editorId="theory-manifest"
        filter={null}
        selectedDepId="theory-fusion->app-conclusion"
        fitNonce={2}
        showGhost
        reduced
        onSelect={noop}
        onSelectDep={noop}
        onHover={noop}
        onOpen={noop}
      />
    </Stage>
  </Frame>
);
