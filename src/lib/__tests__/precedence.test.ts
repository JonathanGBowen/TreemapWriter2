import { describe, expect, it } from 'vitest';
import {
  buildGraspOrder,
  checkAdmissibility,
  classifyBackwardArcs,
  commutableRuns,
  deliberateTensionPairs,
  deriveConstraints,
  formatOrderEvidence,
  nonLinearizableRegions,
  normalizePrecedenceData,
  type ExpositionStrategy,
  type PrecedenceConstraint,
} from '../precedence';
import type { FunctionTag, LedgerEntry, Realization, StructuralEdge, StructuralEdgeKind } from '../../types';

// --- builders --------------------------------------------------------------

let edgeN = 0;
const edge = (kind: StructuralEdgeKind, from: string, to: string, over?: Partial<StructuralEdge>): StructuralEdge => ({
  id: `e${edgeN++}`,
  kind,
  fromPartId: from,
  toPartId: to,
  origin: 'authored',
  status: 'accepted',
  ...over,
});

const rz = (partId: string, sectionId: string, functionTag?: FunctionTag): Realization => ({
  id: `${partId}|${sectionId}`,
  partId,
  sectionId,
  functionTag,
  origin: 'seeded',
});

const iou = (openedAtSectionId: string, status: LedgerEntry['status']): LedgerEntry => ({
  id: `iou-${openedAtSectionId}-${status}`,
  kind: 'iou',
  openedAtSectionId,
  owes: 'a debt',
  status,
  createdBy: 'user',
  createdAt: '2026-07-04T00:00:00Z',
  modifiedAt: '2026-07-04T00:00:00Z',
});

// docIndexOf from a {sectionId: index} record.
const docIndexer = (m: Record<string, number>) => (sid: string) => (sid in m ? m[sid] : undefined);

// --- deriveConstraints -----------------------------------------------------

describe('deriveConstraints', () => {
  it('defines(a→b) ⇒ a before b (definition-before-use)', () => {
    const [c] = deriveConstraints([edge('defines', 'a', 'b')]);
    expect(c).toMatchObject({ before: 'a', after: 'b', reason: 'definition-before-use', source: 'derived' });
    expect(c.derivedFrom?.rule).toBe('defines→definition-before-use');
  });

  it('answers(reply→objection) ⇒ objection before reply (gap-before-filling — the inversion)', () => {
    // edge fromPartId = reply, toPartId = objection; the objection is the gap.
    const [c] = deriveConstraints([edge('answers', 'reply', 'objection')]);
    expect(c).toMatchObject({ before: 'objection', after: 'reply', reason: 'gap-before-filling' });
  });

  it('grounds is strategy-relative: systematic yields ground-before-lean, genetic yields nothing', () => {
    const e = [edge('grounds', 'g', 'lean')];
    const sys = deriveConstraints(e, () => 'systematic');
    expect(sys).toHaveLength(1);
    expect(sys[0]).toMatchObject({ before: 'g', after: 'lean', reason: 'ground-before-lean' });
    expect(deriveConstraints(e, () => 'genetic')).toHaveLength(0);
    expect(deriveConstraints(e, () => 'reference')).toHaveLength(0);
    expect(deriveConstraints(e, () => 'spiral')).toHaveLength(1); // spiral behaves systematic for grounds
  });

  it('strategyOf keys on the ground/source part', () => {
    const strat = (id: string): ExpositionStrategy => (id === 'g1' ? 'genetic' : 'systematic');
    const out = deriveConstraints([edge('grounds', 'g1', 'x'), edge('grounds', 'g2', 'y')], strat);
    expect(out.map((c) => c.before)).toEqual(['g2']); // g1's grounds suppressed
  });

  it('requires / qualifies / exemplifies / opposes generate no precedence', () => {
    const out = deriveConstraints([
      edge('requires', 'a', 'b'),
      edge('qualifies', 'a', 'b'),
      edge('exemplifies', 'a', 'b'),
      edge('opposes', 'a', 'b'),
    ]);
    expect(out).toEqual([]);
  });

  it('excludes proposed (advisory) edges', () => {
    expect(deriveConstraints([edge('defines', 'a', 'b', { status: 'proposed' })])).toEqual([]);
  });

  it('is deterministic — content-stable ids across runs, deduped', () => {
    const e = [edge('defines', 'a', 'b')];
    const id1 = deriveConstraints(e)[0].id;
    const id2 = deriveConstraints(e)[0].id;
    expect(id1).toBe(id2);
  });

  it('skips a self-referential edge (before === after)', () => {
    expect(deriveConstraints([edge('defines', 'a', 'a')])).toEqual([]);
  });
});

