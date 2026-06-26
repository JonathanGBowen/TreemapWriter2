/* Inspector.tsx — the right rail. Three states: nothing selected (guide),
   a station selected (its board), or a dependency arc selected (arc editor).
   Ported from the prototype topo-modal.jsx; reads the real derived model. */

import React, { useMemo } from 'react';
import type { ReadinessLevel } from '../../../types';
import type { TopoModel, Station, Arc } from './topo-derive';
import {
  statusMeta,
  FN_LABELS,
  READINESS_LABEL,
  READINESS_ORDER,
  READINESS_COLOR,
} from './topo-derive';
import { TK } from './tk';
import { ArrowRightGlyph } from './icons';

const mono = 'JetBrains Mono, monospace';

export interface InspectorProps {
  model: TopoModel;
  station: Station | null;
  arc: Arc | null;
  editorId: string | null;
  linkMode: boolean;
  setLinkMode: (v: boolean) => void;
  onOpen: (id: string) => void;
  onSelectStation: (id: string) => void;
  onToggleDep: (arcId: string) => void;
  onRemoveDep: (arcId: string) => void;
}

function useLineColor(model: TopoModel) {
  return useMemo(() => {
    const m: Record<string, string> = {};
    model.lines.forEach((l) => (m[l.id] = l.color));
    return m;
  }, [model]);
}

const iconBtn = (color?: string): React.CSSProperties => ({
  width: 18,
  height: 18,
  flexShrink: 0,
  cursor: 'pointer',
  background: 'transparent',
  border: `1px solid ${TK.border}`,
  color: color || TK.muted,
  fontFamily: mono,
  fontSize: 9,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
});

