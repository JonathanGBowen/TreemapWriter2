// Provider-agnostic AIProvider implementation.
//
// This is where ALL prompt-building and response parsing lives (ported from the
// old gemini-provider.ts). It resolves which model runs each call kind, then
// dispatches to the matching LLMClient transport. Adding a provider means adding
// a client, not re-implementing these flows. Replaces gemini-provider.ts.

import type {
  Section,
  SectionAnalysis,
  SectionSpec,
  MoveResult,
  DiagnosticResult,
  Dependency,
  RevisionProposal,
  ReverseOutlineBullet,
  ParagraphRewrite,
  DirectiveSuggestion,
  SprintPlan,
  SprintMove,
  VersionComparison,
  SectionSpecTest,
  WholeVerdict,
  ReadingMode,
  GistAnalysis,
  GistComposition,
  GistSpan,
} from '../../types';
import { buildDiagnosticPrompt } from '../../lib/constants';
import {
  buildStructuralSurround,
  formatStructuralSurround,
  parseCommitmentFindings,
  parseNextAction,
} from '../../lib/diagnostic-helpers';
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
  GenerateRevisionsInput,
  GenerateReverseOutlineInput,
  RegenerateParagraphInput,
  AnalyzeGistInput,
  ComposeGistInput,
  RefreshGistSpanInput,
  RefitGistInput,
  SuggestDirectivesInput,
  GenerateSprintPlanInput,
  CoachSprintTurnInput,
  DecomposeSprintStepInput,
  CompareVersionsInput,
  SpecTestSectionInput,
  SpecTestWholeInput,
  AnalyzeAtmosphereInput,
  GenerateSpecLevelInput,
  DevelopSpecLevelInput,
  ReconstructWholeInput,
  RecenterInput,
  RunAgentInput,
} from '../ai-provider';
import type { AICallKind, ModelChoice, ProviderId } from './model-types';
import { AI_CALL_KIND_LABELS } from './model-types';
import type { LLMClient, LLMMessage, LLMRequest } from './clients';
import type { CatalogModel } from './model-catalog';
import { findCatalogModel } from './model-catalog';
import { checkContextFit } from './context-budget';
import type {
  ExhaustionReason,
  FallbackSettings,
  ModelCooldowns,
  TransientRetryOptions,
} from './model-fallback';
import {
  AllModelsExhaustedError,
  buildCandidates,
  classifyAIError,
  withTransientRetry,
} from './model-fallback';
import type { RequestThrottle } from './request-throttle';
import type { QuotaAnnotatedError } from './model-types';
import { getPromptText } from '../prompts';
import { generateSpecs, generateSpecLevel, buildStagePrompt } from './ai-provider.specs';
import { generateRevisions } from './ai-provider.revisions';
import { generateReverseOutline } from './ai-provider.reverse-outline';
import { regenerateParagraph } from './ai-provider.regenerate';
import { reconstructWhole, proposeRecenterings } from './ai-provider.gestalt';
import { analyzeGist } from './ai-provider.gist-analysis';
import { composeGist } from './ai-provider.gist-composition';
import { refreshGistSpan } from './ai-provider.gist-refresh';
import { refitGist } from './ai-provider.gist-refit';
import { suggestDirectives } from './ai-provider.suggest-directives';
import { generateSprintPlan, decomposeSprintStep } from './ai-provider.sprint';
import { compareVersions } from './ai-provider.compare';
import { runSpecTestSection, runSpecTestWhole } from './ai-provider.spec-test';
import { analyzeAtmosphere } from './ai-provider.atmosphere';
import { runAgentLoop } from './agent';

const MAX_OUTPUT_TOKENS = 16000;

const VALID_MOVE_STATUSES = ['present', 'partial', 'missing', 'unclear'] as const;
const VALID_READINESS = ['draft', 'developing', 'nearly-there', 'solid'];
const VALID_MOVE_ADVANCE = ['productive', 'recapitulative'] as const;

/**
 * Build the coach triage prompt from the document's structure overview. Shared
 * by the streaming and non-streaming coach calls so they stay in lockstep.
 */
