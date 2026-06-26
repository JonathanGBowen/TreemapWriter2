import type { ReactNode } from 'react';
import { TopoLand } from 'treemap-writer';

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="bg-hld-bg text-hld-text font-sans" style={{ margin: -24, padding: 24 }}>
    {children}
  </div>
);

// TopoLand is position:absolute/inset:0 over the sea canvas — stage it in a
// sized relative parent. The atlas projection merges same-Part sections into
// continents (metaball "goo"), with cyan dependency routes between them.
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
// Three Parts → three continents; land area ∝ √words; one section is fog
// (unwritten draft). Dependencies are the transit routes; one is broken.
const PART_HUES = ['#6ea8ff', '#00e870', '#ffd060'];
type St = {
  id: string; partId: string; sym: string; short: string; title: string; words: number;
  fn: string | null; status: string; readiness: string | null; fog: boolean;
  labelDir: 'left' | 'right'; level: number; docIndex: number;
};
type Ar = { id: string; source: string; target: string; type: 'prerequisite' | 'reference' };

const S = (
  id: string, partId: string, sym: string, title: string, words: number,
  status: string, readiness: string | null, i: number,
): St => ({
  id, partId, sym, short: title, title, words, fn: null, status, readiness,
  fog: status === 'idle' || readiness === 'draft', labelDir: 'right',
  level: sym.includes('.') ? 2 : 1, docIndex: i,
});

const stationData: St[] = [
  S('intro', 'intro', '§0', 'Introduction', 50, 'success', 'solid', 0),
  S('intro-problem', 'intro', '§0.1', 'The Two-World Problem', 820, 'success', 'nearly-there', 1),
  S('intro-thesis', 'intro', '§0.2', 'Thesis & Roadmap', 540, 'success', 'developing', 2),
  S('theory', 'theory', '§1', 'The Framework', 60, 'success', 'developing', 3),
  S('theory-manifest', 'theory', '§1.1', 'The Manifest Image', 1180, 'success', 'solid', 4),
  S('theory-fusion', 'theory', '§1.2', 'Stereoscopic Fusion', 320, 'idle', 'draft', 5),
  S('app', 'app', '§2', 'Application', 40, 'success', 'developing', 6),
  S('app-case', 'app', '§2.1', 'A Worked Case', 760, 'stale', null, 7),
  S('app-conclusion', 'app', '§2.2', 'Conclusion', 280, 'success', 'nearly-there', 8),
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

// The atlas projection — three continents merged from same-Part sections, with
// continent labels and the cyan dependency routes (one broken) between them.
export const Atlas = () => (
  <Frame>
    <Stage>
      <TopoLand
        model={model}
        selectedId={null}
        hoveredId={null}
        editorId="theory-manifest"
        filter={null}
        selectedDepId={null}
        organizeNonce={0}
        reduced
        onSelect={noop}
        onSelectDep={noop}
        onHover={noop}
        onOpen={noop}
        onMetrics={noop}
        onOptRun={noop}
      />
    </Stage>
  </Frame>
);

// A province selected — its label/stat readout shows, the other continents
// dim, and the route feeding the selection stays lit.
export const Selected = () => (
  <Frame>
    <Stage>
      <TopoLand
        model={model}
        selectedId="theory-manifest"
        hoveredId={null}
        editorId="theory-manifest"
        filter="theory"
        selectedDepId="intro-problem->theory-manifest"
        organizeNonce={0}
        reduced
        onSelect={noop}
        onSelectDep={noop}
        onHover={noop}
        onOpen={noop}
        onMetrics={noop}
        onOptRun={noop}
      />
    </Stage>
  </Frame>
);