const Block: React.FC<{ index: string; title: string; color: string; count?: string; children: React.ReactNode }> = ({
  index,
  title,
  color,
  count,
  children,
}) => (
  <div style={{ padding: '13px 15px', borderBottom: `1px solid ${TK.border}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <span style={{ fontFamily: mono, fontSize: 7, color: TK.dim, letterSpacing: '0.16em', fontWeight: 700 }}>{index}</span>
      <div style={{ width: 6, height: 6, background: color, transform: 'rotate(45deg)', boxShadow: `0 0 4px ${color}` }} />
      <div style={{ fontFamily: mono, fontSize: 8, color, letterSpacing: '0.2em', fontWeight: 700 }}>{title}</div>
      <div style={{ flex: 1, height: 1, background: TK.border }} />
      {count && <div style={{ fontFamily: mono, fontSize: 8, color, fontWeight: 700 }}>{count}</div>}
    </div>
    {children}
  </div>
);

const DepList: React.FC<{
  model: TopoModel;
  list: Arc[];
  dir: 'from' | 'to';
  empty: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ model, list, dir, empty, onSelect, onToggle, onRemove }) => {
  if (list.length === 0)
    return <div style={{ fontFamily: mono, fontSize: 8, color: TK.dim, letterSpacing: '0.1em', padding: '4px 2px' }}>{empty}</div>;
  return (
    <div style={{ border: `1px solid ${TK.border}`, background: TK.bgDeep }}>
      {list.map((d, i) => {
        const otherId = dir === 'from' ? d.source : d.target;
        const other = model.stationById[otherId];
        if (!other) return null;
        const health = model.health(d);
        const hc = health === 'broken' ? TK.magenta : health === 'weak' ? TK.yellow : TK.accent;
        const ref = d.type === 'reference';
        return (
          <div
            key={d.id}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderBottom: i < list.length - 1 ? `1px solid ${TK.border}` : 'none' }}
          >
            <span style={{ fontFamily: mono, fontSize: 10, color: TK.dim, width: 10, flexShrink: 0 }}>{dir === 'from' ? '←' : '→'}</span>
            <span onClick={() => onSelect(other.id)} style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: TK.text, width: 44, flexShrink: 0, cursor: 'pointer' }}>
              {other.sym}
            </span>
            <span
              onClick={() => onSelect(other.id)}
              style={{ flex: 1, fontSize: 10, color: TK.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
            >
              {other.short}
            </span>
            <span
              title={d.type}
              style={{ fontFamily: mono, fontSize: 6.5, fontWeight: 800, letterSpacing: '0.08em', color: hc, border: `1px solid ${hc}`, padding: '1px 4px', flexShrink: 0 }}
            >
              {ref ? 'REF' : 'PRE'}
            </span>
            <button onClick={() => onToggle(d.id)} title="Toggle type" style={iconBtn()}>
              ⇄
            </button>
            <button onClick={() => onRemove(d.id)} title="Remove" style={iconBtn(TK.magenta)}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};

const Readiness: React.FC<{ level: ReadinessLevel }> = ({ level }) => {
  const idx = READINESS_ORDER.indexOf(level);
  const c = READINESS_COLOR[level] || TK.magenta;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        {READINESS_ORDER.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 5, background: i <= idx ? c : TK.border }} />
        ))}
      </div>
      <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: c }}>
        {(READINESS_LABEL[level] || level || '').toUpperCase()}
      </span>
    </div>
  );
};

const Chip: React.FC<{ station: Station; color: string; onSelect: (id: string) => void }> = ({ station, color, onSelect }) => {
  const meta = statusMeta(station.status);
  return (
    <button
      onClick={() => onSelect(station.id)}
      style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 9px', cursor: 'pointer', background: TK.bgDeep, border: `1px solid ${color}`, minWidth: 0 }}
    >
      <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 800, color: TK.textHi }}>{station.sym}</span>
      <span style={{ fontSize: 8.5, color: meta.c, whiteSpace: 'nowrap' }}>
        {station.short.length > 14 ? station.short.slice(0, 14) + '…' : station.short}
      </span>
    </button>
  );
};

const EmptyInspector: React.FC = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '22px 18px', gap: 16 }}>
    <div style={{ fontFamily: mono, fontSize: 9, color: TK.accent, letterSpacing: '0.18em', fontWeight: 700 }}>READING THE MAP</div>
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(
        [
          ['Lines & continents are Parts', "Each colour is a top-level Part: a metro line (SPINE) or a contiguous landmass (ATLAS) through its sections in reading order — the argument's spine."],
          ['Cyan is dependencies', 'Cyan arrows/routes show what a section needs. Solid = prerequisite (structural); dashed = reference (informational).'],
          ['Watch the breaks', 'A ✕ marks a dependency whose source is failing or still a draft — the link is not yet load-bearing.'],
          ['Click & open', 'Click a station for its board; double-click (or OPEN IN EDITOR) to jump into the prose. Click a route to edit the link.'],
        ] as [string, string][]
      ).map(([h, d], i) => (
        <li key={i} style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 6, height: 6, marginTop: 5, flexShrink: 0, background: TK.accent, transform: 'rotate(45deg)', boxShadow: `0 0 4px ${TK.accent}` }} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: TK.textHi, marginBottom: 3 }}>{h}</div>
            <div style={{ fontSize: 10.5, lineHeight: 1.55, color: TK.muted }}>{d}</div>
          </div>
        </li>
      ))}
    </ul>
    <div style={{ marginTop: 'auto', fontFamily: mono, fontSize: 8, color: TK.dim, letterSpacing: '0.1em', lineHeight: 1.7, borderTop: `1px solid ${TK.border}`, paddingTop: 14 }}>
      DRAG to pan · WHEEL to zoom · click empty space to deselect
    </div>
  </div>
);

const StationInspector: React.FC<{
  model: TopoModel;
  station: Station;
  lineColor: Record<string, string>;
  editorId: string | null;
  linkMode: boolean;
  setLinkMode: (v: boolean) => void;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onToggleDep: (id: string) => void;
  onRemoveDep: (id: string) => void;
}> = ({ model, station, lineColor, editorId, linkMode, setLinkMode, onOpen, onSelect, onToggleDep, onRemoveDep }) => {
  const meta = statusMeta(station.status);
  const b = model.board(station.id);
  const inbound = model.inbound(station.id);
  const outbound = model.outbound(station.id);
  const isHere = editorId === station.id;
  const part = lineColor[station.partId] || TK.accent;
  const claim = b.claim || '— No controlling claim formulated yet.';
  const readiness: ReadinessLevel = b.readiness || 'draft';
  const next = b.next || 'Determine the rhetorical function and draft a controlling claim.';
  const coherence = b.coherence || 'No diagnostic run yet.';
  return (
    <>
      <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${TK.border}`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, background: part, boxShadow: `0 0 6px ${part}` }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              flexShrink: 0,
              width: 46,
              height: 46,
              border: `1.5px solid ${meta.c}`,
              background: `rgba(${TK.accentGlow},0.04)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: mono,
              fontSize: 11,
              fontWeight: 800,
              color: meta.c,
            }}
          >
            {station.sym}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: TK.textHi, lineHeight: 1.25, marginBottom: 5 }}>{station.title}</div>
            <div style={{ fontFamily: mono, fontSize: 7.5, color: TK.muted, letterSpacing: '0.14em' }}>
              {station.fn ? FN_LABELS[station.fn] : 'UNSPECIFIED'} · {station.words}W · <span style={{ color: meta.c }}>{meta.label}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onOpen(station.id)}
          style={{
            marginTop: 13,
            width: '100%',
            padding: '9px 12px',
            cursor: 'pointer',
            background: `rgba(${TK.accentGlow},0.12)`,
            border: `1px solid ${TK.accent}`,
            color: TK.accent,
            fontFamily: mono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.16em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: `0 0 ${10 * TK.glow.edge}px rgba(${TK.accentGlow},${TK.glow.halo})`,
          }}
        >
          {isHere ? 'RETURN TO EDITOR' : 'OPEN IN EDITOR'} <ArrowRightGlyph c={TK.accent} />
        </button>
      </div>

      <Block index="01" title="CONTROLLING CLAIM" color={TK.magenta}>
        <div
          style={{
            padding: '9px 11px',
            borderLeft: `2px solid ${TK.magenta}`,
            background: 'rgba(255,16,96,0.04)',
            fontSize: 11.5,
            lineHeight: 1.55,
            color: claim.startsWith('—') ? TK.muted : TK.text,
            fontStyle: 'italic',
          }}
        >
          {claim}
        </div>
      </Block>

      <Block index="02" title="DEPENDS ON" color={TK.accent} count={`${inbound.length}`}>
        <DepList model={model} list={inbound} dir="from" empty="No inbound dependencies — this is an origin." onSelect={onSelect} onToggle={onToggleDep} onRemove={onRemoveDep} />
        <button
          onClick={() => setLinkMode(!linkMode)}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '7px',
            cursor: 'pointer',
            background: linkMode ? `rgba(${TK.accentGlow},0.12)` : 'transparent',
            border: `1px dashed ${linkMode ? TK.accent : TK.border}`,
            color: linkMode ? TK.accent : TK.muted,
            fontFamily: mono,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          {linkMode ? '✕ CANCEL LINK' : '+ LINK PREREQUISITE'}
        </button>
      </Block>

      <Block index="03" title="FEEDS" color={TK.green} count={`${outbound.length}`}>
        <DepList model={model} list={outbound} dir="to" empty="Nothing depends on this section yet." onSelect={onSelect} onToggle={onToggleDep} onRemove={onRemoveDep} />
      </Block>

      <Block index="04" title="READINESS" color={TK.yellow}>
        <Readiness level={readiness} />
        <div style={{ marginTop: 10, fontSize: 10.5, lineHeight: 1.6, color: TK.text, padding: '7px 9px', borderLeft: `2px solid ${TK.yellow}`, background: 'rgba(255,230,0,0.04)' }}>
          <span style={{ fontFamily: mono, fontSize: 7, color: TK.yellow, letterSpacing: '0.14em', marginRight: 6 }}>↯</span>
          {coherence}
        </div>
      </Block>

      <Block index="05" title="NEXT MOVE" color={TK.green}>
        <div style={{ padding: '11px', border: `1px solid rgba(0,232,112,0.3)`, background: 'rgba(0,232,112,0.05)', boxShadow: `0 0 ${10 * TK.glow.edge}px rgba(0,232,112,${TK.glow.halo * 0.5})` }}>
          <div style={{ fontFamily: mono, fontSize: 7, color: TK.green, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowRightGlyph c={TK.green} size={8} />
            NEXT PRIORITY
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: TK.textHi, fontWeight: 500 }}>{next}</div>
        </div>
      </Block>
    </>
  );
};

const DepInspector: React.FC<{
  model: TopoModel;
  arc: Arc;
  lineColor: Record<string, string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ model, arc, lineColor, onSelect, onToggle, onRemove }) => {
  const s = model.stationById[arc.source];
  const t = model.stationById[arc.target];
  if (!s || !t) return <EmptyInspector />;
  const health = model.health(arc);
  const hc = health === 'broken' ? TK.magenta : health === 'weak' ? TK.yellow : TK.accent;
  const ref = arc.type === 'reference';
  return (
    <>
      <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${TK.border}`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, background: hc, boxShadow: `0 0 6px ${hc}` }} />
        <div style={{ fontFamily: mono, fontSize: 8, color: hc, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 10 }}>
          DEPENDENCY · {ref ? 'REFERENCE' : 'PREREQUISITE'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Chip station={s} color={lineColor[s.partId] || TK.accent} onSelect={onSelect} />
          <svg width="26" height="10">
            <path d="M1 5 L20 5" stroke={hc} strokeWidth="2" strokeDasharray={ref ? '4 3' : undefined} />
            <path d="M25 5 L19 2 L19 8 Z" fill={hc} />
          </svg>
          <Chip station={t} color={lineColor[t.partId] || TK.accent} onSelect={onSelect} />
        </div>
        <div style={{ fontFamily: mono, fontSize: 8, color: TK.muted, letterSpacing: '0.1em', marginTop: 12, lineHeight: 1.6 }}>
          {s.short} {ref ? 'is referenced by' : 'is a prerequisite of'} {t.short}.
        </div>
        {health !== 'solid' && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              border: `1px solid ${hc}`,
              background: `rgba(${health === 'broken' ? '255,16,96' : '255,230,0'},0.05)`,
              fontFamily: mono,
              fontSize: 8,
              color: hc,
              letterSpacing: '0.08em',
              lineHeight: 1.6,
            }}
          >
            {health === 'broken'
              ? `BROKEN — source ${s.sym} is currently ${(s.readiness === 'draft' && s.status !== 'fail' ? 'DRAFT' : s.status.toUpperCase())}; this link is not load-bearing.`
              : `WEAK — source ${s.sym} is STALE; re-read before relying on it.`}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => onToggle(arc.id)} style={{ padding: '9px', cursor: 'pointer', background: 'transparent', border: `1px solid ${TK.accent}`, color: TK.accent, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em' }}>
          ⇄ TOGGLE TYPE → {ref ? 'PREREQUISITE' : 'REFERENCE'}
        </button>
        <button onClick={() => onRemove(arc.id)} style={{ padding: '9px', cursor: 'pointer', background: 'transparent', border: `1px solid ${TK.magenta}`, color: TK.magenta, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em' }}>
          ✕ REMOVE DEPENDENCY
        </button>
        <div style={{ fontFamily: mono, fontSize: 7.5, color: TK.dim, letterSpacing: '0.08em', lineHeight: 1.7, marginTop: 4 }}>
          Prerequisite = structural (the target needs this established first). Reference = informational (the target cites or draws on it).
        </div>
      </div>
    </>
  );
};

export const Inspector: React.FC<InspectorProps> = ({
  model,
  station,
  arc,
  editorId,
  linkMode,
  setLinkMode,
  onOpen,
  onSelectStation,
  onToggleDep,
  onRemoveDep,
}) => {
  const lineColor = useLineColor(model);
  return (
    <aside
      style={{
        width: 348,
        flexShrink: 0,
        background: TK.surface,
        borderLeft: `1px solid ${TK.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        position: 'relative',
        zIndex: 9,
      }}
    >
      {arc ? (
        <DepInspector model={model} arc={arc} lineColor={lineColor} onSelect={onSelectStation} onToggle={onToggleDep} onRemove={onRemoveDep} />
      ) : station ? (
        <StationInspector
          model={model}
          station={station}
          lineColor={lineColor}
          editorId={editorId}
          linkMode={linkMode}
          setLinkMode={setLinkMode}
          onOpen={onOpen}
          onSelect={onSelectStation}
          onToggleDep={onToggleDep}
          onRemoveDep={onRemoveDep}
        />
      ) : (
        <EmptyInspector />
      )}
    </aside>
  );
};