function buildCoachPrompt(input: CoachAdviceInput): string {
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
  return `\n${input.config.coachPrompt}\n\nDocument Size: ${input.markdown.length} characters\nTotal Sections: ${input.sections.length}\n\nCURRENT STRUCTURE OVERVIEW (Focus on where things are 'stale', 'fail', or 'draft', and where moves are missing):\n${JSON.stringify(structureData, null, 2)}\n`;
}

export interface ProviderClients {
  gemini: LLMClient;
  anthropic: LLMClient;
  ollama: LLMClient;
  /** Experimental Claude Agent SDK transport (proxies to the local Node helper). */
  agentSdk: LLMClient;
}

/** Resolves the configured ModelChoice for a call kind (project → global → default). */
export type ChoiceResolver = (kind: AICallKind) => ModelChoice;

/**
 * The quota-fallback context, injected by the registry (which owns the live
 * settings/catalog source + the shared cooldown registry). Optional: when absent
 * — e.g. a unit test constructing the provider directly — `dispatch` is a
 * transparent passthrough to the raw client, so callers behave exactly as before.
 */
export interface FallbackDeps {
  getContext: () => { settings: FallbackSettings; catalog: CatalogModel[] };
  cooldowns: ModelCooldowns;
  /** Backoff knobs for the in-place transient retry; defaults applied when omitted. */
  retry?: TransientRetryOptions;
  /**
   * Proactive per-minute throttle. When present, each candidate call waits (if
   * needed) to stay within the model's `requestsPerMinute` before firing. Absent ⇒
   * no client-side throttling (e.g. unit tests).
   */
  throttle?: RequestThrottle;
}

interface OverrideFields {
  modelChoice?: ModelChoice;
  modelId?: string;
  thinkingBudget?: number;
}

/** The text a request will send, used to size it against a candidate's window. */
function requestText(req: LLMRequest): string {
  const body = req.prompt ?? (req.messages?.map((m) => m.text).join('\n') ?? '');
  return req.systemInstruction ? `${req.systemInstruction}\n${body}` : body;
}

export class MultiProviderAIProvider implements AIProvider {
  constructor(
    private readonly clients: ProviderClients,
    private readonly resolveChoice: ChoiceResolver,
    private readonly fallback?: FallbackDeps,
  ) {}

  /** Per-call override → legacy Gemini modelId → configured model for this kind. */
  private choose(kind: AICallKind, input: OverrideFields): ModelChoice {
    if (input.modelChoice) return input.modelChoice;
    if (input.modelId) {
      return { provider: 'gemini', model: input.modelId, thinkingBudget: input.thinkingBudget };
    }
    return this.resolveChoice(kind);
  }

  private rawClientFor(provider: ProviderId, kind?: AICallKind): LLMClient {
    const base =
      provider === 'anthropic'
        ? this.clients.anthropic
        : provider === 'ollama'
          ? this.clients.ollama
          : provider === 'agent-sdk'
            ? this.clients.agentSdk
            : this.clients.gemini;
    // For the Agent SDK, wrap each call so it carries a trace label + kind; the
    // agent client uses these to label/scope the live thinking/activity trace it
    // emits. Other providers ignore trace fields, so return the raw client.
    if (provider !== 'agent-sdk' || !kind) return base;
    const traceLabel = AI_CALL_KIND_LABELS[kind];
    return {
      generateText: (req) => base.generateText({ ...req, traceLabel, traceKind: kind }),
      streamText: (req) => base.streamText({ ...req, traceLabel, traceKind: kind }),
    };
  }

