import { describe, expect, it } from 'vitest';
import {
  buildSpecByTitle,
  planSpecTestRun,
  meshDeltaFor,
  summarizeTally,
  structuralResult,
} from '../specTestHelpers';
import { parseMarkdown } from '../utils';
import type { SectionSpec, SectionSpecTest, TestSuite } from '../../types';

const spec = (over: Partial<SectionSpec> = {}): SectionSpec => ({
  function: 'argue',
  mainClaim: 'claim',
  requiredMoves: [{ id: 'move-0', description: 'do the thing' }],
  incomingContext: [],
  outgoingCommitments: [],
  ...over,
});

/** Build a title→spec rubric directly (the held rubric). */
const rubric = (entries: Record<string, SectionSpec>): Map<string, SectionSpec> =>
  new Map(Object.entries(entries));

const doc = (sections: string[]): string => sections.map((t) => `# ${t}\n\nProse for ${t}.`).join('\n\n');

describe('buildSpecByTitle', () => {
  it('maps section titles to their testSuite spec, skipping spec-less sections', () => {
    const md = doc(['Intro', 'Body']);
    const sections = parseMarkdown(md);
    const testSuite: TestSuite = {
      [sections[0].id]: { goals: '', status: 'idle', spec: spec({ mainClaim: 'intro claim' }) },
      [sections[1].id]: { goals: '', status: 'idle' }, // no spec
    };
    const map = buildSpecByTitle(sections, testSuite);
    expect(map.get('Intro')?.mainClaim).toBe('intro claim');
    expect(map.has('Body')).toBe(false);
  });
});

describe('planSpecTestRun — diff + mesh-neighbour scoping', () => {
  const titles = ['S1', 'S2', 'S3', 'S4'];
  const specByTitle = rubric({ S1: spec(), S2: spec(), S3: spec(), S4: spec() });
  const mdA = doc(titles);
  // B changes ONLY S2's prose; S1/S3/S4 prose identical.
  const mdB = mdA.replace('Prose for S2.', 'Rewritten prose for S2 entirely.');
  const rubricSections = parseMarkdown(mdA);

  it("deep-reads the changed section AND its mesh neighbours; leaves distant sections unchanged", () => {
    const plan = planSpecTestRun(mdA, mdB, specByTitle, rubricSections, 'changed');
    const by = Object.fromEntries(plan.map((p) => [p.title, p.scopeReason]));
    expect(by.S2).toBe('changed');
    expect(by.S1).toBe('mesh-neighbour'); // preceding sibling pulled in
    expect(by.S3).toBe('mesh-neighbour'); // following sibling pulled in
    expect(by.S4).toBe('unchanged'); // not adjacent to the change → free
  });

  it("'all' scope deep-reads every both-present section with a rubric", () => {
    const plan = planSpecTestRun(mdA, mdB, specByTitle, rubricSections, 'all');
    const deep = plan.filter((p) => p.scopeReason === 'changed' || p.scopeReason === 'mesh-neighbour');
    expect(deep).toHaveLength(4);
  });

  it('classifies added / cut / spec-less sections without an AI call', () => {
    const aOnly = doc(['S1', 'Cut']); // "Cut" present only in A
    const bOnly = doc(['S1', 'Added']); // "Added" present only in B
    const r = rubric({ S1: spec(), Cut: spec(), Added: spec() });
    const plan = planSpecTestRun(aOnly, bOnly, r, parseMarkdown(aOnly), 'changed');
    const by = Object.fromEntries(plan.map((p) => [p.title, p.scopeReason]));
    expect(by.Cut).toBe('a-only');
    expect(by.Added).toBe('b-only');
  });

  it('marks a section with no rubric as no-rubric', () => {
    const md = doc(['S1', 'Untracked']);
    const plan = planSpecTestRun(md, md.replace('Prose for S1.', 'Changed.'), rubric({ S1: spec() }), parseMarkdown(md), 'changed');
    const untracked = plan.find((p) => p.title === 'Untracked');
    expect(untracked?.scopeReason).toBe('no-rubric');
  });
});

describe('meshDeltaFor — deterministic structural-join delta', () => {
  const specByTitle = rubric({
    S1: spec({ outgoingCommitments: ['alpha premise'] }),
    S2: spec({ incomingContext: ['alpha premise'] }),
    S3: spec({ incomingContext: ['delta unrelated'] }),
  });

  it('is empty when the structure is identical (prose-only change does not move it)', () => {
    const mdA = doc(['S1', 'S2', 'S3']);
    const mdB = mdA.replace('Prose for S2.', 'Different prose for S2.');
    const delta = meshDeltaFor(parseMarkdown(mdA), parseMarkdown(mdB), specByTitle);
    expect(delta.introduced).toEqual([]);
    expect(delta.healed).toEqual([]);
  });

  it('reports an introduced break when a reorder severs a commitment join', () => {
    const mdA = doc(['S1', 'S2', 'S3']); // S1→S2 meshed (alpha premise delivered then needed)
    const mdB = doc(['S1', 'S3', 'S2']); // S1 now feeds S3, which does not need alpha premise
    const delta = meshDeltaFor(parseMarkdown(mdA), parseMarkdown(mdB), specByTitle);
    expect(delta.introduced.length).toBeGreaterThan(0);
    expect(delta.healed).toEqual([]);
    expect(delta.introduced.some((f) => f.detail.includes('alpha premise'))).toBe(true);
  });
});

describe('summarizeTally', () => {
  it('counts move deltas + tF/fT, and the deep-read vs skeleton split', () => {
    const sections: SectionSpecTest[] = [
      {
        sectionTitle: 'A', presentInA: true, presentInB: true, scopeReason: 'changed',
        truth: 'tF', direction: 'mixed', wholeSignature: { a: 'aligned', b: 'adrift' }, summary: '',
        moveDeltas: [
          { moveId: 'm0', moveDescription: '', statusA: 'missing', statusB: 'present', delta: 'gained', receipts: [] },
          { moveId: 'm1', moveDescription: '', statusA: 'present', statusB: 'present', delta: 'deflated', receipts: [] },
        ],
      },
      structuralResult({ title: 'B', presentInA: true, presentInB: true, scopeReason: 'unchanged', proseA: '', proseB: '' }),
    ];
    const tally = summarizeTally(sections, 1);
    expect(tally).toMatchObject({ gained: 1, deflated: 1, tF: 1, deepRead: 1, skeletonOnly: 1 });
  });
});
