/* topo-centering.ts — the radix engine for the Argument Topology modal.

   Wertheimer's centering, made computable. In "A Girl Describes Her Office" the
   true centre of a relational network is NOT the most-connected node (the
   degree-count table there cannot tell the boss from the homotypes) — it is "the
   source of the arrows, the heart of the matter." Our dependency arcs are already
   directed (source = prerequisite/radix-ward, target = dependent/telos-ward), so
   the radix is computable from direction alone.

   This module takes a TopoModel and returns, for every station: its structural
   RANK (longest-path layer — sources at 0, sinks at max: "boss → secretaries →
   clerks"), its CENTRALITY (how much of the document transitively rests on it —
   "necessary-part-hood"), whether it is a radix/telos/in a cycle; and, document-
   wide, the cycles, the BACKWARD arcs (a prerequisite that sits *after* its
   dependent in reading order — the "two-wings" distortion), and a MISCENTERING
   scalar. Pure (no React/Plotly/state), deterministic (no Math.random / rAF):
   it rides the modal's existing useMemo on [sections, testSuite]. */

import type { TopoModel } from './topo-derive';

export interface StationCentering {
  id: string;
  inDegree: number; // arcs that DEPEND ON others  (model.inbound)
  outDegree: number; // arcs that FEED others        (model.outbound)
  rank: number; // longest-path layer; radix/sources = 0, telos/sinks = maxRank
  centrality: number; // |transitive-dependents| — what rests on this, the radix score
  transitiveDependents: Set<string>; // everything that, directly or not, depends on this
  isRadix: boolean; // a genuine source the document rests on (inDegree 0, centrality > 0)
  isTelos: boolean; // a genuine sink something feeds (outDegree 0, inDegree > 0)
  inCycle: boolean; // member of a dependency cycle (structural pathology)
}

export interface Centering {
  byId: Record<string, StationCentering>;
  maxRank: number;
  radix: string[]; // station ids, in document order
  telos: string[]; // station ids, in document order
  cycles: string[][]; // strongly-connected components of size > 1
  backwardArcs: Set<string>; // arc ids flowing against authored (docIndex) order
  backwardCount: number;
  miscentering: number; // backwardCount / arcs — 0..1, "how far the field is miscentred"
}

// Forward reachability from `start` over the dependent adjacency (source → target).
// The result is `start`'s transitive dependents; it contains `start` itself iff
// `start` lies on a cycle.
function reachFrom(start: string, out: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(out.get(start) ?? [])];
  while (stack.length) {
    const n = stack.pop() as string;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const t of out.get(n) ?? []) stack.push(t);
  }
  return seen;
}

// Deduped forward adjacency (source → dependents); every station is a key so
// isolated nodes are present. Self-edges are already dropped in topo-derive.
function forwardAdj(model: TopoModel): Map<string, string[]> {
  const out = new Map<string, string[]>();
  model.stations.forEach((s) => out.set(s.id, []));
  for (const a of model.arcs) {
    const list = out.get(a.source);
    if (list && a.target !== a.source && !list.includes(a.target)) list.push(a.target);
  }
  return out;
}

// Strongly-connected components by mutual reachability (an equivalence relation;
// O(V^2) is ample for one dissertation, and deterministic in document order).
function sccGroups(ids: string[], reach: Map<string, Set<string>>) {
  const compId = new Map<string, number>();
  const compMembers = new Map<number, string[]>();
  let next = 0;
  for (const id of ids) {
    if (compId.has(id)) continue;
    const ri = reach.get(id) as Set<string>;
    const members = [id, ...ids.filter((j) => j !== id && ri.has(j) && (reach.get(j) as Set<string>).has(id))];
    for (const m of members) compId.set(m, next);
    compMembers.set(next, members);
    next++;
  }
  return { compId, compMembers };
}

// Longest-path rank over the SCC condensation (Kahn): a component is popped only
// once all its predecessors are ranked, so its rank is final when read.
function condensationRanks(
  model: TopoModel,
  compId: Map<string, number>,
  compMembers: Map<number, string[]>,
): Map<number, number> {
  const compOut = new Map<number, Set<number>>();
  const indeg = new Map<number, number>();
  for (const c of compMembers.keys()) {
    compOut.set(c, new Set());
    indeg.set(c, 0);
  }
  for (const a of model.arcs) {
    const cs = compId.get(a.source);
    const ct = compId.get(a.target);
    if (cs === undefined || ct === undefined || cs === ct) continue;
    const tos = compOut.get(cs) as Set<number>;
    if (!tos.has(ct)) {
      tos.add(ct);
      indeg.set(ct, (indeg.get(ct) as number) + 1);
    }
  }
  const rank = new Map<number, number>();
  const q: number[] = [];
  for (const c of compMembers.keys()) {
    if ((indeg.get(c) as number) === 0) {
      rank.set(c, 0);
      q.push(c);
    }
  }
  while (q.length) {
    const c = q.shift() as number;
    const rc = rank.get(c) ?? 0;
    for (const t of compOut.get(c) as Set<number>) {
      rank.set(t, Math.max(rank.get(t) ?? 0, rc + 1));
      indeg.set(t, (indeg.get(t) as number) - 1);
      if ((indeg.get(t) as number) === 0) q.push(t);
    }
  }
  return rank;
}