  /**
   * The dispatch seam. Returns an LLMClient that runs the call against the chosen
   * model and, on a quota/transient error, walks down the configured fallback
   * ladder (skipping models on cooldown or whose window can't hold the prompt). A
   * daily-quota error puts that model on cooldown until the next reset; transient
   * errors are retried in place with backoff and never cool a model down. When no
   * fallback deps are wired, this is the raw client unchanged.
   */
  private dispatch(choice: ModelChoice, kind: AICallKind): LLMClient {
    const fb = this.fallback;
    if (!fb) return this.rawClientFor(choice.provider, kind);

    const { settings, catalog } = fb.getContext();
    // The ladder only extends past the chosen model when fallback is enabled; the
    // wrapper still runs when disabled so thinking-convention resolution happens.
    const candidates = buildCandidates(choice, settings.enabled ? settings.ladder : []);
    const cooldowns = fb.cooldowns;

    const viableFor = (req: LLMRequest): ModelChoice[] => {
      const now = Date.now();
      const text = requestText(req);
      return candidates.filter(
        (c) =>
          !cooldowns.isActive(c.provider, c.model, now) && checkContextFit(catalog, c, text).ok,
      );
    };
    const exhausted = (req: LLMRequest, cause: unknown): AllModelsExhaustedError => {
      const now = Date.now();
      const text = requestText(req);
      const contextBlocked = candidates.some(
        (c) =>
          !cooldowns.isActive(c.provider, c.model, now) && checkContextFit(catalog, c, text).overflow,
      );
      // Distinguish a per-DAY wall (wait for the reset) from a per-MINUTE / transient
      // wall (retry soon). `cause === undefined` means every candidate was filtered
      // out before any call ran — i.e. all on a daily cooldown (context handled
      // above); a transient `cause` means we tried and hit per-minute/overload limits.
      let reason: ExhaustionReason;
      if (contextBlocked) {
        reason = 'context';
      } else if (cause === undefined) {
        reason = 'quota';
      } else {
        const cls = classifyAIError(cause);
        reason = cls === 'rate-limit' || cls === 'overloaded' ? 'rate-limit' : 'quota';
      }
      const retryAfterMs =
        reason === 'rate-limit'
          ? (cause as QuotaAnnotatedError | undefined)?.__retryDelayMs
          : undefined;
      const message =
        reason === 'context'
          ? `No available model can hold this request (${AI_CALL_KIND_LABELS[kind]}).`
          : reason === 'rate-limit'
            ? `All fallback models are rate-limited right now (${AI_CALL_KIND_LABELS[kind]}).`
            : `All fallback models are out of quota for ${AI_CALL_KIND_LABELS[kind]}.`;
      return new AllModelsExhaustedError(reason, message, cause, retryAfterMs);
    };
    // On a per-candidate failure: cool down on daily quota, advance on transient,
    // rethrow a genuine error. Returns true to continue to the next candidate.
    const advance = (cand: ModelChoice, err: unknown): boolean => {
      const cls = classifyAIError(err);
      if (cls === 'daily-quota') {
        cooldowns.markDailyQuota(cand.provider, cand.model, Date.now());
        return true;
      }
      if (cls === 'overloaded' || cls === 'rate-limit') return true;
      throw err;
    };

    // Capture the two provider methods as arrows (lexical `this`) so the returned
    // client's methods stay free of a `this` alias.
    const makeReq = (req: LLMRequest, cand: ModelChoice): LLMRequest =>
      this.buildReq(req, cand, catalog);
    const clientFor = (cand: ModelChoice): LLMClient => this.rawClientFor(cand.provider, kind);
    // Proactive per-minute throttle: wait (if needed) to stay within the model's
    // catalog `requestsPerMinute` before each actual call. Counts every attempt
    // (including transient retries), since each is a real request against the quota.
    const throttle = fb.throttle;
    const gate = (cand: ModelChoice): Promise<void> =>
      throttle
        ? throttle.acquire(
            `${cand.provider}:${cand.model}`,
            findCatalogModel(catalog, cand.provider, cand.model)?.requestsPerMinute,
          )
        : Promise.resolve();

    return {
      async generateText(req: LLMRequest): Promise<string> {
        const viable = viableFor(req);
        if (viable.length === 0) throw exhausted(req, undefined);
        let lastErr: unknown;
        for (const cand of viable) {
          const built = makeReq(req, cand);
          const client = clientFor(cand);
          try {
            return await withTransientRetry(async () => {
              await gate(cand);
              return client.generateText(built);
            }, fb.retry);
          } catch (err) {
            lastErr = err;
            advance(cand, err); // throws on a genuine error
          }
        }
        throw exhausted(req, lastErr);
      },
      async *streamText(req: LLMRequest): AsyncIterable<string> {
        const viable = viableFor(req);
        if (viable.length === 0) throw exhausted(req, undefined);
        let lastErr: unknown;
        for (const cand of viable) {
          const built = makeReq(req, cand);
          const client = clientFor(cand);
          let yielded = false;
          try {
            // Transient retry covers establishment + the first chunk (a fresh
            // iterator per attempt); once a chunk has been yielded we can't restart.
            const { iter, first } = await withTransientRetry(async () => {
              await gate(cand);
              const it = client.streamText(built)[Symbol.asyncIterator]();
              return { iter: it, first: await it.next() };
            }, fb.retry);
            if (!first.done) {
              yielded = true;
              yield first.value;
            }
            for (let n = await iter.next(); !n.done; n = await iter.next()) {
              yielded = true;
              yield n.value;
            }
            return;
          } catch (err) {
            if (yielded) throw err;
            lastErr = err;
            advance(cand, err); // throws on a genuine error
          }
        }
        throw exhausted(req, lastErr);
      },
    };
  }

