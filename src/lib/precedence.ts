// The PRECEDENCE engine (Arpeggio Phase 5) — the diagnosis-half repair of the
// "wrong order-norm" muddle. The shipped order-norm ("reading order should track
// prerequisite order") measures divergence from LOGICAL dependence and calls any
// nonzero value pathology. But the precedence that binds composition is the
// dynamics of a reader's GRASPING, which can legitimately invert entailment — a
// gap felt before it is filled, an instance before its rule, a conclusion asserted
// first as a promissory gap.
//
// This module derives part-level `PrecedenceConstraint`s from the Phase-2 W₁
// edges (strategy-relative), computes a GRASP ORDER (parts ordered by their
// realizations' document position), checks admissibility / commutable runs /
// non-linearizable regions over the CONSTRAINT graph, and — the completion of the
// Phase-0 softening — classifies each raw backward arc COVERED (a deliberate
// inversion, or a live IOU) vs UNCOVERED (a genuine read-ahead).
//
// Pure: no React, no store, no SDK. Sibling of `structural-graph-helpers.ts` —
// content-stable ids via `computeHash`, empty-array/empty-string degradation, and
// the shared graph helpers in `graph-scc.ts`. `computeCentering` is left entirely
// unchanged; this is an additive layer.

import type {
  ExpositionStrategy,
  FunctionTag,
  LedgerEntry,
  PrecedenceConstraint,
  PrecedenceData,
  PrecedenceReason,
  PrecedenceRule,
  Realization,
  StructuralEdge,
} from '../types';
import { computeHash } from './utils';
import { reachAll, sccGroups } from './graph-scc';

// The data-model types (PrecedenceConstraint, PrecedenceReason, ExpositionStrategy,
// PrecedenceStatus, PrecedenceRule, PrecedenceRegion, …) live in `../types`; this
// module owns only the COMPUTED result types + the derivation/checking functions.
export type { ExpositionStrategy, PrecedenceConstraint, PrecedenceReason } from '../types';

// --- Types -----------------------------------------------------------------

/**
 * The reasons that legitimately INVERT logical order — an inverting-reason
 * constraint spanning a backward arc's endpoints licenses (covers) that arc.
 */
export const INVERTING_REASONS: ReadonlySet<PrecedenceReason> = new Set<PrecedenceReason>([
  'gap-before-filling',
  'overthrow-before-recentering',
  'debt-before-payment',
]);

// --- Derivation from the W₁ edges ------------------------------------------

/**
 * Derive precedence constraints from the accepted W₁ edges, per Arpeggio §5.
 * Strategy-relative: `strategyOf(fromPartId)` resolves an edge's region strategy
 * (default `'systematic'`), which parameterizes the `grounds` rule. Proposed
 * (advisory) edges never generate a diagnosis. Empty in → empty out.
 */
export function deriveConstraints(
  edges: StructuralEdge[],
  strategyOf: (fromPartId: string) => ExpositionStrategy = () => 'systematic',
): PrecedenceConstraint[] {
  const byId = new Map<string, PrecedenceConstraint>();
  const add = (before: string, after: string, reason: PrecedenceReason, rule: PrecedenceRule, edgeId: string) => {
    if (before === after) return;
    const id = computeHash(`${reason}|${before}|${after}|${edgeId}`);
    if (!byId.has(id)) {
      byId.set(id, { id, before, after, reason, source: 'derived', derivedFrom: { rule, edgeId }, status: 'active' });
    }
  };
  for (const e of edges) {
    if (e.status === 'proposed') continue; // advisory edges never diagnose
    switch (e.kind) {
      case 'defines': // definition → user of the term
        add(e.fromPartId, e.toPartId, 'definition-before-use', 'defines→definition-before-use', e.id);
        break;
      case 'answers': // reply → objection: the objection is the GAP, grasped first
        add(e.toPartId, e.fromPartId, 'gap-before-filling', 'answers→gap-before-filling', e.id);
        break;
      case 'grounds': {
        const strat = strategyOf(e.fromPartId);
        // systematic/spiral → ground-before-lean; genetic/reference leave grounds
        // order-free (genetic's overthrow-before-recentering awaits a Phase-8
        // problem/old-view designation field — see the plan's ambiguity call).
        if (strat === 'systematic' || strat === 'spiral') {
          add(e.fromPartId, e.toPartId, 'ground-before-lean', 'grounds/systematic→ground-before-lean', e.id);
        }
        break;
      }
      default:
        // requires / qualifies / exemplifies / opposes generate no precedence.
        break;
    }
  }
  return [...byId.values()];
}

