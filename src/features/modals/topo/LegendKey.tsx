/* LegendKey.tsx — the top-left map legend (route/land or dependency/station). */

import React from 'react';
import { TK } from './tk';

const mono = 'JetBrains Mono, monospace';

const Dot: React.FC<{ c: string }> = ({ c }) => (
  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}`, display: 'inline-block' }} />
);

const Row: React.FC<{ svg: React.ReactNode; label: string }> = ({ svg, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {svg}
    <span style={{ fontFamily: mono, fontSize: 7, color: TK.muted, letterSpacing: '0.1em', fontWeight: 600 }}>{label}</span>
  </div>
);

// A tiny bipartite glyph: 'span' = one part fanning to two sections; 'share' =
// two parts converging on one section (the two divergences the heading grid can't show).
const PartsFan: React.FC<{ kind: 'span' | 'share' | 'subdivide' }> = ({ kind }) => (
  <svg width="22" height="12">
    {kind === 'span' ? (
      <>
        <circle cx="3" cy="6" r="1.8" fill={TK.purple} />
        <path d="M5 6 L17 3" stroke={TK.accent} strokeWidth="1" strokeDasharray="3 2" />
        <path d="M5 6 L17 9" stroke={TK.accent} strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="19" cy="3" r="1.6" fill={TK.green} />
        <circle cx="19" cy="9" r="1.6" fill={TK.yellow} />
      </>
    ) : kind === 'share' ? (
      <>
        <circle cx="3" cy="3" r="1.8" fill={TK.purple} />
        <circle cx="3" cy="9" r="1.8" fill={TK.purple} />
        <path d="M5 3 L17 6" stroke={TK.accent} strokeWidth="1" strokeDasharray="3 2" />
        <path d="M5 9 L17 6" stroke={TK.accent} strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="19" cy="6" r="1.6" fill={TK.accent} />
      </>
    ) : (
      <>
        <circle cx="3" cy="6" r="1.8" fill={TK.purple} />
        <path d="M5 6 L17 6" stroke={TK.accent} strokeWidth="1" strokeDasharray="3 2" />
        <circle cx="19" cy="6" r="1.6" fill={TK.green} />
      </>
    )}
  </svg>
);

export const LegendKey: React.FC<{ mode: 'atlas' | 'spine' | 'radix' | 'parts' }> = ({ mode }) => {
  const atlas = mode === 'atlas' || mode === 'radix'; // ATLAS and RADIX share the land/route marks
  const head = { fontFamily: mono, fontSize: 6.5, color: TK.muted, letterSpacing: '0.18em', fontWeight: 700 } as React.CSSProperties;
  const frame: React.CSSProperties = {
    position: 'absolute',
    left: 12,
    top: 12,
    background: TK.surface,
    border: `1px solid ${TK.border}`,
    padding: '8px 11px',
    zIndex: 4,
    opacity: 0.95,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  // PARTS is a bipartite membership map, not the section/dependency picture — its
  // own legend (part-nodes, section-nodes, membership edges, the divergences).
  if (mode === 'parts') {
    return (
      <div style={frame}>
        <div style={head}>STRUCTURAL PARTS</div>
        <Row svg={<Dot c={TK.purple} />} label="PART · a move the argument makes" />
        <Row
          svg={<span style={{ display: 'inline-flex', gap: 4 }}><Dot c={TK.green} /><Dot c={TK.accent} /><Dot c={TK.yellow} /></span>}
          label="SECTION · coloured by continent"
        />
        <Row
          svg={
            <svg width="22" height="8">
              <path d="M1 4 L17 4" stroke={TK.accent} strokeWidth="2.2" strokeDasharray="4 3" />
              <path d="M21 4 L15 1.5 L15 6.5 Z" fill={TK.accent} />
            </svg>
          }
          label="MAPS ONTO · part → section"
        />
        <div style={{ height: 1, background: TK.border, margin: '1px 0' }} />
        <div style={head}>DIVERGENCE</div>
        <Row svg={<PartsFan kind="span" />} label="SPANS · one part → many sections" />
        <Row svg={<PartsFan kind="subdivide" />} label="WITHIN · one part inside one section" />
        <Row svg={<PartsFan kind="share" />} label="SHARED · one section ← many parts" />
      </div>
    );
  }

  return (
    <div style={frame}>
      <div style={head}>{atlas ? 'ROUTE' : 'DEPENDENCY'}</div>
      <Row
        svg={
          <svg width="22" height="8">
            <path d="M1 4 L17 4" stroke={TK.accent} strokeWidth="2.2" />
            <path d="M21 4 L15 1.5 L15 6.5 Z" fill={TK.accent} />
          </svg>
        }
        label="PREREQUISITE"
      />
      <Row
        svg={
          <svg width="22" height="8">
            <path d="M1 4 L17 4" stroke={TK.accent} strokeWidth="2.2" strokeDasharray="4 3" />
            <path d="M21 4 L15 1.5 L15 6.5 Z" fill={TK.accent} />
          </svg>
        }
        label="REFERENCE"
      />
      <Row
        svg={
          <svg width="22" height="10">
            <path d="M1 5 L17 5" stroke={TK.yellow} strokeWidth="2.2" strokeDasharray="2 4" />
          </svg>
        }
        label="WEAK · source stale"
      />
      <Row
        svg={
          <svg width="22" height="10">
            <path d="M2 2 L8 8 M8 2 L2 8" stroke={TK.magenta} strokeWidth="1.6" />
          </svg>
        }
        label="BROKEN · source draft/fail"
      />
      <div style={{ height: 1, background: TK.border, margin: '1px 0' }} />
      <div style={head}>{atlas ? 'LAND' : 'STATION'}</div>
      {atlas && (
        <Row
          svg={
            <svg width="22" height="12">
              <circle cx="7" cy="6" r="5" fill="none" stroke={TK.muted} strokeWidth="1" />
              <circle cx="16" cy="7" r="3" fill="none" stroke={TK.muted} strokeWidth="1" />
            </svg>
          }
          label="AREA ∝ WORD COUNT"
        />
      )}
      {atlas && (
        <Row
          svg={
            <svg width="22" height="12">
              <circle cx="11" cy="6" r="5" fill="none" stroke={TK.muted} strokeWidth="1.2" strokeDasharray="3 3" />
            </svg>
          }
          label="FOG · unwritten"
        />
      )}
      <Row
        svg={
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <Dot c={TK.green} />
            <Dot c={TK.accent} />
            <Dot c={TK.yellow} />
            <Dot c={TK.magenta} />
            <Dot c={TK.dim} />
          </span>
        }
        label="SOLID · WORK · STALE · BREAK · IDLE"
      />
      <div style={{ height: 1, background: TK.border, margin: '1px 0' }} />
      <div style={head}>CENTERING</div>
      <Row
        svg={
          <svg width="22" height="11">
            <g stroke={TK.purple} strokeWidth="1.1" strokeLinecap="round">
              <path d="M6 1.5 L6 9.5 M2 5.5 L10 5.5 M3.2 2.7 L8.8 8.3 M8.8 2.7 L3.2 8.3" />
            </g>
          </svg>
        }
        label="RADIX · source of arrows"
      />
      <Row
        svg={
          <svg width="22" height="11">
            <circle cx="6" cy="5.5" r="4" fill="none" stroke={TK.purple} strokeWidth="1.1" />
            <circle cx="6" cy="5.5" r="1.4" fill={TK.purple} />
          </svg>
        }
        label="TELOS · what it serves"
      />
      <Row
        svg={
          <svg width="22" height="11">
            <path d="M3 5.5 L19 5.5" stroke={TK.purple} strokeWidth="1.1" opacity="0.5" />
            <path d="M4 8.5 Q11 1 18 8.5" fill="none" stroke={TK.purple} strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        }
        label="COVERED · deliberate inversion"
      />
      <Row
        svg={
          <svg width="22" height="11">
            <path d="M3 5.5 L19 5.5" stroke={TK.magenta} strokeWidth="1.4" />
            <path d="M11 5.5 L5 2.5 L5 8.5 Z" fill="none" stroke={TK.magenta} strokeWidth="1.3" />
          </svg>
        }
        label="UNCOVERED · prereq read late"
      />
    </div>
  );
};