describe('deliberateTensionPairs', () => {
  it('collects unordered opposes pairs', () => {
    const s = deliberateTensionPairs([edge('opposes', 'b', 'a'), edge('defines', 'x', 'y')]);
    expect(s.has('a\nb')).toBe(true);
    expect(s.size).toBe(1);
  });
});

// --- buildGraspOrder -------------------------------------------------------

describe('buildGraspOrder', () => {
  it('orders parts by the minimum docIndex over their realizations', () => {
    const g = buildGraspOrder(
      [rz('p1', 's2'), rz('p1', 's5'), rz('p2', 's1')],
      docIndexer({ s1: 1, s2: 2, s5: 5 }),
    );
    expect(g.order).toEqual(['p2', 'p1']);
    expect(g.graspDocIndexOf.get('p1')).toBe(2);
    expect(g.graspStationOf.get('p2')).toBe('s1');
  });

  it('prefers an introduce/open-gap realization as the grasp point over an earlier untagged one', () => {
    const g = buildGraspOrder(
      [rz('p1', 's2', 'recur'), rz('p1', 's5', 'introduce')],
      docIndexer({ s2: 2, s5: 5 }),
    );
    // even though s2 (docIndex 2) is earlier, the grasp is the introduce at s5.
    expect(g.graspDocIndexOf.get('p1')).toBe(5);
  });

  it('excludes germ / unrealized parts (positionless) and dangling sections', () => {
    const g = buildGraspOrder([rz('p1', 'sMissing')], docIndexer({ s1: 1 }));
    expect(g.order).toEqual([]);
    expect(g.graspDocIndexOf.has('p1')).toBe(false);
  });
});

// --- checkAdmissibility ----------------------------------------------------

const constraint = (before: string, after: string, over?: Partial<PrecedenceConstraint>): PrecedenceConstraint => ({
  id: `${before}->${after}`,
  before,
  after,
  reason: 'ground-before-lean',
  source: 'derived',
  status: 'active',
  ...over,
});

describe('checkAdmissibility', () => {
  const grasp = buildGraspOrder([rz('a', 's0'), rz('b', 's1')], docIndexer({ s0: 0, s1: 1 }));

  it('marks a satisfied constraint (before grasped first)', () => {
    const r = checkAdmissibility(grasp, [constraint('a', 'b')]);
    expect(r.violations).toHaveLength(0);
    expect(r.satisfiedCount).toBe(1);
    expect(r.admissibility).toBe(1);
  });

  it('marks a violated constraint (after grasped first)', () => {
    const r = checkAdmissibility(grasp, [constraint('b', 'a')]);
    expect(r.violations).toHaveLength(1);
    expect(r.admissibility).toBe(0);
  });

  it('is inapplicable for a positionless endpoint or an equal station', () => {
    const rMissing = checkAdmissibility(grasp, [constraint('a', 'ghost')]);
    expect(rMissing.applicableCount).toBe(0);
    const same = buildGraspOrder([rz('a', 's0'), rz('b', 's0')], docIndexer({ s0: 0 }));
    const rSame = checkAdmissibility(same, [constraint('a', 'b')]);
    expect(rSame.applicableCount).toBe(0);
  });

  it('ignores non-active constraints', () => {
    const r = checkAdmissibility(grasp, [constraint('b', 'a', { status: 'suspended' })]);
    expect(r.violations).toHaveLength(0);
    expect(r.applicableCount).toBe(0);
  });
});

// --- commutableRuns --------------------------------------------------------

