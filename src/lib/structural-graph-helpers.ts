// Pure engine for the W₁ GRAPH layer (Arpeggio Phase 2): the typed part-to-part
// edge-set, the function-tagged part↔section realizations, and the declared-vs-
// computed-center finding. Sibling of `structural-part-helpers.ts` — no React, no
// store, no SDK, fully unit-tested. Ids are content-stable (the `computeHash`
// idiom the parts faculty already uses) so they survive re-derivation.
//
// A `Realization` promotes the bare `StructuralPart.sectionIds` membership into a
// first-class, function-taggable record. Seeding is DETERMINISTIC and annotate-
// only: `seedRealizations` re-derives one realization per live (part, section)
// overlap on every run, carrying forward any writer tag/note by (partId,
// sectionId) key and dropping realizations whose overlap has vanished — exactly
// the staleness discipline used for parts and gist.

import type {
  Centering,
} from '../features/modals/topo/topo-centering';
import type {
  FunctionTag,
  Realization,
  Section,
  StructuralEdge,
  StructuralEdgeKind,
  StructuralPart,
} from '../types';
import { computeHash } from './utils';

// --- Edges -----------------------------------------------------------------

/** The two SYMMETRIC edge kinds (mutual determination / deliberate tension). */
const SYMMETRIC: ReadonlySet<StructuralEdgeKind> = new Set<StructuralEdgeKind>(['requires', 'opposes']);

/** Directed edge kinds read from → to; symmetric kinds have no meaningful order. */
export function isDirected(kind: StructuralEdgeKind): boolean {
  return !SYMMETRIC.has(kind);
}

/** The glyph for an edge's directionality — `→` directed, `↔` symmetric. */
export function edgeArrow(kind: StructuralEdgeKind): string {
  return isDirected(kind) ? '→' : '↔';
}

/**
 * Content-stable edge id. Symmetric kinds sort their endpoints so `a↔b` and `b↔a`
 * collide (they are the same edge); directed kinds keep order. Identical edges
 * therefore share an id — which is exactly how `mergeDiscoveredEdges` dedups.
 */
export function edgeId(kind: StructuralEdgeKind, from: string, to: string): string {
  const [a, b] = isDirected(kind) ? [from, to] : [from, to].slice().sort();
  return computeHash(`${kind}|${a}|${b}`);
}

/** A one-line human description of an edge, for prompts + the inspector. */
export function describeEdge(edge: StructuralEdge, claimOf: (partId: string) => string): string {
  return `${edge.kind}: ${claimOf(edge.fromPartId)} ${edgeArrow(edge.kind)} ${claimOf(edge.toPartId)}`;
}

/**
 * Union `proposed` (AI-discovered) edges into `existing`, keeping every existing
 * edge UNTOUCHED (an authored or already-accepted edge is never downgraded) and
 * landing each genuinely-new proposal as `origin: 'discovered'`, `status:
 * 'proposed'` (advisory until accepted). Dedup is by `edgeId`, so a proposal that
 * duplicates an existing edge is silently dropped.
 */
export function mergeDiscoveredEdges(
  existing: StructuralEdge[],
  proposed: StructuralEdge[],
): StructuralEdge[] {
  const byId = new Map<string, StructuralEdge>();
  for (const e of existing) byId.set(e.id, e);
  for (const p of proposed) {
    if (byId.has(p.id)) continue; // keep the existing edge as-is
    byId.set(p.id, { ...p, origin: 'discovered', status: 'proposed' });
  }
  return Array.from(byId.values());
}

/** Accept a proposed edge by id (flip `status` to 'accepted'); rejection is a plain filter. */
export function acceptEdge(edges: StructuralEdge[], id: string): StructuralEdge[] {
  return edges.map((e) => (e.id === id ? { ...e, status: 'accepted' as const } : e));
}

// --- Realizations ----------------------------------------------------------

const realizationKey = (partId: string, sectionId: string): string => `${partId}\n${sectionId}`;

function liveSectionIds(sections: Section[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      ids.add(n.id);
      if (n.children.length) walk(n.children);
    }
  };
  walk(sections);
  return ids;
}

/**
 * Re-derive the realization set from the parts' live section mappings, one
 * untagged `Realization` per (part, live section) overlap. Any existing tag / note
 * / authored-origin is carried forward by (partId, sectionId) key; a realization
 * whose overlap has vanished is dropped (annotate-only, like part staleness).
 * Deterministic and idempotent: seeding twice over the same inputs is a no-op.
 */