// A prerequisite (source) that sits AFTER its dependent (target) in authored
// order — the reader must read ahead. Wertheimer's "two-wings" distortion.
function backwardArcSet(model: TopoModel): Set<string> {
  const out = new Set<string>();
  for (const a of model.arcs) {
    const s = model.stationById[a.source];
    const t = model.stationById[a.target];
    if (s && t && s.docIndex > t.docIndex) out.add(a.id);
  }
  return out;
}

export function computeCentering(model: TopoModel): Centering {
  const ids = model.stations.map((s) => s.id);
  const out = forwardAdj(model);
  const reach = new Map<string, Set<string>>();
  for (const id of ids) reach.set(id, reachFrom(id, out));
  const { compId, compMembers } = sccGroups(ids, reach);
  const rankComp = condensationRanks(model, compId, compMembers);

  const byId: Record<string, StationCentering> = {};
  for (const s of model.stations) {
    const id = s.id;
    const inDegree = model.inbound(id).length;
    const outDegree = model.outbound(id).length;
    const transitiveDependents = new Set(reach.get(id) as Set<string>);
    transitiveDependents.delete(id);
    const comp = compId.get(id) as number;
    const centrality = transitiveDependents.size;
    byId[id] = {
      id,
      inDegree,
      outDegree,
      rank: rankComp.get(comp) ?? 0,
      centrality,
      transitiveDependents,
      isRadix: inDegree === 0 && centrality > 0,
      isTelos: outDegree === 0 && inDegree > 0,
      inCycle: (compMembers.get(comp) as string[]).length > 1,
    };
  }

  const backwardArcs = backwardArcSet(model);
  return {
    byId,
    maxRank: [...rankComp.values()].reduce((m, r) => Math.max(m, r), 0),
    radix: ids.filter((id) => byId[id].isRadix),
    telos: ids.filter((id) => byId[id].isTelos),
    cycles: [...compMembers.values()].filter((m) => m.length > 1),
    backwardArcs,
    backwardCount: backwardArcs.size,
    miscentering: backwardArcs.size / Math.max(1, model.arcs.length),
  };
}

// What a node transitively RESTS ON (its prerequisites), by walking inbound arcs
// (target → source). The mirror of transitiveDependents — used to tint the
// "upstream" field when a node is recentred.
export function upstreamClosure(model: TopoModel, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = model.inbound(id).map((a) => a.source);
  while (stack.length) {
    const n = stack.pop() as string;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const a of model.inbound(n)) stack.push(a.source);
  }
  seen.delete(id);
  return seen;
}

// Plain-prose structural facts about one section, for the AI gestalt prompts —
// so the model's Umzentrierung is grounded in the real dependency topology, not
// the section's prose alone. Empty for a section outside the dependency graph
// (nothing structural to say).
export function formatStructuralEvidence(model: TopoModel, centering: Centering, sectionId: string): string {
  const c = centering.byId[sectionId];
  if (!c || (c.inDegree === 0 && c.outDegree === 0)) return '';
  const rests = upstreamClosure(model, sectionId).size;
  const lines: string[] = [
    `Dependency rank ${c.rank} of ${centering.maxRank} (0 = a source the rest builds on; ${centering.maxRank} = a final sink).`,
    `${c.centrality} section(s) transitively rest on this one; it rests on ${rests}.`,
  ];
  if (c.isRadix) lines.push('It is a RADIX — a structural source the document rests on (depends on nothing; much depends on it).');
  if (c.isTelos) lines.push('It is a TELOS — a structural sink: it builds on earlier work but nothing yet builds on it.');
  if (c.inCycle) lines.push('It lies in a DEPENDENCY CYCLE — a structural pathology (its prerequisites ultimately depend back on it).');
  const back = [...model.inbound(sectionId), ...model.outbound(sectionId)].filter((a) => centering.backwardArcs.has(a.id)).length;
  if (back > 0) lines.push(`${back} of its links run BACKWARD against reading order (a prerequisite placed after what needs it).`);
  return lines.join('\n');
}

// Wertheimer's recentering, made spatial: viewed FROM a chosen node, every other
// part re-reads as something it rests on (upstream), something that rests on it
// (downstream), or — for now — outside its field (unrelated). "All the items
// change their meaning." One field, shared by all three projections.
export type FieldRole = 'self' | 'upstream' | 'downstream' | 'unrelated';

export interface RecenterField {
  role: (id: string) => FieldRole;
  inField: (id: string) => boolean; // self, upstream or downstream
  arcInField: (arc: { source: string; target: string }) => boolean;
}

export function recenterField(model: TopoModel, centering: Centering, selectedId: string | null): RecenterField | null {
  const c = selectedId ? centering.byId[selectedId] : undefined;
  if (!selectedId || !c) return null;
  const up = upstreamClosure(model, selectedId);
  const down = c.transitiveDependents;
  const field = new Set<string>([selectedId, ...up, ...down]);
  return {
    role: (id) => (id === selectedId ? 'self' : up.has(id) ? 'upstream' : down.has(id) ? 'downstream' : 'unrelated'),
    inField: (id) => field.has(id),
    // An arc belongs to the recentred field only if BOTH ends are in it — that
    // lights the entire prerequisite/dependent subgraph, not just 1-hop neighbours.
    arcInField: (a) => field.has(a.source) && field.has(a.target),
  };
}
