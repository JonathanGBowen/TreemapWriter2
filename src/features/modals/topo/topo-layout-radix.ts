/* topo-layout-radix.ts — RADIX (structural-rank) position derivation.

   Where ATLAS arranges sections by authored order and then grooms the picture
   for fewest crossings, RADIX lets POSITION ENCODE STRUCTURAL ROLE: the primary
   (vertical) axis is the dependency rank. Sources — the radix the document rests
   on — sit at the top pole; sinks — the telos it drives toward — at the bottom;
   everything else is layered between, "boss → secretaries → clerks." Reading the
   y-axis is reading the order of structural dependence rather than the order of
   the table of contents.

   Pure and deterministic (a plain grid; no force sim, no rAF), so the layout and
   any screenshot are identical every run. Emits the same SimNode shape ATLAS
   uses, so the shared marks render it unchanged. */

import type { TopoModel } from './topo-derive';
import type { Centering } from './topo-centering';
import { radiusOf, type Canvas, type SimNode } from './topo-sim-atlas';

const ROW_PITCH = 152;
const MARGIN_Y = 90;
const MARGIN_X = 120;

export interface RadixLayout {
  nodes: SimNode[];
  canvas: Canvas;
  bands: { rank: number; y: number }[];
}

export function radixLayout(model: TopoModel, centering: Centering): RadixLayout {
  const maxRank = centering.maxRank;

  // Group stations by rank, keeping document order within a band so a row reads
  // left-to-right the way the chapters do.
  const byRank = new Map<number, string[]>();
  for (let r = 0; r <= maxRank; r++) byRank.set(r, []);
  for (const s of model.stations) {
    const rank = centering.byId[s.id]?.rank ?? 0;
    (byRank.get(rank) as string[]).push(s.id);
  }

  // Column pitch from the largest province so bands never overlap.
  const maxRadius = model.stations.reduce((mx, s) => Math.max(mx, radiusOf(s.words)), 20);
  const colPitch = Math.max(150, maxRadius * 2 + 44);
  const widest = Math.max(1, ...[...byRank.values()].map((ids) => ids.length));
  const width = MARGIN_X * 2 + (widest - 1) * colPitch;

  const nodes: SimNode[] = [];
  const bands: { rank: number; y: number }[] = [];
  for (let r = 0; r <= maxRank; r++) {
    const ids = byRank.get(r) as string[];
    const y = MARGIN_Y + r * ROW_PITCH;
    bands.push({ rank: r, y });
    const rowWidth = (ids.length - 1) * colPitch;
    const x0 = width / 2 - rowWidth / 2;
    ids.forEach((id, i) => {
      const s = model.stationById[id];
      nodes.push({
        id,
        part: s.partId,
        r: radiusOf(s.words),
        status: s.status,
        x: x0 + i * colPitch,
        y,
        vx: 0,
        vy: 0,
      });
    });
  }

  const height = MARGIN_Y * 2 + maxRank * ROW_PITCH;
  return { nodes, canvas: { w: Math.max(900, width), h: Math.max(500, height) }, bands };
}
