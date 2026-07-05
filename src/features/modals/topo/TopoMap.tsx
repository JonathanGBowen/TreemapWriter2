/* TopoMap.tsx — the SPINE projection (metro schematic).

   Pan/zoom SVG: optional structural ghost underlay, Part lines (the spine,
   thick & arrow-less), directed dependency arcs (the editable cyan topology),
   stations, and a "YOU ARE HERE" marker on the section open in the editor.
   Ported from the prototype topo-map.jsx; positions come from layoutSpine. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TopoModel, Arc, Station as StationT } from './topo-derive';
import { statusMeta } from './topo-derive';
import { layoutSpine, lineTrackPath, depGeom, depMidpoint, type XY } from './topo-layout-spine';
import { usePanZoom } from './usePanZoom';
import { clamp, type Transform } from './topo-sim-atlas';
import { TK } from './tk';
import { PoleGlyph } from './topo-marks';
import { OrderMarks, type StrategyChoice } from './topo-order-marks';
import { recenterField, type Centering, type FieldRole } from './topo-centering';
import type { CommutableRun, PrecedenceCycle, PrecedenceViolation } from '../../../lib/precedence';

const mono = 'JetBrains Mono, monospace';

// upstream (rests-on) reads cyan like DEPENDS ON; downstream (rests-on-this) green like FEEDS.
const fieldRing = (role: FieldRole | null | undefined): string | null =>
  role === 'upstream' ? TK.accent : role === 'downstream' ? TK.green : null;

export interface TopoMapProps {
  model: TopoModel;
  centering: Centering;
  /** Per-backward-arc order verdict (Phase 5): 'covered' → neutral bridge, 'uncovered' → warning chevron. */
  orderCover: Map<string, 'covered' | 'uncovered'>;
  /** SPINE order-diagnostics (Phase 5) — the part-level engine results + their actions. */
  graspStationOf: Map<string, string>;
  violations: PrecedenceViolation[];
  commutable: CommutableRun[];
  cycles: PrecedenceCycle[];
  claimOf: (partId: string) => string;
  onDeclareHeap: (sectionId: string, partIds: string[]) => void;
  onStrategy: (cycle: PrecedenceCycle, choice: StrategyChoice) => void;
  selectedId: string | null;
  hoveredId: string | null;
  editorId: string | null;
  filter: string | null;
  selectedDepId: string | null;
  fitNonce: number;
  showGhost: boolean;
  reduced: boolean;
  /** Commit a drag-reorder (Phase 6): move `fromId` before/after `toId`. */
  onMoveSection: (fromId: string, toId: string, position: 'before' | 'after') => void;
  /** Report the provisional dragged-station docIndex for live admissibility (null when idle). */
  onDragPreview: (preview: { id: string; docIndex: number } | null) => void;
  onSelect: (id: string | null) => void;
  onSelectDep: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}

