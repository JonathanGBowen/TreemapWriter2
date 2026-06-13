import { describe, expect, it } from 'vitest';
import {
  blankAnalysisState,
  buildAnalysisRequestText,
  buildRefactorRequestText,
  formatTranscript,
  interrogateContextFor,
  makeAnalysisVersion,
  makeVersionLabel,
  normalizeAnalysis,
  withActiveAnalysisVersion,
  withAnalysisVersion,
  withClearedDialogue,
  withDialogue,
  withDialogueContext,
} from '../analysis-helpers';
import type { AnalysisVersion, SectionAnalysis, TestSuite } from '../../types';

const validPayload = {
  centralThesis: 'Inquiry begins with a felt difficulty.',
  keyConcepts: [{ term: 'inquiry', definition: 'The resolution of a problematic situation.' }],
  argument: {
    premises: ['Thought arises from disruption.'],
    implicitPremises: ['Disruption is not self-resolving.'],
    conclusion: 'Reflection is occasioned, not spontaneous.',
  },
  supportingArguments: ['The traveler example.'],
  potentialObjections: ['May overgeneralize from practical contexts.'],
};

const makeVersion = (overrides: Partial<AnalysisVersion> = {}): AnalysisVersion => ({
  id: `av_${Math.random()}`,
  timestamp: Date.now(),
  label: 'analysis 1',
  kind: 'analysis',
  result: validPayload as SectionAnalysis,
  inputHash: 'abc',
  ...overrides,
});

describe('normalizeAnalysis', () => {
  it('passes a full valid payload through unchanged', () => {
    const result = normalizeAnalysis(validPayload);
    expect(result).toEqual(validPayload);
  });

  it('accepts primaryArgumentReconstruction as an alias for argument', () => {
    const { argument, ...rest } = validPayload;
    const result = normalizeAnalysis({ ...rest, primaryArgumentReconstruction: argument });
    expect(result?.argument).toEqual(argument);
  });

  it('defaults missing arrays to empty', () => {
    const result = normalizeAnalysis({
      centralThesis: 'A thesis.',
      argument: { conclusion: 'A conclusion.' },
    });
    expect(result).toEqual({
      centralThesis: 'A thesis.',
      keyConcepts: [],
      argument: { premises: [], implicitPremises: [], conclusion: 'A conclusion.' },
      supportingArguments: [],
      potentialObjections: [],
    });
  });

  it('coerces non-string array members', () => {
    const result = normalizeAnalysis({
      centralThesis: 'T.',
      argument: { premises: [1, 'two'], conclusion: 'C.' },
    });
    expect(result?.argument.premises).toEqual(['1', 'two']);
  });

  it('preserves premise count exactly — no padding or truncation', () => {
    const premises = ['only one premise'];
    const many = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    expect(
      normalizeAnalysis({ centralThesis: 'T.', argument: { premises, conclusion: 'C.' } })
        ?.argument.premises,
    ).toEqual(premises);
    expect(
      normalizeAnalysis({ centralThesis: 'T.', argument: { premises: many, conclusion: 'C.' } })
        ?.argument.premises,
    ).toEqual(many);
  });

  it('returns null for junk responses', () => {
    expect(normalizeAnalysis(null)).toBeNull();
    expect(normalizeAnalysis('text')).toBeNull();
    expect(normalizeAnalysis({})).toBeNull();
    expect(normalizeAnalysis({ keyConcepts: [] })).toBeNull();
  });
});

describe('testSuite updaters', () => {
  it('withAnalysisVersion creates the entry and state when missing', () => {
    const version = makeVersion();
    const suite = withAnalysisVersion({}, 'sec-1', version);
    expect(suite['sec-1'].analysis?.versions).toEqual([version]);
    expect(suite['sec-1'].analysis?.activeVersionId).toBe(version.id);
    expect(suite['sec-1'].goals).toBe('');
  });

  it('withAnalysisVersion prepends and activates, leaving other entries untouched', () => {
    const v1 = makeVersion();
    const v2 = makeVersion({ kind: 'refactor', label: 'refactor 1' });
    const other = { goals: 'g', status: 'idle' as const };
    let suite: TestSuite = { 'sec-2': other };
    suite = withAnalysisVersion(suite, 'sec-1', v1);
    suite = withAnalysisVersion(suite, 'sec-1', v2);
    expect(suite['sec-1'].analysis?.versions.map((v) => v.id)).toEqual([v2.id, v1.id]);
    expect(suite['sec-1'].analysis?.activeVersionId).toBe(v2.id);
    expect(suite['sec-2']).toBe(other);
  });

  it('withAnalysisVersion does not clear an in-progress dialogue', () => {
    let suite: TestSuite = withDialogue({}, 'sec-1', [{ role: 'user', text: 'hm' }]);
    suite = withAnalysisVersion(suite, 'sec-1', makeVersion());
    expect(suite['sec-1'].analysis?.dialogue).toHaveLength(1);
  });

  it('withActiveAnalysisVersion ignores unknown version ids', () => {
    const v1 = makeVersion();
    let suite = withAnalysisVersion({}, 'sec-1', v1);
    suite = withActiveAnalysisVersion(suite, 'sec-1', 'nope');
    expect(suite['sec-1'].analysis?.activeVersionId).toBe(v1.id);
  });

  it('withDialogue and withDialogueContext round-trip', () => {
    let suite = withDialogueContext({}, 'sec-1', 'Thesis: "X"');
    suite = withDialogue(suite, 'sec-1', [{ role: 'user', text: 'why?' }]);
    expect(suite['sec-1'].analysis?.dialogueContext).toBe('Thesis: "X"');
    expect(suite['sec-1'].analysis?.dialogue).toEqual([{ role: 'user', text: 'why?' }]);
  });

  it('withClearedDialogue empties dialogue + context but preserves versions', () => {
    const v1 = makeVersion();
    let suite = withAnalysisVersion({}, 'sec-1', v1);
    suite = withDialogueContext(suite, 'sec-1', 'ctx');
    suite = withDialogue(suite, 'sec-1', [{ role: 'user', text: 'q' }]);
    suite = withClearedDialogue(suite, 'sec-1');
    expect(suite['sec-1'].analysis?.dialogue).toEqual([]);
    expect(suite['sec-1'].analysis?.dialogueContext).toBeNull();
    expect(suite['sec-1'].analysis?.versions).toEqual([v1]);
  });

  it('blankAnalysisState is empty and inactive', () => {
    expect(blankAnalysisState()).toEqual({
      versions: [],
      activeVersionId: null,
      dialogue: [],
      dialogueContext: null,
    });
  });
});

