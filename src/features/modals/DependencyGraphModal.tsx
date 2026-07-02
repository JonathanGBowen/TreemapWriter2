/* DependencyGraphModal.tsx — the Argument Topology modal.

   A true modal over the dimmed editor (same framing as before). Two projections
   of the same data, switchable from an ATLAS / SPINE toggle:
     • ATLAS — sections as continents, dependencies as transit routes, with a
       force-directed OPTIMISE that shortens routes (live ROUTE LENGTH +
       CROSSINGS readout).
     • SPINE — Parts as coloured metro lines, dependencies as directed arcs.

   All dependency edits route through the existing updateDependencies action and
   surface sonner toasts, exactly as the previous React-Flow modal did. The two
   bespoke SVG surfaces, the data derivation, the force sim and the inspector
   live under ./topo. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Section, TestSuite, Dependency } from '../../types';
import { toast } from 'sonner';
import { useStore } from '../../store';

import { deriveTopo } from './topo/topo-derive';
import type { Metrics } from './topo/topo-sim-atlas';
import { computeCentering, type Centering } from './topo/topo-centering';
import { TopoLand } from './topo/TopoLand';
import { TopoMap } from './topo/TopoMap';
import { TopoRadix } from './topo/TopoRadix';
import { TopoParts } from './topo/TopoParts';
import { Inspector } from './topo/Inspector';
import { LegendKey } from './topo/LegendKey';
import { StructuralReadout } from './topo/StructuralReadout';
import { useReducedMotion } from './topo/useReducedMotion';
import { TK } from './topo/tk';
import { AtlasGlyph, CloseGlyph, NetworkGlyph, PartsGlyph, RadixGlyph, RefreshGlyph, SpineGlyph, WandGlyph } from './topo/icons';
import { useStructuralPartsActions } from '../structure/use-structural-parts-actions';
import { recomputeStructuralStale } from '../../lib/structural-part-helpers';

interface DependencyGraphModalProps {
  sections: Section[];
  testSuite: TestSuite;
  updateDependencies: (id: string, deps: Dependency[]) => void;
  onEstimateDependencies?: () => Promise<void>;
}

const mono = 'JetBrains Mono, monospace';
type Projection = 'atlas' | 'spine' | 'radix' | 'parts';

// ── header ──────────────────────────────────────────────────────────
const ProjectionToggle: React.FC<{ mode: Projection; setMode: (m: Projection) => void }> = ({ mode, setMode }) => {
  const opt = (id: Projection, label: string, glyph: React.ReactNode, title: string, border: boolean) => {
    const on = mode === id;
    return (
      <button
        onClick={() => setMode(id)}
        title={title}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 11px',
          cursor: 'pointer',
          background: on ? `rgba(${TK.accentGlow},0.14)` : 'transparent',
          border: 'none',
          borderRight: border ? `1px solid ${TK.border}` : 'none',
          color: on ? TK.accent : TK.muted,
          fontFamily: mono,
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: '0.12em',
        }}
      >
        {glyph} {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${TK.border}`, marginRight: 2 }}>
      {opt('atlas', 'ATLAS', <AtlasGlyph c={mode === 'atlas' ? TK.accent : TK.muted} />, 'Sections as land, dependencies as routes', true)}
      {opt('radix', 'RADIX', <RadixGlyph c={mode === 'radix' ? TK.accent : TK.muted} />, 'Sections by structural rank — radix (source) at top, telos (sink) at bottom', true)}
      {opt('spine', 'SPINE', <SpineGlyph c={mode === 'spine' ? TK.accent : TK.muted} />, 'Parts as lines, dependencies as arcs', true)}
      {opt('parts', 'PARTS', <PartsGlyph c={mode === 'parts' ? TK.accent : TK.muted} />, 'Structural-functional parts mapped onto the sections they span, subdivide, or share', false)}
    </div>
  );
};

const Header: React.FC<{
  mode: Projection;
  setMode: (m: Projection) => void;
  estimating: boolean;
  optimizing: boolean;
  canEstimate: boolean;
  onEstimate: () => void;
  onOrganize: () => void;
  onClose: () => void;
}> = ({ mode, setMode, estimating, optimizing, canEstimate, onEstimate, onOrganize, onClose }) => {
  const actBtn = (color: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 12px',
    cursor: 'pointer',
    background: 'transparent',
    border: `1px solid ${color}`,
    color,
    fontFamily: mono,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.14em',
  });
  return (
    <header
      style={{
        flexShrink: 0,
        height: 70,
        display: 'flex',
        alignItems: 'center',
        padding: '0 22px',
        gap: 14,
        borderBottom: `1px solid ${TK.border}`,
        background: TK.surface,
        position: 'relative',
        zIndex: 20,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          flexShrink: 0,
          border: `1px solid rgba(${TK.accentGlow},0.4)`,
          background: `rgba(${TK.accentGlow},0.08)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 ${10 * TK.glow.edge}px rgba(${TK.accentGlow},0.3)`,
        }}
      >
        <NetworkGlyph c={TK.accent} size={24} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 800, color: TK.textHi, letterSpacing: '0.22em', textShadow: `0 0 10px rgba(${TK.accentGlow},0.4)` }}>
          ARGUMENT TOPOLOGY
        </div>
        <div style={{ fontFamily: mono, fontSize: 8, color: TK.accent, letterSpacing: '0.18em', marginTop: 4, opacity: 0.85 }}>
          STRUCTURAL &amp; LOGICAL DEPENDENCIES
        </div>
      </div>
      <ProjectionToggle mode={mode} setMode={setMode} />
      {canEstimate && (
        <button onClick={onEstimate} disabled={estimating} style={{ ...actBtn(TK.magenta), opacity: estimating ? 0.5 : 1 }} title="Auto-estimate dependencies via AI">
          ESTIMATE <WandGlyph c={TK.magenta} />
        </button>
      )}
      <button
        onClick={onOrganize}
        disabled={optimizing}
        style={{
          ...actBtn(TK.accent),
          opacity: optimizing ? 0.5 : 1,
          ...(mode === 'atlas' ? { background: `rgba(${TK.accentGlow},0.10)`, boxShadow: `0 0 ${10 * TK.glow.edge}px rgba(${TK.accentGlow},0.3)` } : {}),
        }}
        title={
          mode === 'atlas'
            ? 'Optimise the landscape against the dependency graph'
            : mode === 'spine'
              ? 'Re-run auto layout'
              : mode === 'radix'
                ? 'Fit the rank layout to view'
                : 'Fit the parts layout to view'
        }
      >
        {mode === 'atlas' ? 'OPTIMISE' : mode === 'spine' ? 'ORGANISE' : 'FIT'} <RefreshGlyph c={TK.accent} />
      </button>
      <button
        onClick={onClose}
        title="Close (Esc)"
        style={{ width: 36, height: 36, marginLeft: 2, cursor: 'pointer', background: 'transparent', border: `1px solid ${TK.border}`, color: TK.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <CloseGlyph />
      </button>
    </header>
  );
};

// ── filter bar ──────────────────────────────────────────────────────
const MiniToggle: React.FC<{ on: boolean; setOn: (v: boolean) => void; label: string }> = ({ on, setOn, label }) => (
  <button
    onClick={() => setOn(!on)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 9px',
      cursor: 'pointer',
      background: 'transparent',
      border: `1px solid ${on ? `rgba(${TK.accentGlow},0.4)` : TK.border}`,
      fontFamily: mono,
      fontSize: 7.5,
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: on ? TK.accent : TK.muted,
      flexShrink: 0,
    }}
  >
    <span style={{ width: 16, height: 9, borderRadius: 5, background: on ? `rgba(${TK.accentGlow},0.3)` : TK.border, position: 'relative', display: 'inline-block' }}>
      <span style={{ position: 'absolute', top: 1, left: on ? 8 : 1, width: 7, height: 7, borderRadius: '50%', background: on ? TK.accent : TK.muted, transition: 'left 0.2s', boxShadow: on ? `0 0 4px ${TK.accent}` : 'none' }} />
    </span>
    {label}
  </button>
);

const FilterBar: React.FC<{
  mode: Projection;
  lines: { id: string; num: string; label: string; sub: string; color: string }[];
  filter: string | null;
  setFilter: (id: string | null) => void;
  land: Metrics;
  ghost: boolean;
  setGhost: (v: boolean) => void;
  centering: Centering;
}> = ({ mode, lines, filter, setFilter, land, ghost, setGhost, centering }) => {
  const atlas = mode === 'atlas';
  const dotChip = mode !== 'spine'; // ATLAS + RADIX + PARTS use round Part chips; SPINE uses a track
  const heading = mode === 'atlas' ? 'CONTINENTS' : mode === 'radix' ? 'PARTS' : mode === 'parts' ? 'SECTIONS' : 'LINES';
  return (
    <div
      style={{
        flexShrink: 0,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 10,
        borderBottom: `1px solid ${TK.border}`,
        background: TK.surface2,
        position: 'relative',
        zIndex: 8,
      }}
    >
      <div style={{ fontFamily: mono, fontSize: 8, color: TK.accent, letterSpacing: '0.18em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ width: 5, height: 5, background: TK.accent, transform: 'rotate(45deg)', boxShadow: `0 0 4px ${TK.accent}` }} />
        {heading}
      </div>
      <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, overflowX: 'auto' }}>
        {lines.map((l) => {
          const active = filter === l.id;
          const off = !!filter && !active;
          return (
            <button
              key={l.id}
              onClick={() => setFilter(active ? null : l.id)}
              title={l.sub}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 10px',
                cursor: 'pointer',
                flexShrink: 0,
                background: active ? `rgba(${TK.accentGlow},0.10)` : 'transparent',
                border: `1px solid ${active ? l.color : TK.border}`,
                opacity: off ? 0.4 : 1,
              }}
            >
              {dotChip ? (
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: l.color, boxShadow: `0 0 5px ${l.color}`, flexShrink: 0 }} />
              ) : (
                <svg width="20" height="8">
                  <path d="M1 4 L19 4" stroke={l.color} strokeWidth="4" strokeLinecap="round" />
                </svg>
              )}
              <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: active ? l.color : TK.muted }}>
                {l.num} · {l.label}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ width: 1, height: 18, background: TK.border, flexShrink: 0 }} />
      {mode === 'spine' && <MiniToggle on={ghost} setOn={setGhost} label="GHOST" />}
      <StructuralReadout centering={centering} land={land} atlas={atlas} />
    </div>
  );
};

// ── overlays ────────────────────────────────────────────────────────
const WorkingOverlay: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={{ position: 'absolute', inset: 0, zIndex: 7, background: 'rgba(5,9,13,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 8, height: 8, background: color, transform: 'rotate(45deg)', animation: 'hld-pulse 1s ease-in-out infinite' }} />
      {label}
    </div>
  </div>
);

// ── bracket corners ─────────────────────────────────────────────────
const BracketCorners: React.FC = () => (
  <>
    {(
      [
        ['top', 'left'],
        ['top', 'right'],
        ['bottom', 'left'],
        ['bottom', 'right'],
      ] as [('top' | 'bottom'), ('left' | 'right')][]
    ).map(([v, h], i) => {
      const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            [v]: 0,
            [h]: 0,
            width: 12,
            height: 12,
            zIndex: 30,
            pointerEvents: 'none',
            [`border${cap(v)}`]: `2px solid ${TK.accent}`,
            [`border${cap(h)}`]: `2px solid ${TK.accent}`,
          } as React.CSSProperties}
        />
      );
    })}
  </>
);

export const DependencyGraphModal: React.FC<DependencyGraphModalProps> = ({
  sections,
  testSuite,
  updateDependencies,
  onEstimateDependencies,
}) => {
  const isOpen = useStore((s) => s.showGraphModal);
  const setShow = useStore((s) => s.setShowGraphModal);
  const editorSelectedId = useStore((s) => s.selectedId);
  const setEditorSelectedId = useStore((s) => s.setSelectedId);
  // The fifth domain layer, read straight from the store (the PARTS projection's
  // trigger stays self-contained — no new ModalLayer/App wiring).
  const structuralParts = useStore((s) => s.structuralParts);
  const markdown = useStore((s) => s.markdown);
  const { runDiscoverStructuralParts } = useStructuralPartsActions();
  const reduced = useReducedMotion();

  const model = useMemo(() => deriveTopo(sections, testSuite), [sections, testSuite]);
  // Staleness/orphan annotation for the PARTS projection (mirrors gist recompute):
  // orphan = anchors no longer relocate; stale = span text changed since discovery.
  // Opened-on-demand surface, so no ephemeral slice/debounce is needed.
  const { staleIds, orphanIds } = useMemo(
    () => recomputeStructuralStale(structuralParts, markdown, sections),
    [structuralParts, markdown, sections],
  );
  // the structural centre, read off the direction of the arcs (rides the same memo)
  const centering = useMemo(() => computeCentering(model), [model]);

  const [mode, setMode] = useState<Projection>('atlas');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedDepId, setSelectedDepId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filterPartId, setFilterPartId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [ghostUnderlay, setGhostUnderlay] = useState(false);
  const [land, setLand] = useState<Metrics>({ len: 0, cross: 0 });
  const [optimizing, setOptimizing] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const [organizeNonce, setOrganizeNonce] = useState(0);

  const onClose = useCallback(() => setShow(false), [setShow]);

  // Seed selection from the editor's current section when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedDepId(null);
    setLinkMode(false);
    setSelectedStationId((prev) => prev ?? (editorSelectedId && model.stationById[editorSelectedId] ? editorSelectedId : null));
  }, [isOpen]);

  // Esc: cancel link mode if active, else close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (linkMode) setLinkMode(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, linkMode, onClose]);

  const onSelect = useCallback(
    (id: string | null) => {
      if (linkMode && id && selectedStationId && id !== selectedStationId) {
        // create a prerequisite: clicked station → currently-selected station
        const target = selectedStationId;
        const existing = testSuite[target]?.dependencies ?? [];
        if (existing.some((d) => d.id === id)) {
          toast.info('Dependency already exists.');
          setLinkMode(false);
          return;
        }
        updateDependencies(target, [...existing, { id, type: 'prerequisite' }]);
        setLinkMode(false);
        setSelectedDepId(`${id}->${target}`);
        setSelectedStationId(null);
        toast.success('Dependency Added.');
        return;
      }
      setSelectedStationId(id);
      setSelectedDepId(null);
    },
    [linkMode, selectedStationId, testSuite, updateDependencies],
  );

  const onSelectDep = useCallback((id: string | null) => {
    setSelectedDepId(id);
    if (id) setSelectedStationId(null);
  }, []);

  const onSelectStationFromInspector = useCallback((id: string) => {
    setSelectedStationId(id);
    setSelectedDepId(null);
  }, []);

  const onToggleDep = useCallback(
    (arcId: string) => {
      const arc = model.arcs.find((a) => a.id === arcId);
      if (!arc) return;
      const existing = testSuite[arc.target]?.dependencies ?? [];
      const next: Dependency[] = existing.map((d) =>
        d.id === arc.source ? { ...d, type: d.type === 'prerequisite' ? ('reference' as const) : ('prerequisite' as const) } : d,
      );
      updateDependencies(arc.target, next);
      toast.success('Dependency Type Toggled.');
    },
    [model, testSuite, updateDependencies],
  );

  const onRemoveDep = useCallback(
    (arcId: string) => {
      const arc = model.arcs.find((a) => a.id === arcId);
      if (!arc) return;
      const existing = testSuite[arc.target]?.dependencies ?? [];
      updateDependencies(arc.target, existing.filter((d) => d.id !== arc.source));
      setSelectedDepId(null);
      toast.success('Dependency Removed.');
    },
    [model, testSuite, updateDependencies],
  );

  const onOpenInEditor = useCallback(
    (id: string) => {
      setEditorSelectedId(id);
      onClose();
    },
    [setEditorSelectedId, onClose],
  );

  const onOrganize = useCallback(() => {
    if (mode === 'atlas') setOrganizeNonce((n) => n + 1);
    else {
      setFitNonce((n) => n + 1);
      toast.success(mode === 'radix' ? 'Refit to rank layout.' : mode === 'parts' ? 'Refit parts layout.' : 'Graph Layout Optimized.');
    }
  }, [mode]);

  const onOptRun = useCallback((running: boolean) => {
    setOptimizing(running);
    if (!running) toast.success('Topology Optimised — routes shortened.');
  }, []);

  const onEstimate = useCallback(async () => {
    if (!onEstimateDependencies) return;
    setEstimating(true);
    try {
      await onEstimateDependencies();
    } finally {
      setEstimating(false);
    }
  }, [onEstimateDependencies]);

  const onDiscover = useCallback(async () => {
    setDiscovering(true);
    try {
      await runDiscoverStructuralParts();
    } finally {
      setDiscovering(false);
    }
  }, [runDiscoverStructuralParts]);

  if (!isOpen) return null;

  const station = selectedStationId ? model.stationById[selectedStationId] ?? null : null;
  const arc = selectedDepId ? model.arcs.find((a) => a.id === selectedDepId) ?? null : null;
  const linkTarget = linkMode && station ? station.sym : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(5,9,13,0.78)', backdropFilter: 'blur(6px)', padding: 24, fontFamily: 'Inter, sans-serif', color: TK.text }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '94vw',
          maxWidth: 1480,
          height: '90vh',
          background: TK.surface,
          border: `1px solid rgba(170,0,255,0.5)`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: `0 0 60px rgba(170,0,255,0.18), 0 30px 80px rgba(0,0,0,0.6)`,
        }}
      >
        <BracketCorners />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: TK.accent, boxShadow: `0 0 ${10 * TK.glow.edge}px ${TK.accent}`, zIndex: 25 }} />

        <Header
          mode={mode}
          setMode={setMode}
          estimating={estimating}
          optimizing={optimizing}
          canEstimate={!!onEstimateDependencies}
          onEstimate={onEstimate}
          onOrganize={onOrganize}
          onClose={onClose}
        />

        <FilterBar mode={mode} lines={model.lines} filter={filterPartId} setFilter={setFilterPartId} land={land} ghost={ghostUnderlay} setGhost={setGhostUnderlay} centering={centering} />

        <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
          <main style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            {model.stations.length === 0 && mode !== 'parts' ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TK.bgDeep, fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', color: TK.muted }}>
                NO SECTIONS YET — WRITE SOME HEADINGS TO MAP THE ARGUMENT.
              </div>
            ) : mode === 'atlas' ? (
              <TopoLand
                model={model}
                centering={centering}
                selectedId={selectedStationId}
                hoveredId={hoveredId}
                editorId={editorSelectedId}
                filter={filterPartId}
                selectedDepId={selectedDepId}
                organizeNonce={organizeNonce}
                reduced={reduced}
                onSelect={onSelect}
                onSelectDep={onSelectDep}
                onHover={setHoveredId}
                onOpen={onOpenInEditor}
                onMetrics={setLand}
                onOptRun={onOptRun}
              />
            ) : mode === 'radix' ? (
              <TopoRadix
                model={model}
                centering={centering}
                selectedId={selectedStationId}
                hoveredId={hoveredId}
                editorId={editorSelectedId}
                filter={filterPartId}
                selectedDepId={selectedDepId}
                fitNonce={fitNonce}
                reduced={reduced}
                onSelect={onSelect}
                onSelectDep={onSelectDep}
                onHover={setHoveredId}
                onOpen={onOpenInEditor}
              />
            ) : mode === 'parts' ? (
              <TopoParts
                model={model}
                parts={structuralParts}
                staleIds={staleIds}
                orphanIds={orphanIds}
                selectedId={selectedStationId}
                hoveredId={hoveredId}
                editorId={editorSelectedId}
                filter={filterPartId}
                selectedDepId={selectedDepId}
                fitNonce={fitNonce}
                reduced={reduced}
                discovering={discovering}
                onSelect={onSelect}
                onSelectDep={onSelectDep}
                onHover={setHoveredId}
                onOpen={onOpenInEditor}
                onDiscover={onDiscover}
              />
            ) : (
              <TopoMap
                model={model}
                centering={centering}
                selectedId={selectedStationId}
                hoveredId={hoveredId}
                editorId={editorSelectedId}
                filter={filterPartId}
                selectedDepId={selectedDepId}
                fitNonce={fitNonce}
                showGhost={ghostUnderlay}
                reduced={reduced}
                onSelect={onSelect}
                onSelectDep={onSelectDep}
                onHover={setHoveredId}
                onOpen={onOpenInEditor}
              />
            )}

            {model.stations.length > 0 && <LegendKey mode={mode} />}

            {linkMode && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 14,
                  transform: 'translateX(-50%)',
                  zIndex: 6,
                  padding: '8px 14px',
                  background: TK.surface,
                  border: `1px solid ${TK.accent}`,
                  color: TK.accent,
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  fontWeight: 700,
                  boxShadow: `0 0 14px rgba(${TK.accentGlow},0.4)`,
                }}
              >
                LINK MODE · click a station to make it a prerequisite of {linkTarget} · ESC to cancel
              </div>
            )}

            {estimating && <WorkingOverlay color={TK.magenta} label="ANALYSING DEPENDENCIES…" />}
            {optimizing && <WorkingOverlay color={TK.accent} label="OPTIMISING TOPOLOGY…" />}
          </main>

          <Inspector
            model={model}
            centering={centering}
            station={station}
            arc={arc}
            editorId={editorSelectedId}
            linkMode={linkMode}
            setLinkMode={setLinkMode}
            onOpen={onOpenInEditor}
            onSelectStation={onSelectStationFromInspector}
            onToggleDep={onToggleDep}
            onRemoveDep={onRemoveDep}
          />
        </div>
      </div>
    </div>
  );
};
