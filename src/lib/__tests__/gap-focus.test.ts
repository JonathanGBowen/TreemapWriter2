import { describe, expect, it } from 'vitest';
import { buildGapFocus, isGapFocus, GAP_FOCUS_MARKER } from '../gap-focus';
import type { Section, SectionSpec, TestSuite, TestSuiteEntry } from '../../types';

// --- tiny builders (mirrors strain-metrics.test.ts) ------------------------
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

const A = sec('a', 'Chapter A');
const B = sec('b', 'Chapter B');
const SECTIONS: Section[] = [A, B];

describe('buildGapFocus', () => {
  it('returns null when the structure reports nothing absent', () => {
    const suite: TestSuite = { b: entry({ spec: spec() }) };
    expect(buildGapFocus('b', SECTIONS, suite)).toBeNull();
  });

  it('returns null for an unknown section', () => {
    expect(buildGapFocus('nope', SECTIONS, {})).toBeNull();
  });

  it('carries deterministic mesh breaks with their directed neighbour', () => {
    const suite: TestSuite = {
      a: entry({ spec: spec({ outgoingCommitments: ['the typology of insects'] }) }),
      b: entry({ spec: spec({ incomingContext: ['the cosmological constant'] }) }),
    };
    const focus = buildGapFocus('b', SECTIONS, suite);
    expect(focus).not.toBeNull();
    expect(focus).toContain(GAP_FOCUS_MARKER);
    expect(focus).toContain('"Chapter B"');
    expect(focus).toContain('unmet-incoming');
    expect(focus).toContain('(← Chapter A)');
  });

  it('carries missing/partial/unclear moves and the gap→vector next action', () => {
    const suite: TestSuite = {
      b: entry({
        spec: spec(),
        lastDiagnostic: {
          moveResults: [
            { moveId: 'm1', moveDescription: 'answer the regress objection', status: 'missing', diagnosis: 'never addressed' },
            { moveId: 'm2', moveDescription: 'define the terms', status: 'present' },
          ],
          coherenceNotes: [],
          overallReadiness: 'developing',
          nextAction: { gap: 'the reply to the regress', location: 'after ¶3', vector: 'state the stopping condition' },
          nextPriority: '',
        },
      }),
    };
    const focus = buildGapFocus('b', SECTIONS, suite);
    expect(focus).toContain('move missing: "answer the regress objection" — never addressed');
    expect(focus).not.toContain('define the terms');
    expect(focus).toContain('next: the reply to the regress (at after ¶3) → state the stopping condition');
  });

  it('still reports move gaps when the section has no spec (strain is neutral)', () => {
    const suite: TestSuite = {
      b: entry({
        lastDiagnostic: {
          moveResults: [{ moveId: 'm1', moveDescription: 'the missing move', status: 'unclear' }],
          coherenceNotes: [],
          overallReadiness: 'draft',
          nextPriority: '',
        },
      }),
    };
    const focus = buildGapFocus('b', SECTIONS, suite);
    expect(focus).toContain('move unclear: "the missing move"');
  });
});

describe('isGapFocus', () => {
  it('recognizes a gap focus and rejects others', () => {
    expect(isGapFocus(`${GAP_FOCUS_MARKER} — what "X" is missing…`)).toBe(true);
    expect(isGapFocus('Thesis: "something"')).toBe(false);
    expect(isGapFocus(null)).toBe(false);
    expect(isGapFocus(undefined)).toBe(false);
  });
});
