/* topo-layout-parts.ts — bipartite position derivation for the PARTS projection.

   Two vertical columns: StructuralParts on the LEFT, the sections they map onto
   on the RIGHT. Membership edges run left→right, so a part fanning out to two
   sections (spansMultiple) and a section fed by two parts (shared) both read at a
   glance. Pure and deterministic (a plain grid; no force sim, no rAF), mirroring
   `topo-layout-radix.ts`, and it emits the same `SimNode` shape ATLAS/RADIX use
   so the shared marks render it unchanged. */

import type { PartsModel } from './topo-parts';
import { radiusOf, type Canvas, type SimNode } from './topo-sim-atlas';

const ROW_PITCH = 96;
const MARGIN_Y = 96;
const MARGIN_X = 130;

export interface PartsLayout {
  nodes: SimNode[];
  canvas: Canvas;
  partX: number;
  sectionX: number;
}

export function partsLayout(pm: PartsModel): PartsLayout {
  const maxPartR = pm.partStations.reduce((mx, s) => Math.max(mx, radiusOf(s.words)), 20);
  const maxSecR = pm.sectionStations.reduce((mx, s) => Math.max(mx, radiusOf(s.words)), 20);

  const partX = MARGIN_X + maxPartR;
  // Enough gap for both radii + labels + the fanned edges between the columns.
  const sectionX = partX + maxPartR + maxSecR + 360;
  const width = sectionX + maxSecR + MARGIN_X;

  const rows = Math.max(pm.partStations.length, pm.sectionStations.length, 1);
  const height = MARGIN_Y * 2 + (rows - 1) * ROW_PITCH;

  const nodes: SimNode[] = [];
  const placeColumn = (stations: PartsModel['partStations'], x: number) => {
    const n = stations.length;
    const colHeight = (n - 1) * ROW_PITCH;
    const y0 = height / 2 - colHeight / 2;
    stations.forEach((s, i) => {
      nodes.push({
        id: s.id,
        part: s.partId,
        r: radiusOf(s.words),
        status: s.status,
        x,
        y: y0 + i * ROW_PITCH,
        vx: 0,
        vy: 0,
      });
    });
  };
  placeColumn(pm.partStations, partX);
  placeColumn(pm.sectionStations, sectionX);

  return { nodes, canvas: { w: Math.max(900, width), h: Math.max(500, height) }, partX, sectionX };
}