  /**
   * Rebuild a request for a fallback candidate: point it at the candidate's model
   * and re-express the thinking intent in THAT model's convention. "Wants thinking"
   * is carried by the original request (a non-zero budget or any level); we then
   * maximize per the catalog (`level` → 'high', `budget` → -1 dynamic) or clear it
   * entirely when the candidate can't think.
   */
  private buildReq(req: LLMRequest, cand: ModelChoice, catalog: CatalogModel[]): LLMRequest {
    const wantsThinking =
      (typeof req.thinkingBudget === 'number' && req.thinkingBudget !== 0) || !!req.thinkingLevel;
    const meta = findCatalogModel(catalog, cand.provider, cand.model);
    const next: LLMRequest = { ...req, model: cand.model };
    delete next.thinkingBudget;
    delete next.thinkingLevel;
    if (wantsThinking && meta?.supportsThinking) {
      if (meta.thinking === 'level') next.thinkingLevel = 'high';
      else next.thinkingBudget = -1;
    }
    return next;
  }

  /**
   * Prepend the draft-mode reading overlay to a base instruction when the mode is
   * 'draft' (the default). 'final' prepends nothing — today's completed-work read.
   */
  private withDraftMode(mode: ReadingMode | undefined, overlayKey: string, base: string): string {
    return (mode ?? 'draft') === 'draft' ? `${getPromptText(overlayKey)}\n\n${base}` : base;
  }

  async generateSpecs(input: GenerateSpecsInput): Promise<void> {
    const choice = this.choose('generateSpecs', input);
    await generateSpecs(this.dispatch(choice, 'generateSpecs'), choice.model, choice.thinkingBudget ?? 0, input);
  }

  async generateSpecLevel(input: GenerateSpecLevelInput): Promise<Record<string, SectionSpec>> {
    // The non-agent single-shot path runs on the configured `generateSpecs` model.
    const choice = this.choose('generateSpecs', input);
    return generateSpecLevel(
      this.dispatch(choice, 'generateSpecs'),
      choice.model,
      choice.thinkingBudget ?? 0,
      {
        stage: input.stage,
        sections: input.sections,
        markdown: input.markdown,
        specCache: input.specCache,
        config: input.config,
        rootFullText: input.rootFullText,
        steer: input.steer,
      },
    );
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

    // A part is what it is by its role in the whole (Wertheimer, On Truth). When the
    // caller supplies the spec map, judge this section inside its live surround —
    // parent/sibling claims and commitments — rather than as an isolated piece. The
    // whole-document pass is already the whole, so it needs no surround.
    const structuralSurround =
      !isWholeDocument && input.specs
        ? formatStructuralSurround(
            buildStructuralSurround(input.section.id, input.sections, input.specs),
          )
        : '';

    const prompt = buildDiagnosticPrompt({
      baseInstruction: this.withDraftMode(input.mode, 'diagnosticModeDraft', input.config.diagnosticInstruction),
      personaInstruction: input.persona.instruction,
      customInstruction: input.customInstruction,
      sectionTitle: input.section.title,
      sectionFunction: input.spec.function,
      mainClaim: input.spec.mainClaim,
      requiredMoves: input.spec.requiredMoves,
      incomingContext: input.spec.incomingContext,
      outgoingCommitments: input.spec.outgoingCommitments,
      scope: input.scope,
      content: contextContent,
      structuralSurround,
    });

    const choice = this.choose('runDiagnostic', input);
    const text = await this.dispatch(choice, 'runDiagnostic').generateText({
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
      advance: VALID_MOVE_ADVANCE.includes(mr.advance) ? mr.advance : undefined,
      location: mr.location || undefined,
      diagnosis: mr.diagnosis || undefined,
      suggestedAction: mr.suggestedAction || undefined,
    }));

