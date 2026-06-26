/* eslint-disable no-restricted-syntax -- SVG <circle> fill/stroke presentation
   attributes need literal hex (CSS `var()` does not resolve in SVG attributes). */
/* icons.tsx — inline SVG glyphs for the Argument Topology modal.
   Ported from the design prototype (topo-modal.jsx). No external assets. */

import React from 'react';

export const NetworkGlyph: React.FC<{ c: string; size?: number }> = ({ c, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    <path
      d="M5 23 L5 9 L14 9 L14 5 L23 5"
      fill="none"
      stroke={c}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="5" cy="23" r="2.6" fill="#0c1520" stroke={c} strokeWidth="1.6" />
    <circle cx="5" cy="9" r="2.6" fill="#0c1520" stroke={c} strokeWidth="1.6" />
    <circle cx="23" cy="5" r="2.6" fill="#0c1520" stroke={c} strokeWidth="1.6" />
  </svg>
);

export const WandGlyph: React.FC<{ c: string }> = ({ c }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M2 12 L9 5 M9 5 L11 3 M8 2 L8.6 3.4 L10 4 L8.6 4.6 L8 6 L7.4 4.6 L6 4 L7.4 3.4 Z"
      stroke={c}
      fill={c}
      strokeWidth="0.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const RefreshGlyph: React.FC<{ c: string }> = ({ c }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M12 7 a5 5 0 1 1 -1.6 -3.6 M12 1.5 L12 4 L9.5 4"
      stroke={c}
      fill="none"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const AtlasGlyph: React.FC<{ c: string }> = ({ c }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M2 4 Q4 2 7 3 Q11 4 12 7 Q11 11 7 11 Q3 11 2 8 Z"
      fill="none"
      stroke={c}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="6" cy="6.5" r="1" fill={c} />
  </svg>
);

export const SpineGlyph: React.FC<{ c: string }> = ({ c }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M4 2 L4 12" stroke={c} strokeWidth="1.6" />
    <circle cx="4" cy="3" r="1.4" fill="none" stroke={c} strokeWidth="1.2" />
    <circle cx="4" cy="7" r="1.4" fill="none" stroke={c} strokeWidth="1.2" />
    <circle cx="4" cy="11" r="1.4" fill="none" stroke={c} strokeWidth="1.2" />
    <path d="M5 7 L11 4" stroke={c} strokeWidth="1" strokeDasharray="2 1.5" />
  </svg>
);

export const RadixGlyph: React.FC<{ c: string }> = ({ c }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
    {/* a source burst over layered rank bands — position encodes structural rank */}
    <path d="M7 1.3 L7 4.4 M5.2 2.85 L8.8 2.85 M5.6 1.9 L8.4 3.8 M8.4 1.9 L5.6 3.8" stroke={c} strokeWidth="0.9" strokeLinecap="round" />
    <path d="M2.5 7.4 L11.5 7.4 M4.5 10.6 L9.5 10.6" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const CloseGlyph: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const ArrowRightGlyph: React.FC<{ c: string; size?: number }> = ({ c, size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
    <path d="M2 6 L9 6 M6 3 L9 6 L6 9" stroke={c} fill="none" strokeWidth="1.3" />
  </svg>
);
