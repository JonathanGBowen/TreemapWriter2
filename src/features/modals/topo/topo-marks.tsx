/* topo-marks.tsx — SVG marks shared by the position-based projections
   (ATLAS and RADIX). Both place sections at SimNode {x,y,r} positions and draw
   dependency arcs between them, so the Province (a section) and Route (a
   dependency) marks live here once. The SPINE projection uses its own metro
   Station/DepArc (different geometry), so it is not a consumer.

   Beyond the ported ATLAS look, two centering channels are added: a Province may
   carry a `fieldRole` (how it reads when another node is the centre — upstream /
   downstream / unrelated) and a Route may be `backward` (a prerequisite that
   sits after its dependent in reading order). The radix/telos PoleGlyph marks
   the structural source/sink — "the source of the arrows, the heart of the
   matter." */

import React from 'react';
import type { Arc, Station as StationT } from './topo-derive';
import { statusMeta } from './topo-derive';
import { SEA, type SimNode } from './topo-sim-atlas';
import { TK } from './tk';
import type { FieldRole } from './topo-centering';

const mono = 'JetBrains Mono, monospace';

function trim(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// upstream (what this rests on) reads cyan, like the inspector's DEPENDS ON;
// downstream (what rests on this) reads green, like FEEDS.
function fieldRing(role: FieldRole | null | undefined): string | null {
  return role === 'upstream' ? TK.accent : role === 'downstream' ? TK.green : null;
}

// ── route (dependency) ──────────────────────────────────────────────
export const Route: React.FC<{
  arc: Arc;
  m: Record<string, SimNode>;
  health: 'solid' | 'weak' | 'broken';
  dim: boolean;
  selected: boolean;
  backward?: boolean;
  onSelect: (id: string) => void;
}> = ({ arc, m, health, dim, selected, backward, onSelect }) => {
  const a = m[arc.source];
  const b = m[arc.target];
  if (!a || !b) return null;
  const ref = arc.type === 'reference';
  const base = health === 'broken' ? TK.magenta : health === 'weak' ? TK.yellow : TK.accent;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const sx = a.x + nx * (a.r + 2);
  const sy = a.y + ny * (a.r + 2);
  const ex = b.x - nx * (b.r + 9);
  const ey = b.y - ny * (b.r + 9);
  const bow = Math.min(48, d * 0.14);
  const mx = (sx + ex) / 2 - ny * bow;
  const my = (sy + ey) / 2 + nx * bow;
  const path = `M${sx},${sy} Q ${mx},${my} ${ex},${ey}`;
  const dash = ref ? '9 7' : health === 'weak' ? '3 7' : undefined;
  const ang = (Math.atan2(ey - my, ex - mx) * 180) / Math.PI;
  return (
    <g
      opacity={dim ? 0.12 : 1}
      style={{ transition: 'opacity 0.45s', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(arc.id);
      }}
    >
      <path d={path} fill="none" stroke="transparent" strokeWidth="18" />
      {selected && <path d={path} fill="none" stroke={TK.accent} strokeWidth="7" opacity="0.28" style={{ filter: 'blur(3px)' }} />}
      <circle cx={sx} cy={sy} r="3.2" fill={TK.bg} stroke={base} strokeWidth="1.6" />
      <path
        d={path}
        fill="none"
        stroke={base}
        strokeWidth={selected ? 3 : 2.2}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeOpacity={health === 'broken' ? 0.92 : 1}
      />
      <g transform={`translate(${ex},${ey}) rotate(${ang})`}>
        <path d="M0,0 L-9,-5 L-9,5 Z" fill={base} />
      </g>
      {backward && (
        // reading-order violation: a back-chevron near the midpoint, pointing the
        // way the dependency actually flows (earlier in the document).
        <g transform={`translate(${mx},${my}) rotate(${ang})`}>
          <path d="M0,0 L11,-5 L11,5 Z" fill="none" stroke={TK.magenta} strokeWidth="1.5" />
        </g>
      )}
      {health === 'broken' && (
        <g transform={`translate(${mx},${my})`}>
          <circle r="8.5" fill={TK.bg} stroke={TK.magenta} strokeWidth="1.6" />
          <path d="M-3.4,-3.4 L3.4,3.4 M3.4,-3.4 L-3.4,3.4" stroke={TK.magenta} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
};

// ── province marker (the section, a "city" on its land) ─────────────
export const Province: React.FC<{
  s: StationT;
  node: SimNode | undefined;
  color: string;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  isHere: boolean;
  reduced: boolean;
  fieldRole?: FieldRole | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onHover: (id: string | null) => void;
}> = ({ s, node, color, selected, hovered, dimmed, isHere, reduced, fieldRole, onSelect, onOpen, onHover }) => {
  if (!node) return null;
  const meta = statusMeta(s.status);
  const active = selected || hovered;
  const ring = fieldRing(fieldRole);
  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.45s' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(s.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen(s.id);
      }}
      onPointerEnter={() => onHover(s.id)}
      onPointerLeave={() => onHover(null)}
    >
      {ring && !selected && <circle r={node.r + 4} fill="none" stroke={ring} strokeWidth="1.4" opacity="0.7" />}
      {selected &&
        (reduced ? (
          <circle r={node.r + 7} fill="none" stroke={TK.accent} strokeWidth="1.4" strokeDasharray="3 5" opacity="0.95" />
        ) : (
          <circle r={node.r + 7} fill="none" stroke={TK.accent} strokeWidth="1.4" strokeDasharray="3 5" opacity="0.95">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
          </circle>
        ))}
      {hovered && !selected && <circle r={node.r + 5} fill="none" stroke={TK.accent} strokeWidth="1" opacity="0.4" />}
      {isHere &&
        (reduced ? (
          <circle r={node.r + 11} fill="none" stroke={TK.accent} strokeWidth="1.2" strokeDasharray="2 6" opacity="0.8" />
        ) : (
          <circle r={node.r + 11} fill="none" stroke={TK.accent} strokeWidth="1.2" strokeDasharray="2 6" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="14s" repeatCount="indefinite" />
          </circle>
        ))}
      {s.fog && <circle r={node.r} fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="4 4" opacity="0.55" />}
      <circle r="5.5" fill={meta.c} stroke={TK.bg} strokeWidth="1.2" style={{ filter: `drop-shadow(0 0 5px ${meta.c})` }} />
      <text
        x="0"
        y={-10}
        textAnchor="middle"
        fontFamily={mono}
        fontSize={11}
        fontWeight="800"
        letterSpacing="0.03em"
        fill={selected ? TK.accent : TK.textHi}
        style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: SEA, strokeWidth: 3 }}
      >
        {s.sym}
      </text>
      {active && (
        <g style={{ pointerEvents: 'none' }}>
          <text
            x="0"
            y={node.r + 15}
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize={11}
            fontWeight="700"
            fill={TK.textHi}
            style={{ paintOrder: 'stroke', stroke: SEA, strokeWidth: 3.5 }}
          >
            {trim(s.short, 24)}
          </text>
          <text
            x="0"
            y={node.r + 28}
            textAnchor="middle"
            fontFamily={mono}
            fontSize="7.5"
            letterSpacing="0.1em"
            fill={meta.c}
            style={{ paintOrder: 'stroke', stroke: SEA, strokeWidth: 3 }}
          >
            {s.words}W · {meta.label}
          </text>
        </g>
      )}
    </g>
  );
};

// ── radix / telos glyph — the centering layer (purple, distinct from the cyan
//    dependency layer, the Part hues and the status pips) ──────────────
export const PoleGlyph: React.FC<{ x: number; y: number; r: number; kind: 'radix' | 'telos' }> = ({ x, y, r, kind }) => {
  const off = r * 0.72;
  return (
    <g transform={`translate(${x + off},${y - off})`} style={{ pointerEvents: 'none' }}>
      {kind === 'radix' ? (
        // source of the arrows: a small outward burst
        <g stroke={TK.purple} strokeWidth="1.3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${TK.purple})` }}>
          <path d="M0,-5 L0,5 M-5,0 L5,0 M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5" />
        </g>
      ) : (
        // the telos: a concentric target the field drives toward
        <g style={{ filter: `drop-shadow(0 0 3px ${TK.purple})` }}>
          <circle r="5" fill="none" stroke={TK.purple} strokeWidth="1.2" />
          <circle r="1.6" fill={TK.purple} />
        </g>
      )}
    </g>
  );
};

export { mono as markMono };
