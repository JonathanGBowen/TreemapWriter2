/* eslint-disable no-restricted-syntax -- this IS the SVG map's token kit: literal
   hex is required because SVG fill/stroke and Plotly trace colours don't resolve
   CSS `var()`. Values mirror the @theme hexes (src/index.css). */
/* tk.ts — the token vocabulary the SVG map surfaces draw with.

   SVG fill/stroke/drop-shadow need literal hex (Tailwind classes don't reach
   into <circle stroke>). This mirrors the prototype's getTokens() "balanced"
   output and the app's @theme hexes (src/index.css). `accentGlow` is an
   "r,g,b" triple for use inside rgba(). */

export interface Tk {
  bg: string;
  bgDeep: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textHi: string;
  muted: string;
  dim: string;
  accent: string;
  magenta: string;
  green: string;
  yellow: string;
  purple: string;
  accentGlow: string;
  glow: { ambient: number; edge: number; halo: number };
}

export const TK: Tk = {
  bg: '#05090d',
  bgDeep: '#03060a',
  surface: '#0c1520',
  surface2: '#111d2b',
  border: '#172335',
  text: '#c5d8e8',
  textHi: '#ffffff',
  muted: '#6f8cab', // readable muted text (--color-hld-muted-text)
  dim: '#3d5570', // faint dividers / idle (--color-hld-muted)
  accent: '#00e8f5',
  magenta: '#ff1060',
  green: '#00e870',
  yellow: '#ffe600',
  purple: '#aa00ff',
  accentGlow: '0,232,245',
  glow: { ambient: 0.08, edge: 0.4, halo: 0.3 }, // "balanced"
};
