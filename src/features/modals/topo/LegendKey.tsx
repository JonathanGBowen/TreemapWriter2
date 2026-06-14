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

export const LegendKey: React.FC<{ mode: 'atlas' | 'spine' }> = ({ mode }) => {
  const atlas = mode === 'atlas';
  const head = { fontFamily: mono, fontSize: 6.5, color: TK.muted, letterSpacing: '0.18em', fontWeight: 700 } as React.CSSProperties;
  return (
    <div
      style={{
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
      }}
    >
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
    </div>
  );
};