export function seedRealizations(
  parts: StructuralPart[],
  sections: Section[],
  existing: Realization[],
): Realization[] {
  const live = liveSectionIds(sections);
  const prior = new Map<string, Realization>();
  for (const r of existing) prior.set(realizationKey(r.partId, r.sectionId), r);

  const seen = new Set<string>();
  const out: Realization[] = [];
  for (const p of parts) {
    for (const sid of p.sectionIds) {
      if (!live.has(sid)) continue;
      const key = realizationKey(p.id, sid);
      if (seen.has(key)) continue; // a part listing the same section twice
      seen.add(key);
      const kept = prior.get(key);
      out.push({
        id: computeHash(`${p.id}|${sid}`),
        partId: p.id,
        sectionId: sid,
        functionTag: kept?.functionTag,
        note: kept?.note,
        origin: kept?.origin ?? 'seeded',
      });
    }
  }
  return out;
}

/** Tag (or re-tag) one realization by id, promoting it to an authored annotation. */
export function tagRealization(
  realizations: Realization[],
  id: string,
  functionTag: FunctionTag | undefined,
): Realization[] {
  return realizations.map((r) =>
    r.id === id ? { ...r, functionTag, origin: 'authored' as const } : r,
  );
}

// --- Declared vs computed center -------------------------------------------

export interface CenterDivergence {
  /** Ids of the parts the writer has declared to be the center. */
  declaredIds: string[];
  /** The computed radix — the section ids the arrows point at (may be several). */
  computedRadix: string[];
  /** Declared-center parts realized on NONE of the radix sections (the divergence). */
  divergentIds: string[];
  /** True when at least one declared center sits off the computed radix. */
  diverges: boolean;
}

/**
 * Compare the writer's DECLARED center(s) against the radix engine's COMPUTED
 * center. A declared-center part aligns when it realizes (maps onto) at least one
 * radix section; it diverges when it maps onto none. This is a NEUTRAL structural
 * fact — a declaration held up against a computation — never a verdict, and it
 * never replaces the radix. With no declaration, or an empty computed radix,
 * nothing diverges.
 */
export function computeCenterDivergence(parts: StructuralPart[], centering: Centering): CenterDivergence {
  const declared = parts.filter((p) => p.declaredCenter);
  const radix = centering.radix ?? [];
  const radixSet = new Set(radix);
  const divergentIds =
    radix.length === 0
      ? []
      : declared.filter((p) => !p.sectionIds.some((sid) => radixSet.has(sid))).map((p) => p.id);
  return {
    declaredIds: declared.map((p) => p.id),
    computedRadix: radix,
    divergentIds,
    diverges: divergentIds.length > 0,
  };
}

// --- Summary (the consuming passes) ----------------------------------------

const plural = (n: number): string => (n === 1 ? '' : 's');

/**
 * A compact one-line summary of the discovered CONFIGURATION for the consuming
 * passes (coach, dependencies): the part-to-part edges + how many realizations the
 * writer has function-tagged — the relational facts the per-section table and the
 * flat parts list structurally cannot carry. Empty string when there is no
 * configuration yet (no edges and no tags), so a caller appends nothing and
 * degrades to its prior behavior — mirroring `summarizeParts`.
 */
export function summarizeGraph(
  parts: StructuralPart[],
  edges: StructuralEdge[],
  realizations: Realization[],
): string {
  void parts;
  const tagged = realizations.filter((r) => !!r.functionTag).length;
  if (edges.length === 0 && tagged === 0) return '';
  const kindCounts = new Map<StructuralEdgeKind, number>();
  for (const e of edges) kindCounts.set(e.kind, (kindCounts.get(e.kind) ?? 0) + 1);
  const kindList = Array.from(kindCounts.entries())
    .map(([k, n]) => `${n} ${k}`)
    .join(', ');
  const edgePhrase = edges.length
    ? `${edges.length} part-to-part edge${plural(edges.length)}${kindList ? ` (${kindList})` : ''}`
    : '';
  const tagPhrase = tagged ? `${tagged} function-tagged realization${plural(tagged)}` : '';
  const body = [edgePhrase, tagPhrase].filter(Boolean).join('; ');
  return body ? `W₁ configuration: ${body}.` : '';
}
