// Provider-agnostic AIProvider implementation.
//
// This is where ALL prompt-building and response parsing lives (ported from the
// old gemini-provider.ts). It resolves which model runs each call kind, then
// dispatches to the matching LLMClient transport. Adding a provider means adding
// a client, not re-implementing these flows. Replaces gemini-provider.ts.

import type {
  Section,
  SectionAnalysis,
  MoveResult,
  DiagnosticResult,
  Dependency,
} from '../../types';
import { buildDiagnosticPrompt } from '../../lib/constants';
import { safeJsonParse } from '../../lib/utils';
import {
  buildAnalysisRequestText,
  buildRefactorRequestText,
  formatTranscript,
  normalizeAnalysis,
} from '../../lib/analysis-helpers';
import type {
  AIProvider,
  GenerateSpecsInput,
  RunDiagnosticInput,
  EstimateDependenciesInput,
  CoachAdviceInput,
  ContentSuggestionsInput,
  GeneratePersonasInput,
  PersonaSuggestion,
  RefineSpecInput,
  AnalyzeSectionInput,
  RefactorAnalysisInput,
  ContinueDialogueInput,
} from '../ai-provider';
import type { AICallKind, ModelChoice, ProviderId } from './model-types';
import type { LLMClient, LLMMessage } from './clients';
import { generateSpecs } from './ai-provider.specs';

const MAX_OUTPUT_TOKENS = 16000;
const ANALYSIS_INPUT_CAP = 60000;
const DIALOGUE_HISTORY_WINDOW = 40;
const DIALOGUE_ANALYSIS_CAP = 12000;

const VALID_MOVE_STATUSES = ['present', 'partial', 'missing', 'unclear'] as const;
const VALID_READINESS = ['draft', 'developing', 'nearly-there', 'solid'];

export interface ProviderClients {
  gemini: LLMClient;
  anthropic: LLMClient;
  ollama: LLMClient;
}

/** Resolves the configured ModelChoice for a call kind (project → global → default). */
export type ChoiceResolver = (kind: AICallKind) => ModelChoice;

interface OverrideFields {
  modelChoice?: ModelChoice;
  modelId?: string;
  thinkingBudget?: number;
}

export class MultiProviderAIProvider implements AIProvider {
  constructor(
    private readonly clients: ProviderClients,
    private readonly resolveChoice: ChoiceResolver,
  ) {}

  /** Per-call override → legacy Gemini modelId → configured model for this kind. */
  private choose(kind: AICallKind, input: OverrideFields): ModelChoice {
    if (input.modelChoice) return input.modelChoice;
    if (input.modelId) {
      return { provider: 'gemini', model: input.modelId, thinkingBudget: input.thinkingBudget };
    }
    return this.resolveChoice(kind);
  }

  private clientFor(provider: ProviderId): LLMClient {
    if (provider === 'anthropic') return this.clients.anthropic;
    if (provider === 'ollama') return this.clients.ollama;
    return this.clients.gemini;
  }

  async generateSpecs(input: GenerateSpecsInput): Promise<void> {
    const choice = this.choose('generateSpecs', input);
    await generateSpecs(this.clientFor(choice.provider), choice.model, choice.thinkingBudget ?? 0, input);
  }