/** Unordered `a\nb` keys for the `opposes` pairs (a deliberate-tension D1 exemption, Phase 8). */
export function deliberateTensionPairs(edges: StructuralEdge[]): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.kind !== 'opposes') continue;
    const [a, b] = [e.fromPartId, e.toPartId].slice().sort();
    out.add(`${a}\n${b}`);
  }
  return out;
}

// --- Grasp order (parts ordered by where they enter the reading sequence) ---

/** The function tags that mark a first GRASP (not a later `recur`/`pay`/`summarize` return). */
const GRASP_TAGS: ReadonlySet<FunctionTag> = new Set<FunctionTag>(['introduce', 'open-gap']);

export interface GraspOrder {
  /** Parts with a grasp position, ascending by document position then id. */
  order: string[];
  /** partId → docIndex of its grasp-point section. A part absent here is positionless. */
  graspDocIndexOf: Map<string, number>;
  /** partId → the grasp-point section id (where SPINE marks attach). */
  graspStationOf: Map<string, string>;
}

/**
 * Order the parts by where each is first GRASPED: the minimum `docIndex` over its
 * realizations, preferring the `introduce`/`open-gap`-tagged subset when non-empty
 * (a grasp point, not a later return). Parts with no live realization (germ /
 * unrealized) are positionless — absent from the maps — and excluded from checks.
 */
export function buildGraspOrder(
  realizations: Realization[],
  docIndexOf: (sectionId: string) => number | undefined,
): GraspOrder {
  const byPart = new Map<string, { sectionId: string; docIndex: number; grasp: boolean }[]>();
  for (const r of realizations) {
    const di = docIndexOf(r.sectionId);
    if (di === undefined) continue; // dangling section — not in the sequence
    const list = byPart.get(r.partId) ?? [];
    list.push({ sectionId: r.sectionId, docIndex: di, grasp: r.functionTag !== undefined && GRASP_TAGS.has(r.functionTag) });
    byPart.set(r.partId, list);
  }
  const graspDocIndexOf = new Map<string, number>();
  const graspStationOf = new Map<string, string>();
  for (const [partId, list] of byPart) {
    const pool = list.some((x) => x.grasp) ? list.filter((x) => x.grasp) : list;
    const earliest = pool.reduce((best, x) => (x.docIndex < best.docIndex ? x : best), pool[0]);
    graspDocIndexOf.set(partId, earliest.docIndex);
    graspStationOf.set(partId, earliest.sectionId);
  }
  const order = [...graspDocIndexOf.keys()].sort((a, b) => {
    const d = (graspDocIndexOf.get(a) as number) - (graspDocIndexOf.get(b) as number);
    return d !== 0 ? d : a < b ? -1 : a > b ? 1 : 0;
  });
  return { order, graspDocIndexOf, graspStationOf };
}

// --- Admissibility ---------------------------------------------------------

export type ConstraintVerdict = 'satisfied' | 'violated' | 'inapplicable';

export interface PrecedenceViolation {
  constraintId: string;
  before: string;
  after: string;
  reason: PrecedenceReason;
}

export interface AdmissibilityResult {
  byConstraint: Map<string, ConstraintVerdict>;
  violations: PrecedenceViolation[];
  satisfiedCount: number;
  applicableCount: number;
  admissibility: number; // satisfied / max(1, applicable)
}

/**
 * Check the grasp order against the constraints. A constraint is `inapplicable`
 * when either endpoint is positionless or both are grasped at the same station
 * (order indeterminate — err toward silence); `violated` when the `after` part is
 * grasped strictly before the `before` part; else `satisfied`. O(constraints).
 */
export function checkAdmissibility(grasp: GraspOrder, constraints: PrecedenceConstraint[]): AdmissibilityResult {
  const byConstraint = new Map<string, ConstraintVerdict>();
  const violations: PrecedenceViolation[] = [];
  let satisfied = 0;
  let applicable = 0;
  for (const c of constraints) {
    if (c.status !== 'active') {
      byConstraint.set(c.id, 'inapplicable');
      continue;
    }
    const bi = grasp.graspDocIndexOf.get(c.before);
    const ai = grasp.graspDocIndexOf.get(c.after);
    if (bi === undefined || ai === undefined || bi === ai) {
      byConstraint.set(c.id, 'inapplicable');
      continue;
    }
    applicable++;
    if (ai < bi) {
      byConstraint.set(c.id, 'violated');
      violations.push({ constraintId: c.id, before: c.before, after: c.after, reason: c.reason });
    } else {
      byConstraint.set(c.id, 'satisfied');
      satisfied++;
    }
  }
  return {
    byConstraint,
    violations,
    satisfiedCount: satisfied,
    applicableCount: applicable,
    admissibility: satisfied / Math.max(1, applicable),
  };
}

