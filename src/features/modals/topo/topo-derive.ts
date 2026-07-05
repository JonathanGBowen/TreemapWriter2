/* eslint-disable no-restricted-syntax -- colours here feed the SVG/Plotly
   topology map (trace + presentation-attribute strings), where CSS `var()` does
   not resolve; they must be literal hex. Token-matching values are commented. */
/* topo-derive.ts — the data layer for the Argument Topology modal.

   Turns the real document model (Section[] tree + TestSuite) into the flat
   view model the two projections (ATLAS / SPINE) consume:

     Section            → Station   (a section; a "station"/"province")
     top-level Part      → Line      (a metro line / a continent)
     TestSuiteEntry      → status / claim / readiness / next / coherence
       .dependencies[]   → Arc       ({source, target, type})

   This is pure (no React). The modal memoizes deriveTopo on [sections, testSuite].

   Two reconciliations with the prototype's hand-authored data:
   • the real `status` union has no 'draft' — the prototype's 'draft' maps onto
     `lastDiagnostic.overallReadiness === 'draft'`.
   • the dependency layer colour (cyan) is reserved; Part hues never use it. */

import type {
  Section,
  TestSuite,
  TestSuiteEntry,
  Dependency,
  FunctionTag,
  SectionFunction,
  ReadinessLevel,
  StructuralEdgeKind,
} from '../../../types';

export type Status = TestSuiteEntry['status']; // 'idle'|'running'|'success'|'fail'|'stale'
export type DepType = Dependency['type']; // 'prerequisite'|'reference'
export type DepHealth = 'solid' | 'weak' | 'broken';
export type LabelDir = 'left' | 'right';

export interface Station {
  id: string; // = Section.id — stable across re-parses; the key for updateDependencies
  partId: string; // top-level ancestor id present in the flattened set
  sym: string; // "§0", "§0.1", "§2.1.1" — positional, derived (never a React key)
  short: string; // trimmed title for in-canvas labels
  title: string; // full Section.title
  words: number; // Section.wordCount
  fn: SectionFunction | null; // testSuite[id]?.spec?.function
  status: Status; // testSuite[id]?.status ?? 'idle'
  readiness: ReadinessLevel | null; // lastDiagnostic?.overallReadiness ?? null
  fog: boolean; // unbuilt: status==='idle' || readiness==='draft'
  labelDir: LabelDir; // SPINE label side (first column left, rest right)
  level: number; // Section.level
  docIndex: number; // global depth-first order
}

export interface Line {
  id: string; // = top-level Section.id
  label: string; // UPPERCASE Section.title
  sub: string; // lowercase preview of the title (chip tooltip)
  num: string; // "0".."N" top-level index
  color: string; // deterministic Part hue (never cyan)
  stationIds: string[]; // this Part's stations in document order
}

export interface Arc {
  id: string; // `${source}->${target}` (collision-free per target/source pair)
  source: string; // dep.id — the prerequisite/reference section
  target: string; // the section that OWNS the dependency entry (depends on source)
  type: DepType;
  // --- PARTS projection only (Phase 2). Section projections leave both unset. ---
  /** Membership arc (part→section): the job the section does for the part, when tagged. */
  functionTag?: FunctionTag;
  /** Part→part arc: the typed W₁ relation kind (drives line treatment + the legend). */
  edgeKind?: StructuralEdgeKind;
}

export interface BoardData {
  claim: string | null; // spec.mainClaim (legacy mainClaim fallback)
  readiness: ReadinessLevel | null; // lastDiagnostic.overallReadiness
  next: string | null; // lastDiagnostic.nextPriority
  coherence: string | null; // lastDiagnostic.coherenceNotes joined
}

export interface TopoModel {
  stations: Station[];
  stationById: Record<string, Station>;
  lines: Line[];
  arcs: Arc[];
  interchange: Set<string>;
  inbound: (id: string) => Arc[]; // arcs whose target === id  (DEPENDS ON)
  outbound: (id: string) => Arc[]; // arcs whose source === id  (FEEDS)
  health: (arc: Arc) => DepHealth;
  board: (id: string) => BoardData;
}