  async runDiagnostic(input: RunDiagnosticInput): Promise<DiagnosticResult> {
    // Whole-document (root) evaluation reads the entire document, uncapped (the
    // caller has already verified it fits the model window).
    const isWholeDocument = input.section.id === 'root';
    let contextContent = input.section.fullContent;
    if (isWholeDocument || input.scope === 'full') {
      contextContent = input.fullDocument;
    } else if (input.scope === 'parent' && input.section.parentId) {
      const parent = input.findSection(input.sections, input.section.parentId);
      if (parent) contextContent = parent.fullContent;
    }

    const prompt = buildDiagnosticPrompt({
      baseInstruction: input.config.diagnosticInstruction,
      personaInstruction: input.persona.instruction,
      customInstruction: input.customInstruction,
      sectionTitle: input.section.title,
      sectionFunction: input.spec.function,
      mainClaim: input.spec.mainClaim,
      requiredMoves: input.spec.requiredMoves,
      incomingContext: input.spec.incomingContext,
      outgoingCommitments: input.spec.outgoingCommitments,
      scope: input.scope,
      content: isWholeDocument ? contextContent : contextContent.slice(0, 12000),
    });

    const choice = this.choose('runDiagnostic', input);
    const text = await this.clientFor(choice.provider).generateText({
      model: choice.model,
      prompt,
      json: true,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = safeJsonParse(text || '{}');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moveResults: MoveResult[] = (json.moveResults || []).map((mr: any, i: number) => ({
      moveId: mr.moveId || `move-${i}`,
      moveDescription: mr.moveDescription || input.spec.requiredMoves[i]?.description || '',
      status: VALID_MOVE_STATUSES.includes(mr.status) ? mr.status : 'unclear',
      location: mr.location || undefined,
      diagnosis: mr.diagnosis || undefined,
      suggestedAction: mr.suggestedAction || undefined,
    }));

    return {
      moveResults,
      coherenceNotes: json.coherenceNotes || [],
      overallReadiness: VALID_READINESS.includes(json.overallReadiness)
        ? json.overallReadiness
        : 'draft',
      nextPriority:
        json.nextPriority || 'Review the diagnostic results and address the first missing move.',
    };
  }

  async estimateDependencies(
    input: EstimateDependenciesInput,
  ): Promise<Record<string, Dependency[]>> {
    const flatSections: Section[] = [];
    const traverse = (nodes: Section[]) => {
      nodes.forEach((n) => {
        flatSections.push(n);
        traverse(n.children);
      });
    };
    traverse(input.sections);

    const sectionsWithSpecs = flatSections.filter((s) => {
      const spec = input.testSuite[s.id]?.spec;
      return spec && (spec.incomingContext.length > 0 || spec.outgoingCommitments.length > 0);
    });

    if (sectionsWithSpecs.length < 2) return {};

    const contextData = sectionsWithSpecs.map((s) => ({
      id: s.id,
      title: s.title,
      incomingContext: input.testSuite[s.id].spec?.incomingContext || [],
      outgoingCommitments: input.testSuite[s.id].spec?.outgoingCommitments || [],
    }));

    const prompt = `\n${input.config.dependenciesPrompt}\n\nSECTIONS DATA:\n${JSON.stringify(contextData, null, 2)}\n  `;

    const choice = this.choose('estimateDependencies', input);
    const text = await this.clientFor(choice.provider).generateText({
      model: choice.model,
      prompt,
      json: true,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = safeJsonParse(text || '{}');
    const result: Record<string, Dependency[]> = {};
    for (const key in json) {
      if (Array.isArray(json[key])) {
        result[key] = json[key]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((d: any) => ({
            id: d.id,
            type: d.type === 'reference' ? ('reference' as const) : ('prerequisite' as const),
          }))
          .filter((d: Dependency) => d.id);
      }
    }
    return result;
  }

  async getCoachAdvice(input: CoachAdviceInput): Promise<string> {
    const structureData = input.sections.map((sec) => {
      const tests = input.testSuite[sec.id];
      return {
        title: sec.title,
        level: sec.level,
        wordCount: sec.wordCount,
        goals: tests?.goals,
        status: tests?.status,
        missingMoves:
          tests?.lastDiagnostic?.moveResults?.filter(
            (m) => m.status === 'missing' || m.status === 'unclear',
          ) || [],
      };
    });

    const prompt = `\n${input.config.coachPrompt}\n\nDocument Size: ${input.markdown.length} characters\nTotal Sections: ${input.sections.length}\n\nCURRENT STRUCTURE OVERVIEW (Focus on where things are 'stale', 'fail', or 'draft', and where moves are missing):\n${JSON.stringify(structureData, null, 2)}\n`;

    const choice = this.choose('getCoachAdvice', input);
    return this.clientFor(choice.provider).generateText({
      model: choice.model,
      prompt,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
  }

  async getContentSuggestions(input: ContentSuggestionsInput): Promise<string> {
    const prompt = `\n${input.config.suggestContentPrompt}\n\nCONTEXT:\nSection Title: "${input.sectionTitle}"\nParent Section Goals: "${input.parentGoals || 'N/A'}"\nSection Goals: "${input.currentGoals}"\nCurrent Content:\n---\n${input.fullSectionContent.slice(0, 5000)}\n---\n      `;

    const choice = this.choose('getContentSuggestions', input);
    return this.clientFor(choice.provider).generateText({
      model: choice.model,
      prompt,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
  }

  async generatePersonas(input: GeneratePersonasInput): Promise<PersonaSuggestion[]> {
    const contextSample = input.documentContext.slice(0, 5000);
    const prompt = `\n${input.config.generatePersonasPrompt}\n\nTEXT SAMPLE:\n---\n${contextSample}\n---\n`;

    const choice = this.choose('generatePersonas', input);
    const text = await this.clientFor(choice.provider).generateText({
      model: choice.model,
      prompt,
      json: true,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });

    const json = safeJsonParse(text || '{}');
    if (!json.personas || !Array.isArray(json.personas)) return [];
    return json.personas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p && p.name && p.instruction)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        name: String(p.name),
        role: String(p.role || 'Custom Role'),
        instruction: String(p.instruction),
      }));
  }

  async refineSpec(input: RefineSpecInput): Promise<string> {
    const prompt = `\n${input.config.refineSpecPrompt}\n\nCONTEXT:\nSection Title: "${input.sectionTitle}"\nParent Section Goals: "${input.parentGoals || 'N/A'}"\nCurrent Goals: "${input.currentGoals}"\nSection Content: "${input.fullSectionContent.slice(0, 3000)}..."\n\nUSER INSTRUCTION: "${input.instruction.trim() || 'Improve and refine the goals for clarity, conciseness, and completeness.'}"\n      `;

    const choice = this.choose('refineSpec', input);
    const text = await this.clientFor(choice.provider).generateText({
      model: choice.model,
      prompt,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
    return (text || '').trim();
  }

  async analyzeSection(input: AnalyzeSectionInput): Promise<SectionAnalysis> {
    // Whole-document analysis sends the full text uncapped (the caller has already
    // verified it fits the model window); per-section analysis keeps the cap.
    const text = input.wholeDocument
      ? input.sectionText
      : input.sectionText.slice(0, ANALYSIS_INPUT_CAP);
    const prompt = buildAnalysisRequestText(
      input.sectionTitle,
      text,
      input.config.analysisPrompt,
      input.wholeDocument,
    );
    return this.generateAnalysis('analyzeSection', input, prompt);
  }

  async refactorAnalysis(input: RefactorAnalysisInput): Promise<SectionAnalysis> {
    const prompt = buildRefactorRequestText({
      sectionTitle: input.sectionTitle,
      sectionText: input.sectionText.slice(0, ANALYSIS_INPUT_CAP),
      analysisJson: JSON.stringify(input.analysis, null, 2),
      transcript: formatTranscript(input.dialogue, input.dialogueContext),
      prompt: input.config.refactorAnalysisPrompt,
    });
    return this.generateAnalysis(
      'refactorAnalysis',
      input,
      prompt,
      'Refactored analysis could not be parsed.',
    );
  }

  /** Shared request/parse for the two analysis-producing calls. */
  private async generateAnalysis(
    kind: AICallKind,
    input: OverrideFields,
    prompt: string,
    parseError = 'Analysis response could not be parsed.',
  ): Promise<SectionAnalysis> {
    const choice = this.choose(kind, input);
    const text = await this.clientFor(choice.provider).generateText({
      model: choice.model,
      prompt,
      json: true,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
    const analysis = normalizeAnalysis(safeJsonParse(text || '', null));
    if (!analysis) throw new Error(parseError);
    return analysis;
  }

  /**
   * Stateless streaming chat: the full (windowed) history travels each turn, so
   * a conversation survives reloads and the provider holds no state.
   */
  async *continueDialogue(input: ContinueDialogueInput): AsyncIterable<string> {
    const analysisJson = input.analysis
      ? JSON.stringify(input.analysis).slice(0, DIALOGUE_ANALYSIS_CAP)
      : '';
    const systemInstruction = [
      input.config.dialoguePrompt,
      `CONTEXT:\n${input.context}`,
      analysisJson ? `CURRENT ANALYSIS (JSON):\n${analysisJson}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const recent = input.messages.slice(-DIALOGUE_HISTORY_WINDOW);
    const messages: LLMMessage[] = recent.map((m) => ({ role: m.role, text: m.text }));

    const choice = this.choose('continueDialogue', input);
    const stream = this.clientFor(choice.provider).streamText({
      model: choice.model,
      messages,
      systemInstruction,
      thinkingBudget: choice.thinkingBudget,
    });
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}
