import { describe, it, expect } from 'vitest';
import { checkCommitmentMesh } from '../diagnostic-helpers';
import { computeAllStrain } from '../strain-metrics';
import type { Section, SectionSpec, TestSuite, TestSuiteEntry } from '../../types';

// --- tiny builders -------------------------------------------------------
let counter = 0;
const sec = (id: string, title: string, children: Section[] = []): Section => ({
  id,
  title,
  level: 1,
  content: '',
  fullContent: '',
  startLine: 0,
  endLine: 0,
  startOffset: counter++,
  wordCount: 100,
  children,
  parentId: null,
});

const spec = (over: Partial<SectionSpec> = {}): SectionSpec => ({
  function: 'argue',
  mainClaim: '',
  requiredMoves: [],
  incomingContext: [],
  outgoingCommitments: [],
  ...over,
});

const entry = (over: Partial<TestSuiteEntry> = {}): TestSuiteEntry => ({
  goals: '',
  status: 'idle',
  ...over,
});

// A flat two-section doc: A then B (B follows A).
const A = sec('a', 'Chapter A');
const B = sec('b', 'Chapter B');
const SECTIONS: Section[] = [A, B];

function specMap(m: Record<string, SectionSpec | undefined>) {
  return m;
}

describe('checkCommitmentMesh (deterministic, high-precision)', () => {
  it('flags unmet-incoming when B needs something A never commits to', () => {
    const specs = specMap({
      a: spec({ outgoingCommitments: ['the typology of insects'] }),
      b: spec({ incomingContext: ['the cosmological constant'] }),
    });
    const found = checkCommitmentMesh('b', SECTIONS, specs);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'unmet-incoming', direction: 'upstream', relatedSectionTitle: 'Chapter A' });
  });

  it('does NOT flag when an upstream commitment shares a significant token (errs toward silence)', () => {
    const specs = specMap({
      a: spec({ outgoingCommitments: ['establishes the gestalt typology'] }),
      b: spec({ incomingContext: ['the typology from the previous chapter'] }),
    });
    expect(checkCommitmentMesh('b', SECTIONS, specs)).toHaveLength(0);
  });

  it('stays silent (no finding) when the upstream neighbour has no spec', () => {
    const specs = specMap({
      a: undefined,
      b: spec({ incomingContext: ['the cosmological constant'] }),
    });
    expect(checkCommitmentMesh('b', SECTIONS, specs)).toHaveLength(0);
  });

  it('stays silent when the upstream neighbour declares no outgoing commitments', () => {
    const specs = specMap({
      a: spec({ outgoingCommitments: [] }),
      b: spec({ incomingContext: ['the cosmological constant'] }),
    });
    expect(checkCommitmentMesh('b', SECTIONS, specs)).toHaveLength(0);
  });

  it('flags dangling-outgoing when A commits something B never consumes', () => {
    const specs = specMap({
      a: spec({ outgoingCommitments: ['a defended taxonomy of beetles'] }),
      b: spec({ incomingContext: ['nothing related whatsoever here'] }),
    });
    const found = checkCommitmentMesh('a', SECTIONS, specs);
    expect(found.some((f) => f.kind === 'dangling-outgoing' && f.direction === 'downstream')).toBe(true);
  });

  it('returns [] for a spec-less section and for an unknown id', () => {
    expect(checkCommitmentMesh('a', SECTIONS, { a: undefined })).toHaveLength(0);
    expect(checkCommitmentMesh('ghost', SECTIONS, { a: spec(), b: spec() })).toHaveLength(0);
  });
});

describe('computeAllStrain (bands + AI corroboration)', () => {
  // A commits "the gestalt typology", which B consumes (so A has no dangling break);
  // B ALSO needs "the cosmological constant", which nothing upstream meets → B's lone break.
  const baseSpecs = {
    a: spec({ outgoingCommitments: ['the gestalt typology'] }),
    b: spec({ incomingContext: ['the gestalt typology', 'the cosmological constant'] }),
  };
  const suite = (over: Partial<Record<string, TestSuiteEntry>> = {}): TestSuite => ({
    a: entry({ spec: baseSpecs.a }),
    b: entry({ spec: baseSpecs.b }),
    ...over,
  });

  it('one deterministic break → medium band', () => {
    const { strained, count } = computeAllStrain(SECTIONS, suite());
    expect(count).toBe(1);
    expect(strained[0]).toMatchObject({ sectionId: 'b', band: 'medium' });
  });

  it('a deterministic break + an AI corroboration → high band', () => {
    const { strained } = computeAllStrain(
      SECTIONS,
      suite({
        b: entry({
          spec: baseSpecs.b,
          lastDiagnostic: {
            moveResults: [],
            coherenceNotes: [],
            commitmentFindings: [{ kind: 'center-of-gravity', detail: 'concedes the thesis' }],
            overallReadiness: 'developing',
            nextPriority: '',
          },
        }),
      }),
    );
    const b = strained.find((s) => s.sectionId === 'b');
    expect(b?.band).toBe('high');
    expect(b?.signals.some((sig) => sig.source === 'ai')).toBe(true);
  });

  it('AI signals alone (no deterministic base) cap at medium — AI may escalate, not originate a high', () => {
    const cleanSpecs: TestSuite = {
      a: entry({ spec: spec() }),
      b: entry({
        spec: spec(), // no incoming/outgoing → no deterministic break
        wholeFromPart: { reconstructedClaim: 'x', alignment: 'adrift', timestamp: 0, inputHash: 'h' },
        lastDiagnostic: {
          moveResults: [{ moveId: 'm', moveDescription: '', status: 'present', advance: 'recapitulative' }],
          coherenceNotes: [],
          overallReadiness: 'developing',
          nextPriority: '',
        },
      }),
    };
    const { strained } = computeAllStrain(SECTIONS, cleanSpecs);
    const b = strained.find((s) => s.sectionId === 'b');
    expect(b?.band).toBe('medium'); // two AI signals, but capped
    expect(b?.signals.every((sig) => sig.source === 'ai')).toBe(true);
  });

  it('spec-less and blocked sections produce no strain', () => {
    // spec-less b
    expect(computeAllStrain(SECTIONS, { a: entry({ spec: baseSpecs.a }), b: entry() }).count).toBe(0);
    // b blocked by a failing prerequisite
    const blocked: TestSuite = {
      a: entry({ spec: baseSpecs.a, status: 'fail' }),
      b: entry({ spec: baseSpecs.b, dependencies: [{ id: 'a', type: 'prerequisite' }] }),
    };
    expect(computeAllStrain(SECTIONS, blocked).count).toBe(0);
  });
});