// --- Commutable runs (spans whose order is arbitrary) ----------------------

export interface CommutableRun {
  startIndex: number; // index into GraspOrder.order
  endIndex: number;
  partIds: string[];
}

/**
 * Maximal contiguous runs of the grasp order whose members are pairwise
 * incomparable under the active constraints (their relative order is arbitrary —
 * "order arbitrary here"). Left-greedy: from each start, extend while the next
 * part is incomparable to every current member. Runs of length ≥ 2 are returned.
 */
export function commutableRuns(grasp: GraspOrder, constraints: PrecedenceConstraint[]): CommutableRun[] {
  const order = grasp.order;
  if (order.length < 2) return [];
  const adj = new Map<string, string[]>();
  for (const id of order) adj.set(id, []);
  for (const c of constraints) {
    if (c.status !== 'active') continue;
    if (!adj.has(c.before) || !adj.has(c.after)) continue;
    (adj.get(c.before) as string[]).push(c.after);
  }
  const reach = reachAll(order, adj);
  const comparable = (a: string, b: string) => (reach.get(a) as Set<string>).has(b) || (reach.get(b) as Set<string>).has(a);
  const runs: CommutableRun[] = [];
  let i = 0;
  while (i < order.length) {
    const members = [order[i]];
    let j = i + 1;
    while (j < order.length && members.every((m) => !comparable(m, order[j]))) {
      members.push(order[j]);
      j++;
    }
    if (members.length >= 2) {
      runs.push({ startIndex: i, endIndex: j - 1, partIds: [...members] });
      i = j;
    } else {
      i += 1;
    }
  }
  return runs;
}

// --- Non-linearizable regions (cycles in the constraint graph) -------------

export interface PrecedenceCycle {
  partIds: string[];
  constraintIds: string[];
}

/**
 * Strongly-connected components (size > 1) of the `before→after` constraint DAG —
 * regions no linear extension can satisfy (a spiral / IOU / pointer-beyond-medium
 * strategy is needed). `requires` needs no special-casing: a cycle appears iff the
 * other rules' constraints already close one.
 */
export function nonLinearizableRegions(constraints: PrecedenceConstraint[]): PrecedenceCycle[] {
  const active = constraints.filter((c) => c.status === 'active');
  const ids: string[] = [];
  const seen = new Set<string>();
  const adj = new Map<string, string[]>();
  const ensure = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
      adj.set(id, []);
    }
  };
  for (const c of active) {
    ensure(c.before);
    ensure(c.after);
    (adj.get(c.before) as string[]).push(c.after);
  }
  if (ids.length === 0) return [];
  const { compMembers } = sccGroups(ids, reachAll(ids, adj));
  const cycles: PrecedenceCycle[] = [];
  for (const members of compMembers.values()) {
    if (members.length < 2) continue;
    const memberSet = new Set(members);
    const constraintIds = active.filter((c) => memberSet.has(c.before) && memberSet.has(c.after)).map((c) => c.id);
    cycles.push({ partIds: members, constraintIds });
  }
  return cycles;
}

// --- The section-backward-arc reframe (covered vs uncovered) ---------------

export type BackwardCover = 'covered' | 'uncovered';

export interface OrderVerdict {
  coverByArc: Map<string, BackwardCover>;
  coverReasonByArc: Map<string, string>;
  coveredCount: number;
  uncoveredCount: number;
  /** uncovered / arcCount — the reframed miscentering (only genuine read-aheads count). */
  orderMiscentering: number;
}

export interface ClassifyInput {
  backwardArcs: Iterable<string>;
  arcById: (id: string) => { source: string; target: string; type: 'prerequisite' | 'reference' } | undefined;
  arcCount: number;
  /** Section id → the set of part ids realized there. */
  partsOfSection: (sectionId: string) => Set<string>;
  constraints: PrecedenceConstraint[];
  ledger: LedgerEntry[];
}

/** True iff the constraint's endpoints both fall within `partsS ∪ partsT`. */
function spansPair(c: PrecedenceConstraint, partsS: Set<string>, partsT: Set<string>): boolean {
  const inUnion = (id: string) => partsS.has(id) || partsT.has(id);
  return c.before !== c.after && inUnion(c.before) && inUnion(c.after);
}

