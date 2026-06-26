/* TopoLand.tsx — the ATLAS projection (continental map).

   Sections are land; same-Part provinces merge (SVG metaball "goo" filter) into
   one continent; land area ∝ √words; unwritten sections are fog. Dependencies
   are the ONLY lines (transit routes). OPTIMISE runs a force-directed topology
   optimisation: the synchronous target is precomputed, then animated toward via
   rAF (with a setTimeout fallback so metrics settle even when rAF is throttled).
   Ported from the prototype topo-land.jsx. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TopoModel } from './topo-derive';
import { usePanZoom } from './usePanZoom';
import {
  buildInitial,
  canvasFor,
  clamp,
  coastColor,
  fitNodes,
  landColor,
  metrics,
  optimizeTarget,
  SEA,
  type Metrics,
  type SimNode,
  type Transform,
} from './topo-sim-atlas';
import { TK } from './tk';
import { Province, Route, PoleGlyph } from './topo-marks';
import { recenterField, type Centering } from './topo-centering';

const mono = 'JetBrains Mono, monospace';

export interface TopoLandProps {
  model: TopoModel;
  centering: Centering;
  selectedId: string | null;
  hoveredId: string | null;
  editorId: string | null;
  filter: string | null;
  selectedDepId: string | null;
  organizeNonce: number;
  reduced: boolean;
  onSelect: (id: string | null) => void;
  onSelectDep: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  onMetrics: (m: Metrics) => void;
  onOptRun: (running: boolean) => void;
}

const LandDefs: React.FC = () => (
  <defs>
    <filter id="topo-goo">
      <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b" />
      <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" result="g" />
      <feComposite in="SourceGraphic" in2="g" operator="atop" />
    </filter>
    <filter id="topo-land-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="b" />
      <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
    </filter>
  </defs>
);

const SeaGrid: React.FC = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }}>
    <defs>
      <pattern id="topo-sea-grid" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M46 0 L0 0 0 46" fill="none" stroke={TK.accent} strokeWidth="0.35" opacity="0.08" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#topo-sea-grid)" />
  </svg>
);

// ── continent rendering (metaball merge per Part) ───────────────────
const Continent: React.FC<{ partId: string; color: string; nodes: SimNode[]; dim: boolean; focus: boolean }> = ({
  partId,
  color,
  nodes,
  dim,
  focus,
}) => {
  const ns = nodes.filter((n) => n.part === partId);
  if (!ns.length) return null;
  const land = landColor(color);
  const coast = coastColor(color);
  return (
    <g opacity={dim ? 0.12 : 1} style={{ transition: 'opacity 0.45s' }}>
      <g filter="url(#topo-land-glow)" opacity={focus ? TK.glow.halo * 0.8 : 0.4}>
        {ns.map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={n.r + 10} fill={coast} />
        ))}
      </g>
      <g filter="url(#topo-goo)">
        {ns.map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={n.r + 3.5} fill={coast} opacity="0.85" />
        ))}
      </g>
      <g filter="url(#topo-goo)">
        {ns.map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={n.r} fill={land} />
        ))}
      </g>
      <g filter="url(#topo-goo)" opacity="0.18">
        {ns.map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r={n.r - 1} fill={coast} />
        ))}
      </g>
    </g>
  );
};

const ContinentLabels: React.FC<{ model: TopoModel; m: Record<string, SimNode>; filter: string | null; selectedId: string | null }> = ({
  model,
  m,
  filter,
  selectedId,
}) => {
  const selPart = selectedId ? model.stationById[selectedId]?.partId : null;
  return (
    <>
      {model.lines.map((line) => {
        const ns = line.stationIds.map((id) => m[id]).filter(Boolean) as SimNode[];
        if (!ns.length) return null;
        const cxv = ns.reduce((a, n) => a + n.x, 0) / ns.length;
        const top = Math.min(...ns.map((n) => n.y - n.r));
        const dim = filter ? line.id !== filter : selPart ? selPart !== line.id : false;
        return (
          <g key={line.id} transform={`translate(${cxv},${top - 16})`} style={{ pointerEvents: 'none', opacity: dim ? 0.25 : 1, transition: 'opacity 0.45s' }}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fontFamily={mono}
              fontSize="10.5"
              fontWeight="800"
              letterSpacing="0.16em"
              fill={line.color}
              style={{ paintOrder: 'stroke', stroke: SEA, strokeWidth: 4 }}
            >
              {line.num} · {line.label}
            </text>
          </g>
        );
      })}
    </>
  );
};

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

export const TopoLand: React.FC<TopoLandProps> = ({
  model,
  centering,
  selectedId,
  hoveredId,
  editorId,
  filter,
  selectedDepId,
  organizeNonce,
  reduced,
  onSelect,
  onSelectDep,
  onHover,
  onOpen,
  onMetrics,
  onOptRun,
}) => {
  const canvas = useMemo(() => canvasFor(model), [model]);
  const lineColor = useMemo(() => {
    const mm: Record<string, string> = {};
    model.lines.forEach((l) => (mm[l.id] = l.color));
    return mm;
  }, [model]);

  // initial landscape (continents compacted in chapter order, synchronous)
  const nodesRef = useRef<SimNode[] | null>(null);
  if (!nodesRef.current) nodesRef.current = buildInitial(model, canvas);

  const [nodes, setNodes] = useState<SimNode[]>(nodesRef.current);
  const raf = useRef<number>(0);
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const computeFit = (vbW: number, vbH: number): Transform => fitNodes(nodesRef.current ?? [], vbW, vbH, canvas);
  const { containerRef, svgRef, box, t, setT, fit, dragging, handlers } = usePanZoom(computeFit, () => {
    onSelect(null);
    onSelectDep(null);
  });

  // keep latest transform/box for the (organizeNonce-only) optimise effect
  const tRef = useRef(t);
  tRef.current = t;
  const boxRef = useRef(box);
  boxRef.current = box;

  // report metrics on mount + whenever dependencies change (positions unchanged)
  useEffect(() => {
    onMetrics(metrics(nodesRef.current ?? [], model.arcs));
  }, [model]);

  // OPTIMISE → topology optimisation (precompute target synchronously, animate)
  useEffect(() => {
    if (!organizeNonce) return;
    cancelAnimationFrame(raf.current);
    if (fallback.current) clearTimeout(fallback.current);
    const startNodes = (nodesRef.current ?? []).map((n) => ({ ...n }));
    const target = optimizeTarget(nodesRef.current ?? [], model.arcs, canvas);
    nodesRef.current = target;
    onMetrics(metrics(target, model.arcs));
    onOptRun(true);

    const D = 1300;
    const t0 = performance.now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    const t1 = { ...tRef.current };
    const t2 = fitNodes(target, boxRef.current.w, boxRef.current.h, canvas);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setNodes(target.map((n) => ({ ...n })));
      setT(t2);
      onOptRun(false);
    };
    const frame = () => {
      const now = performance.now();
      const f = ease(clamp((now - t0) / D, 0, 1));
      const disp = startNodes.map((s, i) => ({
        ...target[i],
        x: s.x + (target[i].x - s.x) * f,
        y: s.y + (target[i].y - s.y) * f,
      }));
      setNodes(disp);
      setT({ k: t1.k + (t2.k - t1.k) * f, x: t1.x + (t2.x - t1.x) * f, y: t1.y + (t2.y - t1.y) * f });
      if (f < 1) raf.current = requestAnimationFrame(frame);
      else finish();
    };
    raf.current = requestAnimationFrame(frame);
    fallback.current = setTimeout(finish, D + 350);
    return () => {
      cancelAnimationFrame(raf.current);
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, [organizeNonce]);

  const m = useMemo(() => {
    const mm: Record<string, SimNode> = {};
    nodes.forEach((n) => (mm[n.id] = n));
    return mm;
  }, [nodes]);

  const selPart = selectedId ? model.stationById[selectedId]?.partId ?? null : null;
  // recentre the whole field on the selected node (transitive, not 1-hop)
  const field = recenterField(model, centering, selectedId);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: TK.bgDeep, cursor: dragging ? 'grabbing' : 'grab' }}>
      <SeaGrid />
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
        <LandDefs />
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          {model.lines.map((line) => (
            <Continent
              key={line.id}
              partId={line.id}
              color={line.color}
              nodes={nodes}
              dim={filter ? line.id !== filter : false}
              focus={filter ? line.id === filter : selPart ? selPart === line.id : false}
            />
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
                backward={centering.backwardArcs.has(a.id)}
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

          <ContinentLabels model={model} m={m} filter={filter} selectedId={selectedId} />
        </g>
      </svg>
      <ZoomHud t={t} setT={setT} onFit={fit} />
    </div>
  );
};
