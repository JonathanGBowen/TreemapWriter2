// Living Sprints — role → color. A move's role drives its accent and the
// runner's ambient hue. Canonical map from the design handoff (ARGUMENT_SHAPES):
// reinstate=green · frame=cyan · marshal=yellow · draft=cyan · stress=orange ·
// synthesize=purple · bridge=purple. Values are the exact `hld-*` token hexes.
//
// Pure data + helpers, no React — so the runner, the shape strip, and tests can
// all share one source of truth for "what color is this move".

import type { SprintMoveRole } from '../types';

const ROLE_HUE: Record<SprintMoveRole, string> = {
  reinstate: '#00e870', // hld-green
  frame: '#00e8f5', // hld-cyan
  marshal: '#ffe600', // hld-yellow
  draft: '#00e8f5', // hld-cyan
  stress: '#ff8800', // hld-orange
  synthesize: '#aa00ff', // hld-purple
  bridge: '#aa00ff', // hld-purple
};

/** The accent/ambient hue for a move role (an `hld-*` token hex). */
export function roleHue(role: SprintMoveRole): string {
  return ROLE_HUE[role] ?? '#00e8f5';
}

/** A short uppercase glyph-label for a role (used on the phase strip). */
export function roleLabel(role: SprintMoveRole): string {
  return role.toUpperCase();
}

/** `#rrggbb` + alpha → `rgba(...)`. Mirrors the design reference's hexA(). */
export function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}
