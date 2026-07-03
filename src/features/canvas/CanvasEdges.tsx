// The W₁ Canvas edge layer (Arpeggio Phase 4). An inline SVG inside the transformed
// world container, drawing each StructuralEdge between its endpoints' world positions
// with the SAME per-kind line treatment as the topo PARTS projection (reused
// `EDGE_DASH`/`SYMMETRIC_EDGE`): directed kinds get an arrowhead, the two symmetric
// kinds (requires/opposes) don't. Proposed (AI) edges read amber until accepted. Inline
// SVG resolves the `--color-hld-*` tokens directly, so no `tk.ts` literal-hex mirror.

import type { StructuralEdge, StructuralPart } from '../../types';
import { EDGE_DASH, SYMMETRIC_EDGE } from '../modals/topo/topo-marks';

/** Approx node radius (cards are ~180×64) — where an edge meets a card, not its centre. */
const NODE_R = 34;

export function CanvasEdges({
  parts,
  edges,
  selectedEdgeId,
  onSelectEdge,
}: {
  parts: StructuralPart[];
  edges: StructuralEdge[];
  selectedEdgeId: string | null;
  onSelectEdge: (id: string) => void;
}) {
  const posById = new Map(parts.filter((p) => p.position).map((p) => [p.id, p.position!]));

  return (
    <svg style={{ position: 'absolute', overflow: 'visible', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      {edges.map((e) => {
        const a = posById.get(e.fromPartId);
        const b = posById.get(e.toPartId);
        if (!a || !b) return null; // dangling edge — hidden (pruneEdges idiom)
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d;
        const ny = dy / d;
        const sx = a.x + nx * NODE_R;
        const sy = a.y + ny * NODE_R;
        const ex = b.x - nx * NODE_R;
        const ey = b.y - ny * NODE_R;
        const proposed = e.status === 'proposed';
        const stroke = proposed ? 'var(--color-hld-feat-confidence)' : 'var(--color-hld-purple)';
        const selected = e.id === selectedEdgeId;
        const ang = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
        return (
          <g
            key={e.id}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={() => onSelectEdge(e.id)}
          >
            {/* fat transparent hit area */}
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth={14} />
            <line
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke={stroke}
              strokeWidth={selected ? 3 : 1.8}
              strokeDasharray={proposed ? '4 4' : EDGE_DASH[e.kind]}
              strokeLinecap="round"
              opacity={proposed ? 0.85 : 1}
            />
            {!SYMMETRIC_EDGE(e.kind) && (
              <g transform={`translate(${ex},${ey}) rotate(${ang})`}>
                <path d="M0,0 L-9,-4.5 L-9,4.5 Z" fill={stroke} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
