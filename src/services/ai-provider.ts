import type {
  Section,
  SectionAnalysis,
  SectionSpec,
  DialogueMessage,
  DiagnosticResult,
  Persona,
  PromptsConfig,
  Dependency,
  TestSuite,
} from '../types';

/**
 * AI provider boundary. Components and slices call this interface; only the
 * provider implementation imports `@google/genai`.
 *
 * `continueDialogue` is the first realized streaming method (the Phase-5
 * shape anticipated here all along); further siblings (e.g.
 * `streamCoachAdvice(input): AsyncIterable<string>`) follow the same
 * pattern. Don't preclude that — keep returns typed and don't smuggle SDK
 * objects across the boundary.
 */
export interface AIProvider {
  generateSpecs(input: GenerateSpecsInput): Promise<void>;
  runDiagnostic(input: RunDiagnosticInput): Promise<DiagnosticResult>;
  estimateDependencies(
    input: EstimateDependenciesInput,
  ): Promise<Record<string, Dependency[]>>;
  getCoachAdvice(input: CoachAdviceInput): Promise<string>;
  getContentSuggestions(input: ContentSuggestionsInput): Promise<string>;
  generatePersonas(
    input: GeneratePersonasInput,
  ): Promise<PersonaSuggestion[]>;
  refineSpec(input: RefineSpecInput): Promise<string>;
  analyzeSection(input: AnalyzeSectionInput): Promise<SectionAnalysis>;
  refactorAnalysis(input: RefactorAnalysisInput): Promise<SectionAnalysis>;
  continueDialogue(input: ContinueDialogueInput): AsyncIterable<string>;
}

export interface GenerateSpecsInput {
  sections: Section[];
  markdown: string;
  config: PromptsConfig;
  modelId: string;
  thinkingBudget: number;
  onBatchComplete: (specs: Record<string, SectionSpec>) => void;
  onError?: (error: Error) => void;
}

export interface RunDiagnosticInput {
  section: Section;
  spec: SectionSpec;
  scope: 'segment' | 'parent' | 'full';
  modelId: string;
  thinkingBudget: number;
  persona: Persona;
  customInstruction: string;
  fullDocument: string;
  sections: Section[];
  config: PromptsConfig;
  findSection: (nodes: Section[], id: string) => Section | null;
}

export interface EstimateDependenciesInput {
  sections: Section[];
  testSuite: TestSuite;
  modelId: string;
  thinkingBudget: number;
  config: PromptsConfig;
}

export interface CoachAdviceInput {
  markdown: string;
  sections: Section[];
  testSuite: TestSuite;
  config: PromptsConfig;
  modelId: string;
}

export interface ContentSuggestionsInput {
  sectionTitle: string;
  currentGoals: string;
  fullSectionContent: string;
  parentGoals?: string;
  config: PromptsConfig;
  modelId: string;
}

export interface GeneratePersonasInput {
  documentContext: string;
  config: PromptsConfig;
  modelId?: string;
}

/** Raw persona shape returned by the provider; caller assigns IDs. */
export type PersonaSuggestion = Omit<Persona, 'id'>;

export interface RefineSpecInput {
  sectionTitle: string;
  currentGoals: string;
  fullSectionContent: string;
  parentGoals?: string;
  instruction: string;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
}

export interface AnalyzeSectionInput {
  sectionTitle: string;
  /** section.fullContent (whole subtree), captured at call time. */
  sectionText: string;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
}

export interface RefactorAnalysisInput {
  sectionTitle: string;
  sectionText: string;
  /** The analysis version the dialogue interrogated. */
  analysis: SectionAnalysis;
  dialogue: DialogueMessage[];
  dialogueContext: string | null;
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
}

export interface ContinueDialogueInput {
  /** What the dialogue is about (from the interrogate affordance). */
  context: string;
  /** Active analysis version, injected into the system instruction. */
  analysis: SectionAnalysis | null;
  /** Full history; the last message is the new user turn. */
  messages: DialogueMessage[];
  config: PromptsConfig;
  modelId?: string;
  thinkingBudget?: number;
}