// ── Part line — the structural spine (thick, no arrows) ─────────────
const PartLine: React.FC<{ d: string; color: string; dim: boolean; focus: boolean }> = ({
  d,
  color,
  dim,
  focus,
}) => (
  <g opacity={dim ? 0.1 : 1} style={{ transition: 'opacity 0.4s' }}>
    {focus && (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={TK.glow.halo * 0.6}
        style={{ filter: 'blur(6px)' }}
      />
    )}
    <path d={d} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

// ── Dependency arc — directed transfer (thin, arrowhead, cyan layer) ─
const DepArc: React.FC<{
  arc: Arc;
  pos: Record<string, XY>;
  health: 'solid' | 'weak' | 'broken';
  dim: boolean;
  selected: boolean;
  cover?: 'covered' | 'uncovered';
  onSelect: (id: string) => void;
}> = ({ arc, pos, health, dim, selected, cover, onSelect }) => {
  const geom = depGeom(arc, pos);
  const mid = depMidpoint(arc, pos);
  if (!geom || !mid) return null;
  const ref = arc.type === 'reference';
  const base = health === 'broken' ? TK.magenta : health === 'weak' ? TK.yellow : TK.accent;
  const dash = ref ? '9 7' : health === 'weak' ? '3 7' : undefined;
  return (
    <g
      opacity={dim ? 0.12 : 1}
      style={{ transition: 'opacity 0.4s', cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(arc.id);
      }}
    >
      <path d={geom.d} fill="none" stroke="transparent" strokeWidth={18} />
      {selected && (
        <path
          d={geom.d}
          fill="none"
          stroke={TK.accent}
          strokeWidth={7}
          strokeLinecap="round"
          opacity={0.28}
          style={{ filter: 'blur(3px)' }}
        />
      )}
      <path
        d={geom.d}
        fill="none"
        stroke={base}
        strokeWidth={selected ? 3 : 2.2}
        strokeOpacity={health === 'broken' ? 0.92 : 1}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
      <g transform={`translate(${geom.arrow.x},${geom.arrow.y}) rotate(${geom.arrow.angle})`}>
        <path d="M0,0 L-9,-5 L-9,5 Z" fill={base} />
      </g>
      {cover === 'uncovered' && (
        // an UNCOVERED read-ahead: the prerequisite sits after its dependent with
        // nothing licensing the inversion — the genuine warning (magenta chevron).
        <g transform={`translate(${mid.x},${mid.y}) rotate(${geom.arrow.angle})`}>
          <path d="M0,0 L11,-5 L11,5 Z" fill="none" stroke={TK.magenta} strokeWidth="1.5" />
        </g>
      )}
      {cover === 'covered' && (
        // a COVERED inversion (a deliberate gap-before-filling, or an open IOU) —
        // the neutral purple bridge glyph spanning the gap, not a violation.
        <g transform={`translate(${mid.x},${mid.y})`}>
          <path d="M-8,3 Q0,-8 8,3" fill="none" stroke={TK.purple} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
      {health === 'broken' && (
        <g transform={`translate(${mid.x},${mid.y})`}>
          <circle r="9" fill={TK.bg} stroke={TK.magenta} strokeWidth="1.6" />
          <path
            d="M-3.6,-3.6 L3.6,3.6 M3.6,-3.6 L-3.6,3.6"
            stroke={TK.magenta}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
};

// ── Station ─────────────────────────────────────────────────────────
const Station: React.FC<{
  s: StationT;
  p: XY;
  color: string;
  interchange: boolean;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  reduced: boolean;
  fieldRole?: FieldRole | null;
  beingDragged: boolean;
  onDragDown: (id: string, e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragUp: (e: React.PointerEvent) => boolean; // true if it was a real drag (moved)
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onHover: (id: string | null) => void;
}> = ({ s, p, color, interchange, selected, hovered, dimmed, reduced, fieldRole, beingDragged, onDragDown, onDragMove, onDragUp, onSelect, onOpen, onHover }) => {
  const meta = statusMeta(s.status);
  const r = 13;
  const ring = selected ? TK.accent : color;
  const fr = fieldRing(fieldRole);
  const lx = s.labelDir === 'left' ? -(r + 12) : r + 12;
  const anchor = s.labelDir === 'left' ? 'end' : 'start';
  return (
    <g
      transform={`translate(${p.x},${p.y})`}
      style={{ cursor: beingDragged ? 'grabbing' : 'grab', opacity: dimmed ? 0.26 : beingDragged ? 0.85 : 1, transition: beingDragged ? 'none' : 'opacity 0.4s' }}
      // Drag to reorder (Phase 6); stopPropagation keeps the background pan from firing.
      // A clean press (no move) selects; a real drag commits a move on release.
      onPointerDown={(e) => onDragDown(s.id, e)}
      onPointerMove={(e) => onDragMove(e)}
      onPointerUp={(e) => {
        if (!onDragUp(e)) onSelect(s.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen(s.id);
      }}
      onPointerEnter={() => onHover(s.id)}
      onPointerLeave={() => onHover(null)}
    >
      {selected &&
        (reduced ? (
          <circle r={r + 9} fill="none" stroke={TK.accent} strokeWidth="1.2" strokeDasharray="3 4" opacity="0.9" />
        ) : (
          <circle r={r + 9} fill="none" stroke={TK.accent} strokeWidth="1.2" strokeDasharray="3 4" opacity="0.9">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur="18s"
              repeatCount="indefinite"
            />
          </circle>
        ))}
      {hovered && !selected && <circle r={r + 7} fill="none" stroke={TK.accent} strokeWidth="1" opacity="0.45" />}
      {fr && !selected && <circle r={r + 6} fill="none" stroke={fr} strokeWidth="1.4" opacity="0.7" />}
      {interchange && <circle r={r + 4} fill={TK.bg} stroke={ring} strokeWidth="2" />}
      {s.fog ? (
        <circle r={r} fill={TK.bgDeep} stroke={ring} strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />
      ) : (
        <circle
          r={r}
          fill={TK.surface}
          stroke={ring}
          strokeWidth={selected ? 3 : 2.4}
          style={{ filter: selected ? `drop-shadow(0 0 ${8 * TK.glow.halo + 3}px ${TK.accent})` : 'none' }}
        />
      )}
      <circle r={5} fill={meta.c} style={{ filter: `drop-shadow(0 0 4px ${meta.c})` }} />
      <g transform={`translate(${lx},0)`} style={{ pointerEvents: 'none' }}>
        <text
          x="0"
          y="-4"
          textAnchor={anchor}
          fontFamily={mono}
          fontSize="12.5"
          fontWeight="800"
          letterSpacing="0.04em"
          fill={selected ? TK.accent : TK.textHi}
        >
          {s.sym}
        </text>
        <text x="0" y="10" textAnchor={anchor} fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600" fill={selected ? TK.text : TK.muted}>
          {s.short}
        </text>
        <text x="0" y="22" textAnchor={anchor} fontFamily={mono} fontSize="8" letterSpacing="0.12em" fill={meta.c} opacity="0.9">
          {s.words}W · {meta.label}
        </text>
      </g>
    </g>
  );
};

// ── "You are here" — the section open in the editor behind the modal ─
const YouMarker: React.FC<{ p: XY | undefined; reduced: boolean }> = ({ p, reduced }) => {
  if (!p) return null;
  return (
    <g transform={`translate(${p.x},${p.y})`} style={{ pointerEvents: 'none' }}>
      <g style={{ filter: `drop-shadow(0 0 6px ${TK.accent})` }}>
        {reduced ? (
          <circle r="22" fill="none" stroke={TK.accent} strokeWidth="1.4" strokeDasharray="3 5" opacity="0.85" />
        ) : (
          <circle r="22" fill="none" stroke={TK.accent} strokeWidth="1.4" strokeDasharray="3 5" opacity="0.85">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="12s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
      <g transform="translate(26,-24)">
        <rect x="0" y="-9" width="92" height="16" fill={TK.surface} stroke={TK.accent} strokeWidth="0.6" opacity="0.97" />
        <text x="7" y="2.5" fontFamily={mono} fontSize="8" letterSpacing="0.14em" fontWeight="700" fill={TK.accent}>
          YOU ARE HERE
        </text>
      </g>
    </g>
  );
};

const MapGrid: React.FC = () => (
  <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }}>
    <defs>
      <pattern id="topo-grid" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M46 0 L0 0 0 46" fill="none" stroke={TK.accent} strokeWidth="0.35" opacity="0.1" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#topo-grid)" />
  </svg>
);

// Lightweight structural treemap underlay (slice-and-dice: columns per Part by
// total words, rows per section by words). A faint spatial-memory aid.
const GhostLayer: React.FC<{ model: TopoModel }> = ({ model }) => {
  const totalWords = Math.max(1, model.lines.reduce((a, l) => a + l.stationIds.reduce((b, id) => b + (model.stationById[id]?.words || 1), 0), 0));
  let cx = 0;
  return (
    <div style={{ position: 'absolute', inset: 34, opacity: 0.07, filter: 'saturate(0.5)', pointerEvents: 'none' }} aria-hidden="true">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {model.lines.map((line) => {
          const partWords = Math.max(1, line.stationIds.reduce((b, id) => b + (model.stationById[id]?.words || 1), 0));
          const w = (partWords / totalWords) * 100;
          const x = cx;
          cx += w;
          let cy = 0;
          return (
            <g key={line.id}>
              {line.stationIds.map((id) => {
                const words = model.stationById[id]?.words || 1;
                const h = (words / partWords) * 100;
                const y = cy;
                cy += h;
                return <rect key={id} x={x + 0.4} y={y + 0.4} width={Math.max(0, w - 0.8)} height={Math.max(0, h - 0.8)} fill={line.color} stroke={line.color} strokeWidth="0.2" opacity={0.5} />;
              })}
            </g>
          );
        })}
      </svg>
    </div>
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

export const TopoMap: React.FC<TopoMapProps> = ({
  model,
  centering,
  orderCover,
  graspStationOf,
  violations,
  commutable,
  cycles,
  claimOf,
  onDeclareHeap,
  onStrategy,
  onMoveSection,
  onDragPreview,
  selectedId,
  hoveredId,
  editorId,
  filter,
  selectedDepId,
  fitNonce,
  showGhost,
  reduced,
  onSelect,
  onSelectDep,
  onHover,
  onOpen,
}) => {
  const [openCycle, setOpenCycle] = useState<number | null>(null);
  const layout = useMemo(() => layoutSpine(model), [model]);
  const pos = layout.pos;
  const lineColor = useMemo(() => {
    const m: Record<string, string> = {};
    model.lines.forEach((l) => (m[l.id] = l.color));
    return m;
  }, [model]);

  const computeFit = (vbW: number, vbH: number): Transform => {
    const W = Math.max(1, layout.width);
    const H = Math.max(1, layout.height);
    const k = clamp(Math.min(vbW / W, vbH / H), 0.4, 2.2);
    return { k, x: vbW / 2 - (W / 2) * k, y: vbH / 2 - (H / 2) * k };
  };

  const { containerRef, svgRef, box, t, setT, fit, dragging, handlers } = usePanZoom(computeFit, () => {
    onSelect(null);
    onSelectDep(null);
    setOpenCycle(null);
  });

  // ORGANISE / projection-switch → refit
  useEffect(() => {
    fit();
  }, [fitNonce]);

  const selPart = selectedId ? model.stationById[selectedId]?.partId ?? null : null;
  // recentre the whole field on the selected node (transitive, not 1-hop)
  const field = recenterField(model, centering, selectedId);

  const lineDim = (id: string) => (filter ? id !== filter : selPart ? id !== selPart : false);
  const lineFocus = (id: string) => (filter ? id === filter : selPart ? id === selPart : false);

  // ── Drag-to-reorder (Phase 6) ─────────────────────────────────────
  // A station drag re-slots it within its Part column; a provisional pos makes the
  // track/arcs/ticks follow, and a provisional docIndex drives live admissibility.
  const dragRef = useRef<{ id: string; startY: number; moved: boolean } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; worldY: number } | null>(null);

  const worldYOf = (clientY: number): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0;
    return (((clientY - rect.top) / rect.height) * box.h - t.y) / t.k;
  };
  /** The dragged station's drop target within its column, from a world-Y. */
  const dropTargetFor = (id: string, worldY: number): { targetId: string; position: 'before' | 'after' } | null => {
    const partId = model.stationById[id]?.partId;
    const line = model.lines.find((l) => l.id === partId);
    if (!line) return null;
    const others = line.stationIds.filter((x) => x !== id);
    if (others.length === 0) return null;
    let idx = 0;
    for (const oid of others) if ((pos[oid]?.y ?? 0) < worldY) idx += 1;
    if (idx >= others.length) return { targetId: others[others.length - 1], position: 'after' };
    return { targetId: others[idx], position: 'before' };
  };
  const previewFor = (id: string, worldY: number): { id: string; docIndex: number } | null => {
    const drop = dropTargetFor(id, worldY);
    if (!drop) return null;
    const targetDoc = model.stationById[drop.targetId]?.docIndex ?? 0;
    return { id, docIndex: drop.position === 'before' ? targetDoc - 0.5 : targetDoc + 0.5 };
  };

  const onDragDown = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // keep the background pan from firing
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, startY: e.clientY, moved: false };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientY - d.startY) < 4) return;
    d.moved = true;
    const worldY = worldYOf(e.clientY);
    setDragState({ id: d.id, worldY });
    onDragPreview(previewFor(d.id, worldY));
  };
  const onDragUp = (e: React.PointerEvent): boolean => {
    const d = dragRef.current;
    dragRef.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    setDragState(null);
    onDragPreview(null);
    if (!d || !d.moved) return false;
    const drop = dropTargetFor(d.id, worldYOf(e.clientY));
    if (drop && drop.targetId !== d.id) onMoveSection(d.id, drop.targetId, drop.position);
    return true;
  };

  // Provisional positions during a drag — the dragged station follows the pointer;
  // the track / arcs / order-marks all re-read this map, so they follow live.
  const livePos = dragState ? { ...pos, [dragState.id]: { x: pos[dragState.id]?.x ?? 0, y: dragState.worldY } } : pos;

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: TK.bgDeep, cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <MapGrid />
      {showGhost && <GhostLayer model={model} />}
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
          {model.lines.map((l) => (
            <PartLine key={l.id} d={lineTrackPath(l.stationIds, livePos)} color={l.color} dim={lineDim(l.id)} focus={lineFocus(l.id)} />
          ))}

          {model.arcs.map((a) => {
            const dim = filter
              ? !(model.stationById[a.source]?.partId === filter || model.stationById[a.target]?.partId === filter)
              : field
                ? !field.arcInField(a)
                : false;
            return (
              <DepArc
                key={a.id}
                arc={a}
                pos={livePos}
                health={model.health(a)}
                dim={dim}
                selected={a.id === selectedDepId}
                cover={orderCover.get(a.id)}
                onSelect={onSelectDep}
              />
            );
          })}

          {model.stations.map((s) => {
            const p = livePos[s.id];
            if (!p) return null;
            const role = field ? field.role(s.id) : null;
            const dimmed = filter ? s.partId !== filter : role === 'unrelated';
            return (
              <Station
                key={s.id}
                s={s}
                p={p}
                color={lineColor[s.partId] || TK.accent}
                interchange={model.interchange.has(s.id)}
                selected={s.id === selectedId}
                hovered={s.id === hoveredId}
                dimmed={dimmed}
                reduced={reduced}
                fieldRole={role}
                beingDragged={dragState?.id === s.id}
                onDragDown={onDragDown}
                onDragMove={onDragMove}
                onDragUp={onDragUp}
                onSelect={onSelect}
                onOpen={onOpen}
                onHover={onHover}
              />
            );
          })}

          {[...centering.radix, ...centering.telos].map((id) => {
            const p = livePos[id];
            if (!p) return null;
            return <PoleGlyph key={`pole-${id}`} x={p.x} y={p.y} r={13} kind={centering.byId[id].isRadix ? 'radix' : 'telos'} />;
          })}

          <OrderMarks
            pos={livePos}
            graspStationOf={graspStationOf}
            violations={violations}
            commutable={commutable}
            cycles={cycles}
            claimOf={claimOf}
            openCycle={openCycle}
            onToggleCycle={setOpenCycle}
            onDeclareHeap={onDeclareHeap}
            onStrategy={onStrategy}
          />

          <YouMarker p={editorId ? livePos[editorId] : undefined} reduced={reduced} />
        </g>
      </svg>
      <ZoomHud t={t} setT={setT} onFit={fit} />
    </div>
  );
};