describe('makeVersionLabel', () => {
  it('counts each kind independently', () => {
    const versions = [
      makeVersion({ kind: 'refactor' }),
      makeVersion({ kind: 'analysis' }),
      makeVersion({ kind: 'analysis' }),
    ];
    expect(makeVersionLabel([], 'analysis')).toBe('analysis 1');
    expect(makeVersionLabel(versions, 'analysis')).toBe('analysis 3');
    expect(makeVersionLabel(versions, 'refactor')).toBe('refactor 2');
  });
});

describe('makeAnalysisVersion', () => {
  it('builds a labeled version and attaches sourceDialogue only for refactors', () => {
    const analysis = makeAnalysisVersion({
      kind: 'analysis',
      prevVersions: [],
      result: validPayload as SectionAnalysis,
      inputHash: 'h1',
    });
    expect(analysis.label).toBe('analysis 1');
    expect(analysis.id).toMatch(/^av_/);
    expect(analysis.sourceDialogue).toBeUndefined();

    const refactor = makeAnalysisVersion({
      kind: 'refactor',
      prevVersions: [analysis],
      result: validPayload as SectionAnalysis,
      inputHash: 'h2',
      sourceDialogue: [{ role: 'user', text: 'q' }],
    });
    expect(refactor.label).toBe('refactor 1');
    expect(refactor.sourceDialogue).toEqual([{ role: 'user', text: 'q' }]);
  });
});

describe('prompt assembly', () => {
  it('formatTranscript tags roles and includes the focus context', () => {
    const transcript = formatTranscript(
      [
        { role: 'user', text: 'Is P1 doing any work?' },
        { role: 'model', text: 'What would the argument lose without it?' },
      ],
      'Thesis: "X"',
    );
    expect(transcript).toBe(
      'FOCUS: Thesis: "X"\nuser: Is P1 doing any work?\nmodel: What would the argument lose without it?',
    );
  });

  it('buildAnalysisRequestText contains prompt, title, and text', () => {
    const out = buildAnalysisRequestText('Intro', 'Body text.', 'PROMPT');
    expect(out).toContain('PROMPT');
    expect(out).toContain('SECTION: "Intro"');
    expect(out).toContain('Body text.');
  });

  it('buildRefactorRequestText contains all four blocks', () => {
    const out = buildRefactorRequestText({
      sectionTitle: 'Intro',
      sectionText: 'Original body.',
      analysisJson: '{"centralThesis":"T"}',
      transcript: 'user: q',
      prompt: 'REFACTOR PROMPT',
    });
    expect(out).toContain('REFACTOR PROMPT');
    expect(out).toContain('ORIGINAL TEXT:');
    expect(out).toContain('Original body.');
    expect(out).toContain('CURRENT ANALYSIS (JSON):');
    expect(out).toContain('{"centralThesis":"T"}');
    expect(out).toContain('SOCRATIC DIALOGUE TRANSCRIPT:');
    expect(out).toContain('user: q');
  });
});

describe('interrogateContextFor', () => {
  const analysis = validPayload as SectionAnalysis;

  it('builds a quoted thesis context', () => {
    expect(interrogateContextFor.thesis(analysis)).toBe(
      'Thesis: "Inquiry begins with a felt difficulty."',
    );
  });

  it('numbers premises and implicit premises in the argument context', () => {
    const ctx = interrogateContextFor.argument(analysis);
    expect(ctx).toContain('P1. Thought arises from disruption.');
    expect(ctx).toContain('IP1. Disruption is not self-resolving.');
    expect(ctx).toContain('C. Reflection is occasioned, not spontaneous.');
  });

  it('serializes the entire analysis as JSON', () => {
    expect(interrogateContextFor.entire(analysis)).toContain('"centralThesis"');
  });
});