describe('commutableRuns', () => {
  it('groups independent parts into one arbitrary-order run', () => {
    const grasp = buildGraspOrder([rz('a', 's0'), rz('b', 's1'), rz('c', 's2')], docIndexer({ s0: 0, s1: 1, s2: 2 }));
    const runs = commutableRuns(grasp, []);
    expect(runs).toHaveLength(1);
    expect(runs[0].partIds).toEqual(['a', 'b', 'c']);
  });

  it('produces no run when every consecutive pair is ordered', () => {
    const grasp = buildGraspOrder([rz('a', 's0'), rz('b', 's1')], docIndexer({ s0: 0, s1: 1 }));
    expect(commutableRuns(grasp, [constraint('a', 'b')])).toEqual([]);
  });

  it('finds the commutable middle of a diamond', () => {
    // a → b, a → c, b → d, c → d : b and c are incomparable.
    const grasp = buildGraspOrder(
      [rz('a', 's0'), rz('b', 's1'), rz('c', 's2'), rz('d', 's3')],
      docIndexer({ s0: 0, s1: 1, s2: 2, s3: 3 }),
    );
    const runs = commutableRuns(grasp, [
      constraint('a', 'b'),
      constraint('a', 'c'),
      constraint('b', 'd'),
      constraint('c', 'd'),
    ]);
    // b,c form a commutable run (a precedes them, d follows them).
    expect(runs.some((r) => r.partIds.includes('b') && r.partIds.includes('c'))).toBe(true);
  });
});

// --- nonLinearizableRegions ------------------------------------------------

describe('nonLinearizableRegions', () => {
  it('detects a two-node cycle', () => {
    const cycles = nonLinearizableRegions([constraint('a', 'b'), constraint('b', 'a')]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].partIds.sort()).toEqual(['a', 'b']);
    expect(cycles[0].constraintIds.length).toBe(2);
  });

  it('returns none for an acyclic constraint set', () => {
    expect(nonLinearizableRegions([constraint('a', 'b'), constraint('b', 'c')])).toEqual([]);
  });

  it('terminates on a longer cycle', () => {
    const cycles = nonLinearizableRegions([constraint('a', 'b'), constraint('b', 'c'), constraint('c', 'a')]);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].partIds.sort()).toEqual(['a', 'b', 'c']);
  });
});

// --- classifyBackwardArcs --------------------------------------------------

describe('classifyBackwardArcs', () => {
  // One backward arc: prerequisite section sP (late) needed by dependent sT (early).
  const arc = { source: 'sP', target: 'sT', type: 'prerequisite' as const };
  const base = {
    backwardArcs: ['arc1'],
    arcById: (id: string) => (id === 'arc1' ? arc : undefined),
    arcCount: 1,
  };
  // sT realizes the objection; sP realizes the reply.
  const partsOfSection = (sid: string): Set<string> =>
    sid === 'sT' ? new Set(['objection']) : sid === 'sP' ? new Set(['reply']) : new Set();

  it('a constraint endorsing dependent-before-prerequisite covers the arc', () => {
    // answers(reply→objection) ⇒ before=objection (∈sT), after=reply (∈sP): endorses the observed order.
    const constraints = deriveConstraints([edge('answers', 'reply', 'objection')]);
    const v = classifyBackwardArcs({ ...base, partsOfSection, constraints, ledger: [] });
    expect(v.coverByArc.get('arc1')).toBe('covered');
    expect(v.uncoveredCount).toBe(0);
  });

  it('an open IOU at the dependent covers; a paid IOU does not', () => {
    const open = classifyBackwardArcs({ ...base, partsOfSection, constraints: [], ledger: [iou('sT', 'open')] });
    expect(open.coverByArc.get('arc1')).toBe('covered');
    const paid = classifyBackwardArcs({ ...base, partsOfSection, constraints: [], ledger: [iou('sT', 'paid')] });
    expect(paid.coverByArc.get('arc1')).toBe('uncovered');
  });

  it('a reference arc is auto-covered', () => {
    const refArc = { source: 'sP', target: 'sT', type: 'reference' as const };
    const v = classifyBackwardArcs({
      ...base,
      arcById: () => refArc,
      partsOfSection: () => new Set(),
      constraints: [],
      ledger: [],
    });
    expect(v.coverByArc.get('arc1')).toBe('covered');
  });

  it('with no constraints and no IOUs, every backward arc is uncovered and orderMiscentering === raw miscentering', () => {
    const v = classifyBackwardArcs({ ...base, partsOfSection: () => new Set(), constraints: [], ledger: [] });
    expect(v.uncoveredCount).toBe(1);
    // raw miscentering = backwardCount / arcCount = 1 / 1 = 1
    expect(v.orderMiscentering).toBe(1);
  });
});

