import { describe, expect, it } from 'vitest';
import { buildMeshContext, checkCommitmentMesh, declaredHeapSet } from '../diagnostic-helpers';
import type { LedgerEntry, Section, SectionSpec } from '../../types';

const sec = (id: string, level: number, parentId: string, children: Section[] = []): Section => ({
  id,
  title: id.toUpperCase(),
  level,
  content: '',
  fullContent: '',
  startLine: 0,
  endLine: 0,
  startOffset: 0,
  wordCount: 1,
  children,
  parentId,
});

const spec = (over: Partial<SectionSpec>): SectionSpec => ({
  function: 'argue',
  mainClaim: '',
  requiredMoves: [],
  incomingContext: [],
  outgoingCommitments: [],
  ...over,
});

const iou = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: 'e1',
  kind: 'iou',
  openedAtSectionId: 's1',
  owes: '',
  status: 'open',
  createdBy: 'user',
  createdAt: '2026-07-03T10-00-00',
  modifiedAt: '2026-07-03T10-00-00',
  ...over,
});

// Four top-level sections in reading order. s1 makes a commitment consumed only by
// s4 (a NON-adjacent later section) — the exact muddle-#3 false positive.
const flat: Section[] = [sec('s1', 1, 'root'), sec('s2', 1, 'root'), sec('s3', 1, 'root'), sec('s4', 1, 'root')];
const flatSpecs: Record<string, SectionSpec | undefined> = {
  s1: spec({ outgoingCommitments: ['the framework lemma'] }),
  s2: spec({ incomingContext: ['unrelated preliminary matter'] }), // non-empty → the dangling guard can judge
  s3: spec({ incomingContext: ['something else entirely'] }),
  s4: spec({ incomingContext: ['the framework lemma carries the argument'] }), // consumes s1, far downstream
};

describe('checkCommitmentMesh — adjacency (no ctx) is unchanged', () => {
  it("flags a dangling commitment the NEXT sibling doesn't consume", () => {
    const findings = checkCommitmentMesh('s1', flat, flatSpecs);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('dangling-outgoing');
    expect(findings[0].detail).toBe('the framework lemma');
  });
});

describe('checkCommitmentMesh — distance widening (muddle #3 repair)', () => {
  it('silences a dangling commitment consumed by a non-adjacent LATER section', () => {
    const ctx = buildMeshContext(flat, flatSpecs);
    expect(checkCommitmentMesh('s1', flat, flatSpecs, ctx)).toEqual([]);
  });

  it('silences an unmet-incoming met by a non-adjacent EARLIER section', () => {
    // Nested: chapter c1 with subsections a, b, c. c needs a's distinction (a is earlier,
    // but the ADJACENT prev is b, whose outgoing does not match) — a false unmet without widening.
    const a = sec('a', 2, 'c1');
    const b = sec('b', 2, 'c1');
    const c = sec('c', 2, 'c1');
    const sections = [sec('c1', 1, 'root', [a, b, c])];
    const specs: Record<string, SectionSpec | undefined> = {
      c1: spec({ mainClaim: 'the chapter' }),
      a: spec({ outgoingCommitments: ['the pivotal distinction is drawn'] }),
      b: spec({ outgoingCommitments: ['some transitional remark'] }), // adjacent prev of c; no match
      c: spec({ incomingContext: ['the pivotal distinction grounds this'] }),
    };
    // Without widening → flagged; with → silent.
    expect(checkCommitmentMesh('c', sections, specs).some((f) => f.kind === 'unmet-incoming')).toBe(true);
    expect(checkCommitmentMesh('c', sections, specs, buildMeshContext(sections, specs))).toEqual([]);
  });
});

describe('checkCommitmentMesh — paid-IOU cover', () => {
  it('silences a commitment covered by a paid IOU', () => {
    // A trimmed doc where NO later section consumes s1's commitment (so widening alone won't silence).
    const two: Section[] = [sec('s1', 1, 'root'), sec('s2', 1, 'root')];
    const specs: Record<string, SectionSpec | undefined> = {
      s1: spec({ outgoingCommitments: ['the orphan commitment stands'] }),
      s2: spec({ incomingContext: ['a wholly unrelated preliminary'] }),
    };
    expect(checkCommitmentMesh('s1', two, specs, buildMeshContext(two, specs))).toHaveLength(1); // still dangling
    const paid = iou({ status: 'paid', owes: 'the orphan commitment stands' });
    expect(checkCommitmentMesh('s1', two, specs, buildMeshContext(two, specs, [paid]))).toEqual([]);
  });
});

describe('checkCommitmentMesh — declared heap', () => {
  it('suppresses all interlock findings under a declared-heap section (self + descendants)', () => {
    const child = sec('leaf', 2, 'agg');
    const sections = [sec('agg', 1, 'root', [child])];
    const specs: Record<string, SectionSpec | undefined> = {
      agg: spec({ outgoingCommitments: ['dangles nowhere'] }),
      leaf: spec({ incomingContext: ['needs nothing given'] }),
    };
    const heap = iou({ kind: 'declared-heap', openedAtSectionId: 'agg', owes: 'honest heap' });
    const ctx = buildMeshContext(sections, specs, [heap]);
    expect(ctx.declaredHeap.has('agg')).toBe(true);
    expect(ctx.declaredHeap.has('leaf')).toBe(true); // descendant is exempt too
    expect(checkCommitmentMesh('agg', sections, specs, ctx)).toEqual([]);
    expect(checkCommitmentMesh('leaf', sections, specs, ctx)).toEqual([]);
  });

  it('declaredHeapSet is empty with no open declared-heap entry', () => {
    const sections = [sec('x', 1, 'root')];
    expect(declaredHeapSet(sections, []).size).toBe(0);
    const waived = iou({ kind: 'declared-heap', openedAtSectionId: 'x', status: 'waived' });
    expect(declaredHeapSet(sections, [waived]).size).toBe(0); // waived → no longer exempt
  });
});
