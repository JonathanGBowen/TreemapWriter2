// Phase 3.5 — Gemini implementation of the AIProvider interface.
//
// This is the ONE file in the codebase that imports `@google/genai`. Everything
// else goes through `ai-provider.ts` (the interface) and `ai-provider-registry.ts`
// (the DI switch). Mirrors how `tauri-repository.ts` is the one Tauri caller.

import { GoogleGenAI } from '@google/genai';
import type {
  Section,
  SectionFunction,
  RequiredMove,
  SectionSpec,
  MoveResult,
  DiagnosticResult,
  Dependency,
} from '../types';
import { buildDiagnosticPrompt } from '../lib/constants';
import { safeJsonParse } from '../lib/utils';
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
} from './ai-provider';

const PERSONAS_DEFAULT_MODEL = 'gemini-3-flash-preview';
const REFINE_SPEC_DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const REFINE_SPEC_DEFAULT_THINKING = 16000;

const VALID_FUNCTIONS: SectionFunction[] = [
  'introduce', 'explicate', 'argue', 'compare', 'critique',
  'synthesize', 'apply', 'evaluate', 'narrate', 'transition',
];
const VALID_MOVE_STATUSES = ['present', 'partial', 'missing', 'unclear'] as const;
const VALID_READINESS = ['draft', 'developing', 'nearly-there', 'solid'];

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private clientCached: GoogleGenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Phase 4f — let the registry swap the key after async-resolving from
   * the OS keyring. Invalidates the cached SDK client so the next AI
   * call uses the new key. Safe to call with the same key (no-op).
   */
  setApiKey(apiKey: string): void {
    if (apiKey === this.apiKey) return;
    this.apiKey = apiKey;
    this.clientCached = null;
  }

  /**
   * Lazy: we don't construct the SDK client until the first AI call, so an
   * app launched without an API key still boots — the error only surfaces
   * when the user actually invokes AI. Mirrors the pre-Phase-3.5 behavior
   * where the inline `new GoogleGenAI({ apiKey })` lived inside each
   * modal's `handleGenerate`.
   */
  private get client(): GoogleGenAI {
    if (!this.apiKey) throw new Error('API Key missing');
    if (!this.clientCached) this.clientCached = new GoogleGenAI({ apiKey: this.apiKey });
    return this.clientCached;
  }

  async generateSpecs(input: GenerateSpecsInput): Promise<void> {
    const { sections, markdown, config, modelId, thinkingBudget, onBatchComplete } = input;

    const allNodes: Section[] = [];
    const traverse = (nodes: Section[]) => {
      nodes.forEach(n => {
        allNodes.push(n);
        traverse(n.children);
      });
    };
    traverse(sections);

    const byLevel: Record<number, Section[]> = {};
    let maxLevel = 0;
    allNodes.forEach(n => {
      if (!byLevel[n.level]) byLevel[n.level] = [];
      byLevel[n.level].push(n);
      maxLevel = Math.max(maxLevel, n.level);
    });

    const specCache: Record<string, SectionSpec> = {};
    const thinkingConfig = thinkingBudget > 0 ? { thinkingBudget } : undefined;

    const l1Nodes = byLevel[1] || [];
    if (l1Nodes.length > 0) {
      const batch1Prompt = [
        config.systemInstruction,
        '',
        'DOCUMENT PREVIEW (first 4000 chars):',
        markdown.slice(0, 4000),
        '...',
        '',
        config.l1TaskInstruction,
        '',
        'SECTIONS TO ANALYZE:',
        JSON.stringify(
          l1Nodes.map(n => ({
            id: n.id,
            title: n.title,
            level: n.level,
            contentPreview: n.content.slice(0, 800),
            childTitles: n.children.map(c => c.title),
            wordCount: n.wordCount,
          })),
          null, 2,
        ),
      ].join('\n');

      const res1 = await this.client.models.generateContent({
        model: modelId,
        contents: batch1Prompt,
        config: { responseMimeType: 'application/json', thinkingConfig },
      });

      const specs1 = this.parseSpecResponse(safeJsonParse(res1.text || '{}'));
      Object.assign(specCache, specs1);
      onBatchComplete(specs1);
    }

    for (let l = 2; l <= maxLevel; l += 2) {
      const nodes = [...(byLevel[l] || []), ...(byLevel[l + 1] || [])];
      if (nodes.length === 0) continue;

      const parentContext: Record<string, unknown> = {};
      nodes.forEach(n => {
        if (n.parentId && specCache[n.parentId]) {
          const ps = specCache[n.parentId];
          parentContext[n.parentId] = {
            function: ps.function,
            mainClaim: ps.mainClaim,
            requiredMoves: ps.requiredMoves.map(m => m.description),
            outgoingCommitments: ps.outgoingCommitments,
          };
        }
      });

      const batchPrompt = [
        config.systemInstruction,
        '',
        'PARENT SECTION SPECS (for context — subsections must be consistent with these):',
        JSON.stringify(parentContext, null, 2),
        '',
        config.subTaskInstruction,
        '',
        'SECTIONS TO ANALYZE:',
        JSON.stringify(
          nodes.map(n => ({
            id: n.id,
            level: n.level,
            title: n.title,
            parentId: n.parentId,
            contentPreview: n.content.slice(0, 600),
            childTitles: n.children.map(c => c.title),
            wordCount: n.wordCount,
          })),
          null, 2,
        ),
      ].join('\n');

      // Rate limit between batches.
      await new Promise(r => setTimeout(r, 2000));

      const res = await this.client.models.generateContent({
        model: modelId,
        contents: batchPrompt,
        config: { responseMimeType: 'application/json', thinkingConfig },
      });

      const specs = this.parseSpecResponse(safeJsonParse(res.text || '{}'));
      Object.assign(specCache, specs);
      onBatchComplete(specs);
    }
  }

  async runDiagnostic(input: RunDiagnosticInput): Promise<DiagnosticResult> {
    let contextContent = input.section.fullContent;
    if (input.scope === 'full') {
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
      content: contextContent.slice(0, 12000),
    });

    const thinkingConfig = input.thinkingBudget > 0
      ? { thinkingBudget: input.thinkingBudget }
      : undefined;

    const response = await this.client.models.generateContent({
      model: input.modelId,
      contents: prompt,
      config: { responseMimeType: 'application/json', thinkingConfig },
    });

    const json = safeJsonParse(response.text || '{}');

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
      nextPriority: json.nextPriority || 'Review the diagnostic results and address the first missing move.',
    };
  }

  async estimateDependencies(
    input: EstimateDependenciesInput,
  ): Promise<Record<string, Dependency[]>> {
    const flatSections: Section[] = [];
    const traverse = (nodes: Section[]) => {
      nodes.forEach(n => {
        flatSections.push(n);
        traverse(n.children);
      });
    };
    traverse(input.sections);

    const sectionsWithSpecs = flatSections.filter(s => {
      const spec = input.testSuite[s.id]?.spec;
      return spec && (spec.incomingContext.length > 0 || spec.outgoingCommitments.length > 0);
    });

    if (sectionsWithSpecs.length < 2) return {};

    const contextData = sectionsWithSpecs.map(s => ({
      id: s.id,
      title: s.title,
      incomingContext: input.testSuite[s.id].spec?.incomingContext || [],
      outgoingCommitments: input.testSuite[s.id].spec?.outgoingCommitments || [],
    }));

    const prompt = `
${input.config.dependenciesPrompt}

SECTIONS DATA:
${JSON.stringify(contextData, null, 2)}
  `;

    const thinkingConfig = input.thinkingBudget > 0
      ? { thinkingBudget: input.thinkingBudget }
      : undefined;

    const res = await this.client.models.generateContent({
      model: input.modelId,
      contents: prompt,
      config: { responseMimeType: 'application/json', thinkingConfig },
    });

    const json = safeJsonParse(res.text || '{}');
    const result: Record<string, Dependency[]> = {};
    for (const key in json) {
      if (Array.isArray(json[key])) {
        result[key] = json[key]
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
    const structureData = input.sections.map(sec => {
      const tests = input.testSuite[sec.id];
      return {
        title: sec.title,
        level: sec.level,
        wordCount: sec.wordCount,
        goals: tests?.goals,
        status: tests?.status,
        missingMoves: tests?.lastDiagnostic?.moveResults?.filter(
          m => m.status === 'missing' || m.status === 'unclear',
        ) || [],
      };
    });

    const prompt = `
${input.config.coachPrompt}

Document Size: ${input.markdown.length} characters
Total Sections: ${input.sections.length}

CURRENT STRUCTURE OVERVIEW (Focus on where things are 'stale', 'fail', or 'draft', and where moves are missing):
${JSON.stringify(structureData, null, 2)}
`;

    const response = await this.client.models.generateContent({
      model: input.modelId,
      contents: prompt,
    });
    return response.text || '';
  }

  async getContentSuggestions(input: ContentSuggestionsInput): Promise<string> {
    const prompt = `
${input.config.suggestContentPrompt}

CONTEXT:
Section Title: "${input.sectionTitle}"
Parent Section Goals: "${input.parentGoals || 'N/A'}"
Section Goals: "${input.currentGoals}"
Current Content:
---
${input.fullSectionContent.slice(0, 5000)}
---
      `;

    const response = await this.client.models.generateContent({
      model: input.modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || '';
  }

  async generatePersonas(input: GeneratePersonasInput): Promise<PersonaSuggestion[]> {
    const contextSample = input.documentContext.slice(0, 5000);
    const prompt = `
${input.config.generatePersonasPrompt}

TEXT SAMPLE:
---
${contextSample}
---
`;

    const response = await this.client.models.generateContent({
      model: input.modelId || PERSONAS_DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const json = safeJsonParse(response.text || '{}');
    if (!json.personas || !Array.isArray(json.personas)) return [];
    return json.personas
      .filter((p: any) => p && p.name && p.instruction)
      .map((p: any) => ({
        name: String(p.name),
        role: String(p.role || 'Custom Role'),
        instruction: String(p.instruction),
      }));
  }

  async refineSpec(input: RefineSpecInput): Promise<string> {
    const prompt = `
${input.config.refineSpecPrompt}

CONTEXT:
Section Title: "${input.sectionTitle}"
Parent Section Goals: "${input.parentGoals || 'N/A'}"
Current Goals: "${input.currentGoals}"
Section Content: "${input.fullSectionContent.slice(0, 3000)}..."

USER INSTRUCTION: "${input.instruction.trim() || 'Improve and refine the goals for clarity, conciseness, and completeness.'}"
      `;

    const response = await this.client.models.generateContent({
      model: input.modelId || REFINE_SPEC_DEFAULT_MODEL,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: input.thinkingBudget ?? REFINE_SPEC_DEFAULT_THINKING },
      },
    });

    return (response.text || '').trim();
  }

  private parseSpecResponse(raw: Record<string, any>): Record<string, SectionSpec> {
    const specs: Record<string, SectionSpec> = {};
    for (const [id, data] of Object.entries(raw)) {
      if (id === 'root') continue;

      if (typeof data === 'string') {
        specs[id] = {
          function: 'argue',
          mainClaim: data,
          requiredMoves: [{ id: 'move-0', description: data }],
          incomingContext: [],
          outgoingCommitments: [],
        };
        continue;
      }

      const fn = VALID_FUNCTIONS.includes(data.function) ? data.function : 'argue';
      const rawMoves = data.requiredMoves || data.required_moves || [];
      const moves: RequiredMove[] = rawMoves.map((m: any, i: number) => {
        if (typeof m === 'string') {
          return { id: `move-${i}`, description: m };
        }
        return {
          id: m.id || `move-${i}`,
          description: m.description || m.text || String(m),
          after: m.after,
        };
      });

      specs[id] = {
        function: fn,
        mainClaim: data.mainClaim || data.main_claim || '',
        requiredMoves: moves,
        incomingContext: data.incomingContext || data.incoming_context || [],
        outgoingCommitments: data.outgoingCommitments || data.outgoing_commitments || [],
      };
    }
    return specs;
  }
}