describe('formatOrderEvidence', () => {
  it('is empty when there is nothing to say', () => {
    const empty = classifyBackwardArcs({ backwardArcs: [], arcById: () => undefined, arcCount: 0, partsOfSection: () => new Set(), constraints: [], ledger: [] });
    const admiss = checkAdmissibility(buildGraspOrder([], docIndexer({})), []);
    expect(formatOrderEvidence(empty, admiss)).toBe('');
  });
});

// --- backward-compat: normalizePrecedenceData ------------------------------

describe('normalizePrecedenceData', () => {
  it('defaults an absent precedence blob to three empty arrays', () => {
    expect(normalizePrecedenceData(undefined)).toEqual({ regions: [], authored: [], overrides: [] });
    expect(normalizePrecedenceData(null)).toEqual({ regions: [], authored: [], overrides: [] });
  });

  it('fills missing sub-arrays on a PARTIAL object (the crash the modal used to hit)', () => {
    // An old sidecar written before `authored`/`overrides` existed: truthy, so the
    // `?? {…}` default never fired and `precedence.overrides.map` threw.
    const out = normalizePrecedenceData({ regions: [{ id: 'r1', partIds: [], expositionStrategy: 'systematic' }] });
    expect(out.regions).toHaveLength(1);
    expect(out.authored).toEqual([]);
    expect(out.overrides).toEqual([]);
  });

  it('coerces non-array sub-fields (a garbage/legacy shape) to []', () => {
    const out = normalizePrecedenceData({ regions: 'nope', authored: null, overrides: 42 });
    expect(out).toEqual({ regions: [], authored: [], overrides: [] });
  });

  it('passes a fully-formed object through unchanged', () => {
    const full = {
      regions: [{ id: 'r1', partIds: ['p1'], expositionStrategy: 'genetic' }],
      authored: [{ id: 'c1', before: 'a', after: 'b', reason: 'custom', source: 'authored', status: 'active' }],
      overrides: [{ constraintId: 'c1', status: 'suspended' }],
    };
    expect(normalizePrecedenceData(full)).toEqual(full);
  });
});

// --- perf budget (< 50 ms over a large synthetic graph) --------------------

describe('precedence perf budget', () => {
  it('runs the full pipeline under 50ms on ~500 parts / ~800 edges', () => {
    const N = 500;
    const realizations: Realization[] = [];
    const doc: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      doc[`s${i}`] = i;
      realizations.push(rz(`p${i}`, `s${i}`, i % 3 === 0 ? 'introduce' : undefined));
    }
    const kinds: StructuralEdgeKind[] = ['defines', 'answers', 'grounds'];
    const edges: StructuralEdge[] = [];
    for (let k = 0; k < 800; k++) {
      edges.push(edge(kinds[k % 3], `p${k % N}`, `p${(k * 7 + 1) % N}`));
    }
    const docIndexOf = docIndexer(doc);
    const partsOfSection = (sid: string): Set<string> => {
      const idx = doc[sid];
      return idx === undefined ? new Set() : new Set([`p${idx}`]);
    };
    const run = () => {
      const constraints = deriveConstraints(edges);
      const grasp = buildGraspOrder(realizations, docIndexOf);
      const admiss = checkAdmissibility(grasp, constraints);
      commutableRuns(grasp, constraints);
      nonLinearizableRegions(constraints);
      const backwardArcs = Array.from({ length: 300 }, (_, i) => `arc${i}`);
      classifyBackwardArcs({
        backwardArcs,
        arcById: (id) => ({ source: `s${(+id.slice(3) + 5) % N}`, target: `s${+id.slice(3)}`, type: 'prerequisite' }),
        arcCount: backwardArcs.length,
        partsOfSection,
        constraints,
        ledger: [],
      });
      return admiss;
    };
    run(); // warmup (JIT + first-call allocation)
    const t0 = performance.now();
    run();
    const elapsed = performance.now() - t0;
    // Measured is sub-millisecond; the loose bound only catches an accidental
    // super-linear regression (there is no other timing test in the repo).
    expect(elapsed).toBeLessThan(50);
  });
});