// ── Part hues — deliberately disjoint from the cyan dependency layer ──
// Cycled by Part index; cyan (#00e8f5) is never emitted.
export const PART_HUES = ['#6ea8ff', '#00e870', '#ffd060', '#d080ff', '#ff86b5'];
export const partHue = (partIndex: number): string => PART_HUES[partIndex % PART_HUES.length];

// ── Status pip palette (hexes mirror @theme tokens; SVG needs literal hex) ──
export const STATUS_PALETTE: Record<Status, { c: string; label: string }> = {
  idle: { c: '#3d5570', label: 'IDLE' }, // --color-hld-muted
  running: { c: '#00e8f5', label: 'WORK' }, // --color-hld-cyan
  success: { c: '#00e870', label: 'SOLID' }, // --color-hld-green
  fail: { c: '#ff1060', label: 'BREAK' }, // --color-hld-magenta
  stale: { c: '#ffe600', label: 'STALE' }, // --color-hld-yellow
};
export const statusMeta = (status: Status | null | undefined) =>
  STATUS_PALETTE[(status ?? 'idle') as Status] || STATUS_PALETTE.idle;

export const FN_LABELS: Record<SectionFunction, string> = {
  introduce: 'INTRODUCE',
  explicate: 'EXPLICATE',
  argue: 'ARGUE',
  compare: 'COMPARE',
  critique: 'CRITIQUE',
  synthesize: 'SYNTHESIZE',
  apply: 'APPLY',
  evaluate: 'EVALUATE',
  narrate: 'NARRATE',
  transition: 'TRANSITION',
};

export const READINESS_LABEL: Record<ReadinessLevel, string> = {
  draft: 'DRAFT',
  developing: 'DEVELOPING',
  'nearly-there': 'NEARLY',
  solid: 'SOLID',
};
export const READINESS_ORDER: ReadinessLevel[] = ['draft', 'developing', 'nearly-there', 'solid'];
export const READINESS_COLOR: Record<ReadinessLevel, string> = {
  draft: '#ff1060', // magenta
  developing: '#ffe600', // yellow
  'nearly-there': '#00e8f5', // cyan
  solid: '#00e870', // green
};

