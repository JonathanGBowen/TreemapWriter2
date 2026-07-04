/* topo-order-marks.tsx — the SPINE order-diagnostics layer (Arpeggio Phase 5).

   Renders the precedence engine's part-level results onto the SPINE's section
   stations, each part reaching a station through its GRASP point (graspStationOf):
   - admissibility ticks: a red down-tick over a part grasped BEFORE a precedence
     it must follow (reason on hover);
   - commutable brackets: a gray connector through a run whose order is arbitrary,
     with a click-to-"declare heap" glyph (files a ledger entry);
   - non-linearizable chips: a violet ∞ chip on each member of a cycle no linear
     order can satisfy — click for the strategy menu (spiral | declared-IOU |
     pointer beyond the medium).

   Screen coords come from the SPINE `pos` map (world space, inside TopoMap's pan/
   zoom <g>), so the menu is drawn as plain SVG (no foreignObject) and pans with it. */

import React from 'react';
import { TK } from './tk';
import type { XY } from './topo-layout-spine';
import type { CommutableRun, PrecedenceCycle, PrecedenceViolation } from '../../../lib/precedence';

const mono = 'JetBrains Mono, monospace';

export type StrategyChoice = 'spiral' | 'declared-iou' | 'pointer';

export interface OrderMarksProps {
  pos: Record<string, XY>;
  /** partId → its grasp-point section id (where the mark attaches). */
  graspStationOf: Map<string, string>;
  violations: PrecedenceViolation[];
  commutable: CommutableRun[];
  cycles: PrecedenceCycle[];
  claimOf: (partId: string) => string;
  /** Which cycle's strategy menu is open (index into `cycles`), or null. */
  openCycle: number | null;
  onToggleCycle: (index: number | null) => void;
  onDeclareHeap: (sectionId: string, partIds: string[]) => void;
  onStrategy: (cycle: PrecedenceCycle, choice: StrategyChoice) => void;
}

/** The grasp-station position for a part, or null if it isn't placed. */
function markPos(partId: string, graspStationOf: Map<string, string>, pos: Record<string, XY>): XY | null {
  const sid = graspStationOf.get(partId);
  if (!sid) return null;
  return pos[sid] ?? null;
}

const STRATEGY_ROWS: { choice: StrategyChoice; label: string }[] = [
  { choice: 'spiral', label: 'SPIRAL — introduce each early' },
  { choice: 'declared-iou', label: 'DECLARED IOU — defer a link' },
  { choice: 'pointer', label: 'POINTER beyond the medium' },
];

export const OrderMarks: React.FC<OrderMarksProps> = ({
  pos,
  graspStationOf,
  violations,
  commutable,
  cycles,
  claimOf,
  openCycle,
  onToggleCycle,
  onDeclareHeap,
  onStrategy,
}) => {
  const cyclePartIds = new Set<string>();
  cycles.forEach((c) => c.partIds.forEach((id) => cyclePartIds.add(id)));

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Commutable brackets (behind the ticks/chips): a gray connector + a declare-heap glyph. */}
      {commutable.map((run, i) => {
        const pts = run.partIds.map((id) => markPos(id, graspStationOf, pos)).filter((p): p is XY => !!p);
        if (pts.length < 2) return null;
        const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const head = pts[0];
        const heapSid = graspStationOf.get(run.partIds[0]);
        return (
          <g key={`run-${i}`}>
            <title>Order arbitrary here — {run.partIds.map(claimOf).join(' · ')}</title>
            <path d={d} fill="none" stroke={TK.dim} strokeWidth={1.4} strokeDasharray="2 5" opacity={0.8} />
            {heapSid && (
              <g
                transform={`translate(${head.x - 22},${head.y})`}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeclareHeap(heapSid, run.partIds);
                }}
              >
                <title>Declare this run an honest heap (order intentionally arbitrary) — files a ledger entry</title>
                <rect x={-8} y={-7} width={16} height={14} rx={2} fill={TK.surface} stroke={TK.dim} strokeWidth={1} />
                <text x={0} y={3.5} textAnchor="middle" fontFamily={mono} fontSize={9} fontWeight={700} fill={TK.muted}>
                  ≈
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Admissibility ticks: the part grasped too early carries a red down-tick. */}
      {violations.map((v, i) => {
        const p = markPos(v.after, graspStationOf, pos);
        if (!p) return null;
        return (
          <g key={`viol-${i}`} transform={`translate(${p.x},${p.y - 20})`}>
            <title>
              {v.reason}: “{claimOf(v.after)}” is grasped before “{claimOf(v.before)}”, which must come first
            </title>
            <path d="M0,6 L-4,-2 L4,-2 Z" fill={TK.magenta} opacity={0.95} />
          </g>
        );
      })}

      {/* Non-linearizable chips: a violet ∞ on each cycle member — click for the strategy menu. */}
      {cycles.map((cycle, ci) =>
        cycle.partIds.map((partId) => {
          const p = markPos(partId, graspStationOf, pos);
          if (!p) return null;
          return (
            <g
              key={`cyc-${ci}-${partId}`}
              transform={`translate(${p.x + 16},${p.y - 16})`}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCycle(openCycle === ci ? null : ci);
              }}
            >
              <title>Non-linearizable region — no reading order satisfies every precedence. Click for a strategy.</title>
              <circle r={7} fill={TK.surface} stroke={TK.purple} strokeWidth={1.3} />
              <text x={0} y={3} textAnchor="middle" fontFamily={mono} fontSize={8.5} fontWeight={800} fill={TK.purple}>
                ∞
              </text>
            </g>
          );
        }),
      )}

      {/* The strategy menu for the open cycle (SVG, so it pans/zooms with the map). */}
      {openCycle !== null &&
        cycles[openCycle] &&
        (() => {
          const cycle = cycles[openCycle];
          const anchor = markPos(cycle.partIds[0], graspStationOf, pos);
          if (!anchor) return null;
          const w = 176;
          const rowH = 20;
          const h = rowH * STRATEGY_ROWS.length + 20;
          return (
            <g transform={`translate(${anchor.x + 26},${anchor.y - 8})`} style={{ pointerEvents: 'auto' }}>
              <rect x={0} y={0} width={w} height={h} rx={3} fill={TK.surface} stroke={TK.purple} strokeWidth={1} />
              <text x={9} y={13} fontFamily={mono} fontSize={7.5} fontWeight={700} letterSpacing="0.12em" fill={TK.purple}>
                NON-LINEARIZABLE · STRATEGY
              </text>
              {STRATEGY_ROWS.map((r, k) => (
                <g
                  key={r.choice}
                  transform={`translate(0,${20 + k * rowH})`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStrategy(cycle, r.choice);
                    onToggleCycle(null);
                  }}
                >
                  <rect x={4} y={0} width={w - 8} height={rowH - 3} rx={2} fill="transparent" />
                  <text x={11} y={12} fontFamily={mono} fontSize={8} fontWeight={600} fill={TK.muted}>
                    {r.label}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}
    </g>
  );
};
