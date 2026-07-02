/* TopoParts.tsx — the PARTS projection (structural-parts ↔ sections).

   A bipartite map: the discovered StructuralParts down the LEFT, the sections
   they map onto down the RIGHT, membership edges between. The many-to-many
   mapping the heading grid cannot express reads at a glance — a part fanning to
   two sections SPANS them; a section fed by two parts is SHARED. Selecting a node
   lights just its edges + neighbours, so "which sections realise this move?" (and
   "which moves claim this section?") is one click. Static + deterministic (no
   force sim); ORGANISE/projection-switch just refits. The trigger is
   self-contained: a DISCOVER PARTS button lives on this surface. */

import React, { useEffect, useMemo } from 'react';
import type { StructuralPart } from '../../../types';
import type { TopoModel } from './topo-derive';
import { usePanZoom } from './usePanZoom';
import { fitNodes, type SimNode, type Transform } from './topo-sim-atlas';
import { derivePartsModel } from './topo-parts';
import { partsLayout } from './topo-layout-parts';
import { Province, Route } from './topo-marks';
import { TK } from './tk';

const mono = 'JetBrains Mono, monospace';

export interface TopoPartsProps {
  model: TopoModel;
  parts: StructuralPart[];
  selectedId: string | null;
  hoveredId: string | null;
  editorId: string | null;
  filter: string | null;
  selectedDepId: string | null;
  fitNonce: number;
  reduced: boolean;
  discovering: boolean;
  onSelect: (id: string | null) => void;
  onSelectDep: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  onDiscover: () => void;
}

const PartsGrid: React.FC = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }}>
    <defs>
      <pattern id="topo-parts-grid" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M46 0 L0 0 0 46" fill="none" stroke={TK.purple} strokeWidth="0.35" opacity="0.06" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#topo-parts-grid)" />
  </svg>
);

const DiscoverButton: React.FC<{ label: string; discovering: boolean; onDiscover: () => void }> = ({ label, discovering, onDiscover }) => (
  <button
    onClick={onDiscover}
    disabled={discovering}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      cursor: discovering ? 'default' : 'pointer',
      background: `rgba(170,0,255,0.10)`,
      border: `1px solid ${TK.purple}`,
      color: TK.purple,
      fontFamily: mono,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.14em',
      opacity: discovering ? 0.5 : 1,
      boxShadow: `0 0 12px rgba(170,0,255,0.25)`,
    }}
    title="Discover the argument's structural-functional parts via AI (whole document)"
  >
    <span style={{ width: 7, height: 7, background: TK.purple, transform: 'rotate(45deg)', ...(discovering ? { animation: 'hld-pulse 1s ease-in-out infinite' } : {}) }} />
    {discovering ? 'DISCOVERING…' : label}
  </button>
);

export const TopoParts: React.FC<TopoPartsProps> = ({
  model,
  parts,
  selectedId,
  hoveredId,
  editorId,
  filter,
  selectedDepId,
  fitNonce,
  reduced,
  discovering,
  onSelect,
  onSelectDep,
  onHover,
  onOpen,
  onDiscover,
}) => {
  const pm = useMemo(() => derivePartsModel(model, parts), [model, parts]);
  const layout = useMemo(() => partsLayout(pm), [pm]);
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

  // Adjacency over the membership edges, for click-to-light dimming.
  const adj = useMemo(() => {
    const mm: Record<string, Set<string>> = {};
    pm.arcs.forEach((a) => {
      (mm[a.source] ||= new Set()).add(a.target);
      (mm[a.target] ||= new Set()).add(a.source);
    });
    return mm;
  }, [pm]);
  const inField = (id: string): boolean => !selectedId || id === selectedId || !!adj[selectedId]?.has(id);

  const computeFit = (vbW: number, vbH: number): Transform => fitNodes(layout.nodes, vbW, vbH, layout.canvas);
  const { containerRef, svgRef, box, t, fit, dragging, handlers } = usePanZoom(computeFit, () => {
    onSelect(null);
    onSelectDep(null);
  });

  // ORGANISE / projection-switch → refit
  useEffect(() => {
    fit();
  }, [fitNonce]);

  const openIfSection = (id: string) => {
    if (model.stationById[id]) onOpen(id);
  };

  const columnHead = (x: number, label: string, count: number) => (
    <text x={x} y={40} textAnchor="middle" fontFamily={mono} fontSize={10} letterSpacing="0.18em" fontWeight={700} fill={TK.muted}>
      {label} · {count}
    </text>
  );

  const empty = pm.partStations.length === 0;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: TK.bgDeep, cursor: dragging ? 'grabbing' : 'grab' }}>
      <PartsGrid />

      {/* Self-contained trigger (top-centre). */}
      <div style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)', zIndex: 6 }}>
        <DiscoverButton label={empty ? 'DISCOVER PARTS' : 'RE-DISCOVER'} discovering={discovering} onDiscover={onDiscover} />
      </div>

      {empty ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: '0.14em',
            color: TK.muted,
            textAlign: 'center',
            padding: 24,
            pointerEvents: 'none',
          }}
        >
          <div style={{ maxWidth: 520, lineHeight: 1.8 }}>
            NO STRUCTURAL PARTS YET.
            <br />
            DISCOVER THE ARGUMENT&apos;S MOVES — SPANS, SUBDIVISIONS AND SHARED WHOLES THE HEADING GRID CANNOT SHOW.
          </div>
        </div>
      ) : (
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
            {columnHead(layout.partX, 'PARTS', pm.partStations.length)}
            {columnHead(layout.sectionX, 'SECTIONS', pm.sectionStations.length)}

            {pm.arcs.map((a) => {
              const dim =
                (filter ? model.stationById[a.target]?.partId !== filter : false) ||
                (selectedId ? !(a.source === selectedId || a.target === selectedId) : false);
              return (
                <Route
                  key={a.id}
                  arc={a}
                  m={m}
                  health="solid"
                  dim={dim}
                  selected={a.id === selectedDepId}
                  onSelect={onSelectDep}
                />
              );
            })}

            {pm.partStations.map((s) => (
              <Province
                key={s.id}
                s={s}
                node={m[s.id]}
                color={TK.purple}
                selected={s.id === selectedId}
                hovered={s.id === hoveredId}
                dimmed={!inField(s.id)}
                isHere={false}
                reduced={reduced}
                onSelect={onSelect}
                onOpen={openIfSection}
                onHover={onHover}
              />
            ))}

            {pm.sectionStations.map((s) => {
              const dimmed = (filter ? s.partId !== filter : false) || !inField(s.id);
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
                  onSelect={onSelect}
                  onOpen={openIfSection}
                  onHover={onHover}
                />
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
};
