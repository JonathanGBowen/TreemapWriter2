/* topo-parts.ts — the data layer for the Argument Topology modal's PARTS
   projection.

   Where ATLAS / SPINE / RADIX render the section grid + its dependency arcs,
   PARTS renders the fifth domain layer — the discovered StructuralParts — against
   the sections they map onto. A part is a node; each (part, section) membership
   is an `Arc`-shaped edge (source = part, target = section). Because the mapping
   is many-to-many, the divergences render for free: a part with two section edges
   SPANS them; a section with two part edges is SHARED.

   Pure (no React). It reuses the section `Station`s already derived by
   `deriveTopo` (same sym / status / title), so the shared Province/Route marks
   render both columns unchanged. Part-nodes are synthesised as `Station`s too
   (words 0, status 'idle') so they share those marks; the renderer colours them
   with the purple centering hue to set them apart from the section continents. */

import type { StructuralPart } from '../../../types';
import type { Arc, Station, TopoModel } from './topo-derive';

const shortTitle = (title: string, n = 30): string => {
  const t = (title || 'Untitled').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};

export interface PartsModel {
  /** One synthesised Station per StructuralPart (the left/parts column). */
  partStations: Station[];
  /** The section Stations a part maps onto (the right/sections column), doc order. */
  sectionStations: Station[];
  /** Membership edges: source = part id, target = section id. */
  arcs: Arc[];
  /** Union lookup over both columns (Route/Province index into this). */
  stationById: Record<string, Station>;
  /** True when the discovery has run but nothing mapped (all parts orphaned). */
  hasOrphans: boolean;
}

/** Synthesize a Station for a StructuralPart so the shared Province mark renders it. */
function partStation(part: StructuralPart, i: number): Station {
  return {
    id: part.id,
    partId: part.id, // its own singleton "line" — coloured purple by the renderer
    sym: `P${i}`,
    short: shortTitle(part.kind || part.claim || 'part', 22),
    title: part.claim || part.kind || 'Untitled part',
    words: 0,
    fn: null,
    status: 'idle',
    readiness: null,
    fog: false,
    labelDir: 'left',
    level: 0,
    docIndex: i,
  };
}

/**
 * Build the PARTS view model from the already-derived section topology + the
 * discovered parts. Deviates from the audit's `derivePartsModel(sections, parts)`
 * signature by taking the `TopoModel` instead of raw sections — so the section
 * column reuses the exact Stations (sym/status/title) the other projections show
 * rather than re-flattening the tree. Only sections a part actually maps onto are
 * included (a focused bipartite graph); stale section ids are skipped.
 *
 * `orphanIds` is the live anchor-orphan set (from `recomputeStructuralStale`): a
 * part whose anchors no longer relocate. Folded into `hasOrphans` because a part
 * can go anchor-orphan while its DISCOVERY-time `sectionIds` still point at live
 * sections — the stored mapping alone would miss it.
 */
export function derivePartsModel(
  model: TopoModel,
  parts: StructuralPart[],
  orphanIds: string[] = [],
): PartsModel {
  const partStations = parts.map((p, i) => partStation(p, i));
  const orphanSet = new Set(orphanIds);

  const arcs: Arc[] = [];
  const usedSectionIds = new Set<string>();
  let hasOrphans = false;
  parts.forEach((p) => {
    const live = p.sectionIds.filter((sid) => !!model.stationById[sid]);
    if (live.length === 0 || orphanSet.has(p.id)) hasOrphans = true;
    live.forEach((sid) => {
      usedSectionIds.add(sid);
      arcs.push({ id: `${p.id}->${sid}`, source: p.id, target: sid, type: 'reference' });
    });
  });

  // Keep section stations in document order (model.stations is already ordered).
  const sectionStations = model.stations.filter((s) => usedSectionIds.has(s.id));

  const stationById: Record<string, Station> = {};
  partStations.forEach((s) => (stationById[s.id] = s));
  sectionStations.forEach((s) => (stationById[s.id] = s));

  return { partStations, sectionStations, arcs, stationById, hasOrphans };
}
