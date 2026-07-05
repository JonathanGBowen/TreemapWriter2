// Pure graph transforms for the W₁ Canvas (Arpeggio Phase 4). No React/store — the
// actions hook wraps these with `setStructuralParts/Edges/Realizations` +
// `saveCurrentState`. Kept pure so create / move / delete / bulk-layout + the
// initial-placement seeding are unit-testable.

import { newSectionId } from '../../lib/section-ids';
import type { Realization, StructuralEdge, StructuralPart } from '../../types';
import type { Pt } from './canvas-geometry';

/** Grid pitch for auto-placing never-placed nodes (world px). */
const GRID_X = 240;
const GRID_Y = 150;

/** Mint an authored germ node at a world position — the `promoteToGermPart` shape + `position`. */
export function makeGermPart(claim: string, position: Pt, taken: Set<string>): StructuralPart {
  return {
    id: newSectionId(taken),
    kind: 'germ',
    claim: claim.trim() || 'untitled',
    startAnchor: '',
    endAnchor: '',
    sectionIds: [],
    confidence: 1,
    rationale: '',
    origin: 'authored',
    status: 'germ',
    position,
  };
}

/** Reposition one part (drag). */
export function moveIn(parts: StructuralPart[], id: string, position: Pt): StructuralPart[] {
  return parts.map((p) => (p.id === id ? { ...p, position } : p));
}

/** Patch one part's authored fields (claim / kind / status / body / declaredCenter). */
export function patchIn(parts: StructuralPart[], id: string, patch: Partial<StructuralPart>): StructuralPart[] {
  return parts.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

/** Apply a bulk `{id → position}` map (suggest-layout accept / undo). */
export function applyPositions(parts: StructuralPart[], map: Record<string, Pt>): StructuralPart[] {
  return parts.map((p) => (map[p.id] ? { ...p, position: map[p.id] } : p));
}

export interface DeletePartResult {
  parts: StructuralPart[];
  edges: StructuralEdge[];
  realizations: Realization[];
}

/** Delete a part and cascade to its incident edges + its realizations. */
export function deletePartFrom(
  parts: StructuralPart[],
  edges: StructuralEdge[],
  realizations: Realization[],
  id: string,
): DeletePartResult {
  return {
    parts: parts.filter((p) => p.id !== id),
    edges: edges.filter((e) => e.fromPartId !== id && e.toPartId !== id),
    realizations: realizations.filter((r) => r.partId !== id),
  };
}

/**
 * Seed positions for parts that have NEVER been placed (a deterministic grid),
 * leaving every already-placed part untouched — spatial memory is sacred, so
 * auto-placement only fills the gaps, it never repositions a hand-placed node.
 * `changed` tells the caller whether to persist.
 */
export function seedPositions(parts: StructuralPart[]): { parts: StructuralPart[]; changed: boolean } {
  const unplaced = parts.filter((p) => !p.position);
  if (unplaced.length === 0) return { parts, changed: false };
  const unplacedIds = new Set(unplaced.map((p) => p.id));
  const cols = Math.max(1, Math.ceil(Math.sqrt(unplaced.length)));
  let i = 0;
  const next = parts.map((p) => {
    if (!unplacedIds.has(p.id)) return p;
    const col = i % cols;
    const row = Math.floor(i / cols);
    i += 1;
    return { ...p, position: { x: col * GRID_X, y: row * GRID_Y } };
  });
  return { parts: next, changed: true };
}

/** Snapshot current positions (for suggest-layout undo). */
export function positionSnapshot(parts: StructuralPart[]): Record<string, Pt> {
  const map: Record<string, Pt> = {};
  for (const p of parts) if (p.position) map[p.id] = p.position;
  return map;
}
