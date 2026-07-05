/* TopoRadix.tsx — the RADIX projection (structural-rank map).

   The same provinces and routes as ATLAS, but laid out so the vertical axis IS
   the dependency rank: the radix (what the document rests on) at the top pole,
   the telos (what it drives toward) at the bottom, every part layered between by
   how much structure stands under it. Static and deterministic — no force sim,
   no OPTIMISE; ORGANISE/projection-switch just refits. Selecting a node recentres
   the whole field on it, exactly as in the other projections. */

import React, { useEffect, useMemo } from 'react';
import type { TopoModel } from './topo-derive';
import { usePanZoom } from './usePanZoom';
import { clamp, fitNodes, type SimNode, type Transform } from './topo-sim-atlas';
import { radixLayout } from './topo-layout-radix';
import { recenterField, type Centering } from './topo-centering';
import { Province, Route, PoleGlyph } from './topo-marks';
import { TK } from './tk';

const mono = 'JetBrains Mono, monospace';

export interface TopoRadixProps {
  model: TopoModel;
  centering: Centering;
  /** Per-backward-arc order verdict (Phase 5): 'covered' → neutral bridge, 'uncovered' → warning chevron. */
  orderCover: Map<string, 'covered' | 'uncovered'>;
  selectedId: string | null;
  hoveredId: string | null;
  editorId: string | null;
  filter: string | null;
  selectedDepId: string | null;
  fitNonce: number;
  reduced: boolean;
  onSelect: (id: string | null) => void;
  onSelectDep: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}

const RadixGrid: React.FC = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }}>
    <defs>
      <pattern id="topo-radix-grid" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M46 0 L0 0 0 46" fill="none" stroke={TK.accent} strokeWidth="0.35" opacity="0.07" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#topo-radix-grid)" />
  </svg>
);

const ZoomHud: React.FC<{ t: Transform; setT: React.Dispatch<React.SetStateAction<Transform>>; onFit: () => void }> = ({ t, setT, onFit }) => {
  const btn: React.CSSProperties = {
    width: 26,
    height: 26,
    background: TK.surface,
    border: `1px solid ${TK.border}`,
    color: TK.muted,
    fontFamily: mono,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const z = (f: number) => setT((prev) => ({ ...prev, k: clamp(prev.k * f, 0.45, 3.0) }));
  return (
    <div style={{ position: 'absolute', right: 14, bottom: 14, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', zIndex: 3 }}>
      <button style={btn} onClick={() => z(1.2)} aria-label="Zoom in">+</button>
      <button style={btn} onClick={() => z(1 / 1.2)} aria-label="Zoom out">−</button>
      <button style={{ ...btn, fontSize: 8, letterSpacing: '0.1em' }} onClick={onFit}>FIT</button>
      <div style={{ fontFamily: mono, fontSize: 7, color: TK.dim, letterSpacing: '0.1em', marginTop: 2 }}>{Math.round(t.k * 100)}%</div>
    </div>
  );
};

export const TopoRadix: React.FC<TopoRadixProps> = ({
  model,
  centering,
  orderCover,
  selectedId,
  hoveredId,
  editorId,
  filter,
  selectedDepId,
  fitNonce,
  reduced,
  onSelect,
  onSelectDep,
  onHover,
  onOpen,
}) => {
  const layout = useMemo(() => radixLayout(model, centering), [model, centering]);
  const lineColor = useMemo(() => {
    const mm: Record<string, string> = {};
    model.lines.forEach((l) => (mm[l.id] = l.color));
    return mm;
  }, [model]);
  const m = useMemo(() => {
    const mm: Record<string, SimNode> = {};
    layout.nodes.forEach((n) => (mm[n.id] = n));
    return mm;
  }, [layout]);

  const computeFit = (vbW: number, vbH: number): Transform => fitNodes(layout.nodes, vbW, vbH, layout.canvas);
  const { containerRef, svgRef, box, t, setT, fit, dragging, handlers } = usePanZoom(computeFit, () => {
    onSelect(null);
    onSelectDep(null);
  });

  // ORGANISE / projection-switch → refit
  useEffect(() => {
    fit();
  }, [fitNonce]);

  const field = recenterField(model, centering, selectedId);
  const maxRank = centering.maxRank;
  const bandLabel = (rank: number) =>
    maxRank === 0 ? 'NO DEPENDENCY STRUCTURE YET' : rank === 0 ? 'RADIX · sources' : rank === maxRank ? 'TELOS · sinks' : `RANK ${rank}`;
  const poleColor = (rank: number) => (maxRank > 0 && (rank === 0 || rank === maxRank) ? TK.purple : TK.dim);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: TK.bgDeep, cursor: dragging ? 'grabbing' : 'grab' }}>
      <RadixGrid />
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${box.w} ${box.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
        onWheel={handlers.onWheel}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerLeave={handlers.onPointerUp}
      >
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          {layout.bands.map((band) => (
            <g key={band.rank}>
              <line x1={0} y1={band.y} x2={layout.canvas.w} y2={band.y} stroke={TK.border} strokeWidth={1} strokeDasharray="2 9" opacity={0.55} />
              <text x={14} y={band.y - 9} fontFamily={mono} fontSize={9} letterSpacing="0.16em" fontWeight={700} fill={poleColor(band.rank)}>
                {bandLabel(band.rank)}
              </text>
            </g>
          ))}

          {model.arcs.map((a) => {
            const dim = filter
              ? !(model.stationById[a.source]?.partId === filter || model.stationById[a.target]?.partId === filter)
              : field
                ? !field.arcInField(a)
                : false;
            return (
              <Route
                key={a.id}
                arc={a}
                m={m}
                health={model.health(a)}
                dim={dim}
                selected={a.id === selectedDepId}
                cover={orderCover.get(a.id)}
                onSelect={onSelectDep}
              />
            );
          })}

          {model.stations.map((s) => {
            const role = field ? field.role(s.id) : null;
            const dimmed = filter ? s.partId !== filter : role === 'unrelated';
            return (
              <Province
                key={s.id}
                s={s}
                node={m[s.id]}
                color={lineColor[s.partId] || TK.accent}
                selected={s.id === selectedId}
                hovered={s.id === hoveredId}
                dimmed={dimmed}
                isHere={s.id === editorId}
                reduced={reduced}
                fieldRole={role}
                onSelect={onSelect}
                onOpen={onOpen}
                onHover={onHover}
              />
            );
          })}

          {[...centering.radix, ...centering.telos].map((id) => {
            const n = m[id];
            if (!n) return null;
            return <PoleGlyph key={`pole-${id}`} x={n.x} y={n.y} r={n.r} kind={centering.byId[id].isRadix ? 'radix' : 'telos'} />;
          })}
        </g>
      </svg>
      <ZoomHud t={t} setT={setT} onFit={fit} />
    </div>
  );
};