    const nextAction = parseNextAction(json.nextAction);

    return {
      moveResults,
      coherenceNotes: json.coherenceNotes || [],
      commitmentFindings: parseCommitmentFindings(json.commitmentFindings),
      overallReadiness: VALID_READINESS.includes(json.overallReadiness)
        ? json.overallReadiness
        : 'draft',
      nextAction,
      nextPriority:
        json.nextPriority ||
        nextAction?.vector ||
        'Review the diagnostic results and address the first missing move.',
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
    const text = await this.dispatch(choice, 'estimateDependencies').generateText({
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
    const choice = this.choose('getCoachAdvice', input);
    return this.dispatch(choice, 'getCoachAdvice').generateText({
      model: choice.model,
      prompt: buildCoachPrompt(input),
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
  }

  /** Streaming sibling of getCoachAdvice — same prompt, yielded token-by-token. */
  async *streamCoachAdvice(input: CoachAdviceInput): AsyncIterable<string> {
    const choice = this.choose('streamCoachAdvice', input);
    const stream = this.dispatch(choice, 'streamCoachAdvice').streamText({
      model: choice.model,
      prompt: buildCoachPrompt(input),
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async getContentSuggestions(input: ContentSuggestionsInput): Promise<string> {
    const prompt = `\n${input.config.suggestContentPrompt}\n\nCONTEXT:\nSection Title: "${input.sectionTitle}"\nParent Section Goals: "${input.parentGoals || 'N/A'}"\nSection Goals: "${input.currentGoals}"\nCurrent Content:\n---\n${input.fullSectionContent}\n---\n      `;

    const choice = this.choose('getContentSuggestions', input);
    return this.dispatch(choice, 'getContentSuggestions').generateText({
      model: choice.model,
      prompt,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
  }

  async generatePersonas(input: GeneratePersonasInput): Promise<PersonaSuggestion[]> {
    const prompt = `\n${input.config.generatePersonasPrompt}\n\nTEXT SAMPLE:\n---\n${input.documentContext}\n---\n`;

    const choice = this.choose('generatePersonas', input);
    const text = await this.dispatch(choice, 'generatePersonas').generateText({
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
    const prompt = `\n${input.config.refineSpecPrompt}\n\nCONTEXT:\nSection Title: "${input.sectionTitle}"\nParent Section Goals: "${input.parentGoals || 'N/A'}"\nCurrent Goals: "${input.currentGoals}"\nSection Content: "${input.fullSectionContent}"\n\nUSER INSTRUCTION: "${input.instruction.trim() || 'Improve and refine the goals for clarity, conciseness, and completeness.'}"\n      `;

    const choice = this.choose('refineSpec', input);
    const text = await this.dispatch(choice, 'refineSpec').generateText({
      model: choice.model,
      prompt,
      thinkingBudget: choice.thinkingBudget,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
    return (text || '').trim();
  }

  async analyzeSection(input: AnalyzeSectionInput): Promise<SectionAnalysis> {
    // Send the full section text — never a slice. The caller (use-analysis-actions)
    // pre-flights the token budget against the model window and aborts on overflow.
    const prompt = buildAnalysisRequestText(
      input.sectionTitle,
      input.sectionText,
      this.withDraftMode(input.mode, 'analysisModeDraft', input.config.analysisPrompt),
      input.wholeDocument,
      input.spell,
      input.structuralSurround,
    );
    return this.generateAnalysis('analyzeSection', input, prompt);
  }

  async refactorAnalysis(input: RefactorAnalysisInput): Promise<SectionAnalysis> {
    const prompt = buildRefactorRequestText({
      sectionTitle: input.sectionTitle,
      sectionText: input.sectionText,
      analysisJson: JSON.stringify(input.analysis, null, 2),
      transcript: formatTranscript(input.dialogue, input.dialogueContext),
      prompt: this.withDraftMode(input.mode, 'analysisModeDraft', input.config.refactorAnalysisPrompt),
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
    const text = await this.dispatch(choice, kind).generateText({
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

  async generateRevisions(input: GenerateRevisionsInput): Promise<RevisionProposal[]> {
    const choice = this.choose('generateRevisions', input);
    return generateRevisions(
      this.dispatch(choice, 'generateRevisions'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async generateReverseOutline(input: GenerateReverseOutlineInput): Promise<ReverseOutlineBullet[]> {
    const choice = this.choose('generateReverseOutline', input);
    return generateReverseOutline(
      this.dispatch(choice, 'generateReverseOutline'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async regenerateParagraph(input: RegenerateParagraphInput): Promise<ParagraphRewrite | null> {
    const choice = this.choose('regenerateParagraph', input);
    return regenerateParagraph(
      this.dispatch(choice, 'regenerateParagraph'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async reconstructWhole(input: ReconstructWholeInput) {
    const choice = this.choose('reconstructWhole', input);
    return reconstructWhole(
      this.dispatch(choice, 'reconstructWhole'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async proposeRecenterings(input: RecenterInput) {
    const choice = this.choose('proposeRecenterings', input);
    return proposeRecenterings(
      this.dispatch(choice, 'proposeRecenterings'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async analyzeGist(input: AnalyzeGistInput): Promise<GistAnalysis> {
    const choice = this.choose('analyzeGist', input);
    return analyzeGist(this.dispatch(choice, 'analyzeGist'), choice.model, choice.thinkingBudget, input);
  }

  async composeGist(input: ComposeGistInput): Promise<GistComposition> {
    const choice = this.choose('composeGist', input);
    return composeGist(this.dispatch(choice, 'composeGist'), choice.model, choice.thinkingBudget, input);
  }

  async refreshGistSpan(input: RefreshGistSpanInput): Promise<GistSpan | null> {
    const choice = this.choose('refreshGistSpan', input);
    return refreshGistSpan(this.dispatch(choice, 'refreshGistSpan'), choice.model, choice.thinkingBudget, input);
  }

  async refitGist(input: RefitGistInput): Promise<GistSpan[] | null> {
    const choice = this.choose('refitGist', input);
    return refitGist(this.dispatch(choice, 'refitGist'), choice.model, choice.thinkingBudget, input);
  }

  async suggestDirectives(input: SuggestDirectivesInput): Promise<DirectiveSuggestion[]> {
    const choice = this.choose('suggestDirectives', input);
    return suggestDirectives(
      this.dispatch(choice, 'suggestDirectives'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async generateSprintPlan(input: GenerateSprintPlanInput): Promise<SprintPlan> {
    const choice = this.choose('generateSprintPlan', input);
    return generateSprintPlan(
      this.dispatch(choice, 'generateSprintPlan'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async decomposeSprintStep(input: DecomposeSprintStepInput): Promise<SprintMove[]> {
    const choice = this.choose('decomposeSprintStep', input);
    return decomposeSprintStep(
      this.dispatch(choice, 'decomposeSprintStep'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async compareVersions(input: CompareVersionsInput): Promise<VersionComparison> {
    const choice = this.choose('compareVersions', input);
    return compareVersions(
      this.dispatch(choice, 'compareVersions'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async runSpecTestSection(input: SpecTestSectionInput): Promise<SectionSpecTest | null> {
    const choice = this.choose('runSpecTestSection', input);
    return runSpecTestSection(
      this.dispatch(choice, 'runSpecTestSection'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async runSpecTestWhole(input: SpecTestWholeInput): Promise<Omit<WholeVerdict, 'meshDelta'> | null> {
    const choice = this.choose('runSpecTestWhole', input);
    return runSpecTestWhole(
      this.dispatch(choice, 'runSpecTestWhole'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  async analyzeAtmosphere(input: AnalyzeAtmosphereInput): Promise<string> {
    const choice = this.choose('analyzeAtmosphere', input);
    return analyzeAtmosphere(
      this.dispatch(choice, 'analyzeAtmosphere'),
      choice.model,
      choice.thinkingBudget,
      input,
    );
  }

  /**
   * Stateless streaming chat: the full (windowed) history travels each turn, so
   * a conversation survives reloads and the provider holds no state.
   */
  async *continueDialogue(input: ContinueDialogueInput): AsyncIterable<string> {
    const analysisJson = input.analysis ? JSON.stringify(input.analysis) : '';
    const systemInstruction = [
      input.config.dialoguePrompt,
      `CONTEXT:\n${input.context}`,
      analysisJson ? `CURRENT ANALYSIS (JSON):\n${analysisJson}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // Send the whole conversation — never a window. The caller pre-flights the
    // assembled history against the model's context budget and aborts on overflow.
    const messages: LLMMessage[] = input.messages.map((m) => ({ role: m.role, text: m.text }));

    const choice = this.choose('continueDialogue', input);
    const stream = this.dispatch(choice, 'continueDialogue').streamText({
      model: choice.model,
      messages,
      systemInstruction,
      thinkingBudget: choice.thinkingBudget,
    });
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * Streaming coach turn for the sprint start protocol. Like continueDialogue,
   * the full history travels each turn (stateless provider). The system
   * instruction is the sprint-coach prompt + the section framing + which goal
   * model is running (WOOP vs plain).
   */
  async *coachSprintTurn(input: CoachSprintTurnInput): AsyncIterable<string> {
    const spec = input.spec;
    const framing = [
      `SECTION: "${input.sectionTitle}"`,
      spec ? `FUNCTION: ${spec.function}` : '',
      spec ? `MAIN CLAIM: ${spec.mainClaim}` : '',
      `GOAL MODEL: ${input.goalModel === 'woop' ? 'WOOP (wish → inner obstacle → if-then plan)' : 'plain (just the one concrete goal)'}`,
    ]
      .filter(Boolean)
      .join('\n');
    const systemInstruction = `${input.config.sprintCoachPrompt}\n\nCONTEXT:\n${framing}`;

    const messages: LLMMessage[] = input.messages.map((m) => ({ role: m.role, text: m.text }));

    const choice = this.choose('coachSprintTurn', input);
    const stream = this.dispatch(choice, 'coachSprintTurn').streamText({
      model: choice.model,
      messages,
      systemInstruction,
      thinkingBudget: choice.thinkingBudget,
    });
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * Collaborative, streaming per-level spec development. Like continueDialogue, the
   * full conversation travels each turn (stateless provider). The system instruction
   * is the conversational contract (config.developSpecPrompt) followed by the SAME
   * per-level prompt the single-shot path builds — the spec rubric, the accepted
   * parent context, and this level's sections — which the contract overrides on the
   * "return only JSON" point. The fenced ```json``` proposal is parsed by the caller.
   */
  async *developSpecLevel(input: DevelopSpecLevelInput): AsyncIterable<string> {
    const reference = buildStagePrompt(input.stage, {
      sections: input.sections,
      markdown: input.markdown,
      specCache: input.specCache,
      config: input.config,
      rootFullText: input.rootFullText,
    });
    const systemInstruction = [
      input.config.developSpecPrompt,
      '',
      '--- FIELD RUBRIC & CONTEXT FOR THIS LEVEL ---',
      '(The conversational contract above overrides any "return only JSON" / "return a single JSON object" instruction in the rubric below.)',
      '',
      reference,
    ].join('\n');

    const messages: LLMMessage[] = input.messages.map((m) => ({ role: m.role, text: m.text }));

    const choice = this.choose('developSpecLevel', input);
    const stream = this.dispatch(choice, 'developSpecLevel').streamText({
      model: choice.model,
      messages,
      systemInstruction,
      thinkingBudget: choice.thinkingBudget,
    });
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * The local, provider-agnostic agent. Resolves + dispatches the model (so the
   * fallback ladder, throttle, and context-budget pre-flight all apply), then
   * hands the wrapped client to the tool-using loop. The loop emits its own live
   * trace (the providers here, unlike the Agent SDK client, emit none), and the
   * caller pre-built the whole-text context + tools — so this method stays a thin
   * seam, exactly like `continueDialogue`.
   */
  async *runAgent(input: RunAgentInput): AsyncIterable<string> {
    const choice = this.choose('runAgent', input);
    const client = this.dispatch(choice, 'runAgent');
    yield* runAgentLoop({
      client,
      model: choice.model,
      thinkingBudget: choice.thinkingBudget,
      messages: input.messages,
      context: input.context,
      tools: input.tools,
      maxSteps: input.maxSteps,
    });
  }
}
