// Pure helpers for the per-section analysis + Socratic dialogue feature.
// No React, no store, no SDK — the document-state actions and the Gemini
// provider both lean on these so they stay thin and testable.

import type {
  AnalysisVersion,
  DialogueMessage,
  SectionAnalysis,
  SectionAnalysisState,
  TestSuite,
  TestSuiteEntry,
} from '../types';

// --- response normalization -----------------------------------------------

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x) => x != null && x !== '').map((x) => (typeof x === 'string' ? x : String(x)))
    : [];

const toKeyConcepts = (v: unknown): { term: string; definition: string }[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          term: String(x.term ?? ''),
          definition: String(x.definition ?? ''),
        }))
        .filter((c) => c.term || c.definition)
    : [];

/**
 * Tolerant validator for the model's analysis JSON. Accepts the legacy
 * `primaryArgumentReconstruction` key as an alias for `argument`; missing
 * arrays become empty. Returns null when neither a thesis nor a conclusion
 * is recoverable — the signal of a junk response.
 */
export const normalizeAnalysis = (raw: unknown): SectionAnalysis | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const argRaw = (data.argument ?? data.primaryArgumentReconstruction) as
    | Record<string, unknown>
    | undefined;

  const centralThesis = typeof data.centralThesis === 'string' ? data.centralThesis.trim() : '';
  const conclusion =
    argRaw && typeof argRaw.conclusion === 'string' ? argRaw.conclusion.trim() : '';
  if (!centralThesis && !conclusion) return null;

  return {
    centralThesis,
    keyConcepts: toKeyConcepts(data.keyConcepts),
    argument: {
      premises: toStringArray(argRaw?.premises),
      implicitPremises: toStringArray(argRaw?.implicitPremises),
      conclusion,
    },
    supportingArguments: toStringArray(data.supportingArguments),
    potentialObjections: toStringArray(data.potentialObjections),
  };
};

// --- testSuite updaters ----------------------------------------------------

const blankEntry = (): TestSuiteEntry => ({
  goals: '',
  status: 'idle',
  history: [],
});

export const blankAnalysisState = (): SectionAnalysisState => ({
  versions: [],
  activeVersionId: null,
  dialogue: [],
  dialogueContext: null,
});

const withAnalysisState = (
  suite: TestSuite,
  sectionId: string,
  update: (state: SectionAnalysisState) => SectionAnalysisState,
): TestSuite => {
  const entry = suite[sectionId] ?? blankEntry();
  const analysis = entry.analysis ?? blankAnalysisState();
  return { ...suite, [sectionId]: { ...entry, analysis: update(analysis) } };
};

/** Prepend a version (newest first) and make it active. Creates the entry if missing. */
export const withAnalysisVersion = (
  suite: TestSuite,
  sectionId: string,
  version: AnalysisVersion,
): TestSuite =>
  withAnalysisState(suite, sectionId, (s) => ({
    ...s,
    versions: [version, ...s.versions],
    activeVersionId: version.id,
  }));

export const withActiveAnalysisVersion = (
  suite: TestSuite,
  sectionId: string,
  versionId: string,
): TestSuite =>
  withAnalysisState(suite, sectionId, (s) =>
    s.versions.some((v) => v.id === versionId) ? { ...s, activeVersionId: versionId } : s,
  );

export const withDialogue = (
  suite: TestSuite,
  sectionId: string,
  messages: DialogueMessage[],
): TestSuite => withAnalysisState(suite, sectionId, (s) => ({ ...s, dialogue: messages }));

/** Re-aim the dialogue at a new context. Existing messages are preserved. */
export const withDialogueContext = (
  suite: TestSuite,
  sectionId: string,
  context: string | null,
): TestSuite => withAnalysisState(suite, sectionId, (s) => ({ ...s, dialogueContext: context }));

export const withClearedDialogue = (suite: TestSuite, sectionId: string): TestSuite =>
  withAnalysisState(suite, sectionId, (s) => ({ ...s, dialogue: [], dialogueContext: null }));

export const makeVersionLabel = (
  versions: AnalysisVersion[],
  kind: 'analysis' | 'refactor',
): string => `${kind} ${versions.filter((v) => v.kind === kind).length + 1}`;

// Monotonic per-session counter so two versions created in the same
// millisecond still get distinct ids — `av_${Date.now()}` alone can collide,
// and the id doubles as a React key and the activeVersionId lookup key.
let versionSeq = 0;

export const makeAnalysisVersion = (args: {
  kind: 'analysis' | 'refactor';
  prevVersions: AnalysisVersion[];
  result: SectionAnalysis;
  inputHash: string;
  sourceDialogue?: DialogueMessage[];
}): AnalysisVersion => ({
  id: `av_${Date.now()}_${versionSeq++}`,
  timestamp: Date.now(),
  label: makeVersionLabel(args.prevVersions, args.kind),
  kind: args.kind,
  result: args.result,
  inputHash: args.inputHash,
  ...(args.sourceDialogue ? { sourceDialogue: args.sourceDialogue } : {}),
});

// --- prompt assembly --------------------------------------------------------

export const formatTranscript = (
  messages: DialogueMessage[],
  context: string | null,
): string => {
  const lines = messages.map((m) => `${m.role}: ${m.text}`);
  return [context ? `FOCUS: ${context}` : null, ...lines].filter(Boolean).join('\n');
};

export const buildAnalysisRequestText = (
  sectionTitle: string,
  sectionText: string,
  prompt: string,
): string =>
  [prompt, '', `SECTION: "${sectionTitle}"`, '', 'TEXT TO ANALYZE:', '---', sectionText, '---'].join(
    '\n',
  );

export const buildRefactorRequestText = (args: {
  sectionTitle: string;
  sectionText: string;
  analysisJson: string;
  transcript: string;
  prompt: string;
}): string =>
  [
    args.prompt,
    '',
    `SECTION: "${args.sectionTitle}"`,
    '',
    'ORIGINAL TEXT:',
    '---',
    args.sectionText,
    '---',
    '',
    'CURRENT ANALYSIS (JSON):',
    '---',
    args.analysisJson,
    '---',
    '',
    'SOCRATIC DIALOGUE TRANSCRIPT:',
    '---',
    args.transcript,
    '---',
    '',
    'Generate the new, refined analysis based on all of the above.',
  ].join('\n');

// --- interrogation context builders ----------------------------------------

/** Context strings handed to the Socratic dialogue when a card is interrogated. */
export const interrogateContextFor = {
  thesis: (a: SectionAnalysis) => `Thesis: "${a.centralThesis}"`,
  concepts: (a: SectionAnalysis) =>
    `Key concepts:\n${a.keyConcepts.map((c) => `- ${c.term}: ${c.definition}`).join('\n')}`,
  argument: (a: SectionAnalysis) => {
    const premises = a.argument.premises.map((p, i) => `P${i + 1}. ${p}`);
    const implicit = a.argument.implicitPremises.map((p, i) => `IP${i + 1}. ${p}`);
    return `Argument reconstruction:\n${[...premises, ...implicit].join('\n')}\nC. ${a.argument.conclusion}`;
  },
  support: (a: SectionAnalysis) =>
    `Supporting arguments:\n${a.supportingArguments.map((s) => `- ${s}`).join('\n')}`,
  objections: (a: SectionAnalysis) =>
    `Potential objections:\n${a.potentialObjections.map((s) => `- ${s}`).join('\n')}`,
  entire: (a: SectionAnalysis) => `Entire analysis:\n${JSON.stringify(a, null, 2)}`,
};