/**
 * Why a backward arc (source S = prerequisite placed late, target T = dependent) is
 * COVERED, or null if uncovered. Err-toward-silence, existential over the
 * many-to-many part↔section mapping:
 *   (0) a reference (not a structural prerequisite) is low-stakes → covered;
 *   (i) an active constraint ENDORSES T-before-S (before∈T ∧ after∈S) — the order is right;
 *   (ii) an inverting-reason constraint spans the pair (either orientation) — deliberate;
 *   (iii) an OPEN IOU sits at the dependent T (arc-keyed, open-not-paid);
 *   (iv) an authored constraint spans the pair — the writer's own precedence.
 */
function coverReasonFor(
  arc: { source: string; target: string; type: 'prerequisite' | 'reference' },
  partsS: Set<string>,
  partsT: Set<string>,
  active: PrecedenceConstraint[],
  openIouAt: Set<string>,
): string | null {
  if (arc.type === 'reference') return 'a reference, not a structural prerequisite';
  for (const c of active) {
    if (partsT.has(c.before) && partsS.has(c.after)) return `endorsed by a ${c.reason} constraint`;
  }
  for (const c of active) {
    if (INVERTING_REASONS.has(c.reason) && spansPair(c, partsS, partsT)) return `a deliberate ${c.reason} inversion`;
  }
  if (openIouAt.has(arc.target)) return 'covered by an open IOU at the dependent';
  for (const c of active) {
    if (c.source === 'authored' && spansPair(c, partsS, partsT)) return "the writer's own precedence over the pair";
  }
  return null;
}

/**
 * Split the raw backward arcs into covered/uncovered (completing the Phase-0
 * softening). With no W₁ constraints and no open IOUs, every backward arc is
 * uncovered and `orderMiscentering === centering.miscentering` — nothing changes
 * until the writer has drawn argument structure.
 */
export function classifyBackwardArcs(input: ClassifyInput): OrderVerdict {
  const active = input.constraints.filter((c) => c.status === 'active');
  const openIouAt = new Set<string>();
  for (const e of input.ledger) if (e.kind === 'iou' && e.status === 'open') openIouAt.add(e.openedAtSectionId);

  const coverByArc = new Map<string, BackwardCover>();
  const coverReasonByArc = new Map<string, string>();
  let covered = 0;
  let uncovered = 0;
  for (const arcId of input.backwardArcs) {
    const arc = input.arcById(arcId);
    if (!arc) continue;
    const reason = coverReasonFor(arc, input.partsOfSection(arc.source), input.partsOfSection(arc.target), active, openIouAt);
    if (reason) {
      coverByArc.set(arcId, 'covered');
      coverReasonByArc.set(arcId, reason);
      covered++;
    } else {
      coverByArc.set(arcId, 'uncovered');
      uncovered++;
    }
  }
  return {
    coverByArc,
    coverReasonByArc,
    coveredCount: covered,
    uncoveredCount: uncovered,
    orderMiscentering: uncovered / Math.max(1, input.arcCount),
  };
}

// --- Backward-compat normalization (load boundary) -------------------------

/**
 * Normalize a possibly-partial `PrecedenceData` read from disk into the full
 * three-array shape every consumer assumes. An older `precedence.json` written
 * before `authored`/`overrides` existed is a truthy-but-partial object, so the
 * `?? {…}` default in `loadProject` does NOT fire and the missing sub-array stays
 * `undefined` — which then throws at `DependencyGraphModal`'s `precedence.overrides.map`
 * / `...precedence.authored`, crashing the whole modal. Coerce each sub-field
 * independently so absence, a partial object, or a non-array blob all degrade to `[]`.
 */
export function normalizePrecedenceData(raw: unknown): PrecedenceData {
  const p = (raw ?? {}) as Partial<PrecedenceData>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    regions: arr(p.regions),
    authored: arr(p.authored),
    overrides: arr(p.overrides),
  };
}

// --- AI evidence -----------------------------------------------------------

/** Neutral prose for the dependencies/coach passes; empty when there is nothing to say. */
export function formatOrderEvidence(verdict: OrderVerdict, admiss: AdmissibilityResult): string {
  const back = verdict.coveredCount + verdict.uncoveredCount;
  if (back === 0 && admiss.violations.length === 0) return '';
  const lines: string[] = [];
  if (back > 0) {
    lines.push(
      `${back} dependency link${back === 1 ? '' : 's'} run against reading order: ${verdict.coveredCount} covered by a deliberate inversion (gap-before-filling / an open IOU), ${verdict.uncoveredCount} uncovered.`,
    );
  }
  if (admiss.applicableCount > 0) {
    lines.push(
      `Grasping-order admissibility ${Math.round(admiss.admissibility * 100)}% (${admiss.satisfiedCount}/${admiss.applicableCount} precedence constraints satisfied).`,
    );
  }
  return lines.join('\n');
}