// Trim a title for compact in-canvas labels (full title lives on the Station).
function shortTitle(title: string, n = 30): string {
  const t = (title || 'Untitled').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

interface Flat {
  sec: Section;
  sym: string;
  docIndex: number;
}

// Depth-first flatten carrying outline numbering: top level 0-based (§0, §1),
// children dotted 1-based (§0.1, §2.1.1) — matches the design's symbols exactly.
function flattenWithSym(roots: Section[]): Flat[] {
  const out: Flat[] = [];
  let k = 0;
  const walk = (nodes: Section[], prefix: string) => {
    nodes.forEach((n, i) => {
      const num = prefix === '' ? String(i) : `${prefix}.${i + 1}`;
      out.push({ sec: n, sym: `§${num}`, docIndex: k++ });
      if (n.children && n.children.length) walk(n.children, num);
    });
  };
  walk(roots ?? [], '');
  return out;
}

export function deriveTopo(sections: Section[], testSuite: TestSuite): TopoModel {
  const flat = flattenWithSym(sections);
  const secById: Record<string, Section> = {};
  flat.forEach((f) => {
    secById[f.sec.id] = f.sec;
  });

  // Top-level ancestor present in the received set. Climb parentId while the
  // parent exists in secById (stops at the true top-level section, since the
  // synthetic 'root' is never part of the array the modal receives).
  const topOf = (sec: Section): string => {
    let cur = sec;
    let guard = 0;
    while (cur.parentId && secById[cur.parentId] && guard++ < 1000) {
      cur = secById[cur.parentId];
    }
    return cur.id;
  };

  // Build the line skeleton in document order (top-level sections define order).
  const lineOrder: string[] = [];
  const lineStations: Record<string, string[]> = {};
  const partIdOf: Record<string, string> = {};
  flat.forEach((f) => {
    const pid = topOf(f.sec);
    partIdOf[f.sec.id] = pid;
    if (!lineStations[pid]) {
      lineStations[pid] = [];
      lineOrder.push(pid);
    }
    lineStations[pid].push(f.sec.id);
  });

  const lineIndexOf: Record<string, number> = {};
  lineOrder.forEach((pid, i) => {
    lineIndexOf[pid] = i;
  });

  const lines: Line[] = lineOrder.map((pid, i) => {
    const root = secById[pid];
    const title = (root?.title || 'Untitled').trim();
    return {
      id: pid,
      label: title.toUpperCase(),
      sub: shortTitle(title, 40).toLowerCase(),
      num: String(i),
      color: partHue(i),
      stationIds: lineStations[pid],
    };
  });

  // Stations.
  const stations: Station[] = flat.map((f) => {
    const e = testSuite[f.sec.id];
    const pid = partIdOf[f.sec.id];
    const readiness = e?.lastDiagnostic?.overallReadiness ?? null;
    const status: Status = e?.status ?? 'idle';
    return {
      id: f.sec.id,
      partId: pid,
      sym: f.sym,
      short: shortTitle(f.sec.title),
      title: (f.sec.title || 'Untitled').trim(),
      words: f.sec.wordCount || 0,
      fn: e?.spec?.function ?? null,
      status,
      readiness,
      fog: status === 'idle' || readiness === 'draft',
      labelDir: lineIndexOf[pid] === 0 ? 'left' : 'right',
      level: f.sec.level,
      docIndex: f.docIndex,
    };
  });

  const stationById: Record<string, Station> = {};
  stations.forEach((s) => {
    stationById[s.id] = s;
  });

  // Arcs — drop dangling (source/target removed) and self-deps. updateDependencies
  // never garbage-collects stale deps, so this guard is load-bearing (prevents
  // dereferencing undefined positions in the SVG).
  const arcs: Arc[] = [];
  flat.forEach((f) => {
    const deps = testSuite[f.sec.id]?.dependencies ?? [];
    deps.forEach((dep) => {
      if (!stationById[dep.id] || !stationById[f.sec.id]) return; // dangling
      if (dep.id === f.sec.id) return; // self
      arcs.push({ id: `${dep.id}->${f.sec.id}`, source: dep.id, target: f.sec.id, type: dep.type });
    });
  });

  // Adjacency maps (inbound/outbound are called per inspector render).
  const inboundMap: Record<string, Arc[]> = {};
  const outboundMap: Record<string, Arc[]> = {};
  const interchange = new Set<string>();
  arcs.forEach((a) => {
    (inboundMap[a.target] ||= []).push(a);
    (outboundMap[a.source] ||= []).push(a);
    interchange.add(a.source);
    interchange.add(a.target);
  });

  const health = (arc: Arc): DepHealth => {
    const src = stationById[arc.source];
    if (!src) return 'solid';
    if (src.status === 'fail' || src.readiness === 'draft') return 'broken';
    if (src.status === 'stale') return 'weak';
    return 'solid';
  };

  const board = (id: string): BoardData => {
    const e = testSuite[id];
    const diag = e?.lastDiagnostic;
    return {
      claim: e?.spec?.mainClaim || e?.mainClaim || null,
      readiness: diag?.overallReadiness ?? null,
      next: diag?.nextPriority || null,
      coherence: diag?.coherenceNotes?.length ? diag.coherenceNotes.join(' ') : null,
    };
  };

  return {
    stations,
    stationById,
    lines,
    arcs,
    interchange,
    inbound: (id) => inboundMap[id] ?? [],
    outbound: (id) => outboundMap[id] ?? [],
    health,
    board,
  };
}
