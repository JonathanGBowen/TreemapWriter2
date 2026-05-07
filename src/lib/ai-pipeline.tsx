/**
 * ai-pipeline.ts
 * 
 * Extracted AI logic for spec generation and diagnostic evaluation.
 * Replaces the inline handleInterpolateTasks and handleRunTests logic in App.tsx.
 */
import { GoogleGenAI } from "@google/genai";
import { 
  Section, SectionSpec, SectionFunction, RequiredMove,
  DiagnosticResult, MoveResult, TestSuiteEntry, TestSuite, Persona,
  PromptsConfig, Dependency
} from "../types";
import { buildDiagnosticPrompt } from "./constants";
import { safeJsonParse } from "./utils";
 
// ============================================================
// SPEC GENERATION (replaces handleInterpolateTasks)
// ============================================================
 
interface SpecGenerationCallbacks {
  onBatchComplete: (results: Record<string, SectionSpec>) => void;
  onError: (error: Error) => void;
}
 
/**
 * Parse the AI response for a batch of sections into SectionSpec objects.
 * Handles both the new structured format and graceful degradation.
 */
function parseSpecResponse(raw: Record<string, any>): Record<string, SectionSpec> {
  const specs: Record<string, SectionSpec> = {};
 
  for (const [id, data] of Object.entries(raw)) {
    if (id === 'root') continue; // Root is metadata, not a section spec
    
    // Handle legacy format (just a string goal)
    if (typeof data === 'string') {
      specs[id] = {
        function: 'argue' as SectionFunction,
        mainClaim: data,
        requiredMoves: [{ id: 'move-0', description: data }],
        incomingContext: [],
        outgoingCommitments: [],
      };
      continue;
    }
 
    // Validate and normalize the function field
    const validFunctions: SectionFunction[] = [
      'introduce', 'explicate', 'argue', 'compare', 'critique',
      'synthesize', 'apply', 'evaluate', 'narrate', 'transition'
    ];
    const fn = validFunctions.includes(data.function) ? data.function : 'argue';
 
    // Normalize requiredMoves — AI might return strings or objects
    const rawMoves = data.requiredMoves || data.required_moves || [];
    const moves: RequiredMove[] = rawMoves.map((m: any, i: number) => {
      if (typeof m === 'string') {
        return { id: `move-${i}`, description: m };
      }
      return { 
        id: m.id || `move-${i}`, 
        description: m.description || m.text || String(m),
        after: m.after 
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
 
/**
 * Generate structured specs for all sections in the document.
 * Processes in batches by heading level, top-down.
 */
export async function generateStructuredSpecs(
  sections: Section[],
  markdown: string,
  config: PromptsConfig,
  modelId: string,
  thinkingBudget: number,
  callbacks: SpecGenerationCallbacks
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
 
  // Flatten all sections
  const allNodes: Section[] = [];
  const traverse = (nodes: Section[]) => {
    nodes.forEach(n => {
      allNodes.push(n);
      traverse(n.children);
    });
  };
  traverse(sections);
 
  // Group by level
  const byLevel: Record<number, Section[]> = {};
  let maxLevel = 0;
  allNodes.forEach(n => {
    if (!byLevel[n.level]) byLevel[n.level] = [];
    byLevel[n.level].push(n);
    maxLevel = Math.max(maxLevel, n.level);
  });
 
  // Cache for parent specs (used in sub-level prompts)
  const specCache: Record<string, SectionSpec> = {};
 
  const thinkingConfig = thinkingBudget > 0 ? { thinkingBudget } : undefined;
 
  // --- BATCH 1: Level 1 (top-level sections) ---
  const l1Nodes = byLevel[1] || [];
  if (l1Nodes.length > 0) {
    const batch1Prompt = [
      config.systemInstruction,
      "",
      "DOCUMENT PREVIEW (first 4000 chars):",
      markdown.slice(0, 4000),
      "...",
      "",
      config.l1TaskInstruction,
      "",
      "SECTIONS TO ANALYZE:",
      JSON.stringify(
        l1Nodes.map(n => ({
          id: n.id,
          title: n.title,
          level: n.level,
          contentPreview: n.content.slice(0, 800),
          childTitles: n.children.map(c => c.title),
          wordCount: n.wordCount
        })),
        null, 2
      )
    ].join("\n");
 
    const res1 = await ai.models.generateContent({
      model: modelId,
      contents: batch1Prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig
      }
    });
 
    const json1 = safeJsonParse(res1.text || '{}');
    const specs1 = parseSpecResponse(json1);
    Object.assign(specCache, specs1);
    callbacks.onBatchComplete(specs1);
  }
 
  // --- SUBSEQUENT BATCHES: Levels 2+, two levels per batch ---
  for (let l = 2; l <= maxLevel; l += 2) {
    const nodes = [...(byLevel[l] || []), ...(byLevel[l + 1] || [])];
    if (nodes.length === 0) continue;
 
    // Build parent context from cache
    const parentContext: Record<string, any> = {};
    nodes.forEach(n => {
      if (n.parentId && specCache[n.parentId]) {
        const ps = specCache[n.parentId];
        parentContext[n.parentId] = {
          function: ps.function,
          mainClaim: ps.mainClaim,
          requiredMoves: ps.requiredMoves.map(m => m.description),
          outgoingCommitments: ps.outgoingCommitments
        };
      }
    });
 
    const batchPrompt = [
      config.systemInstruction,
      "",
      "PARENT SECTION SPECS (for context — subsections must be consistent with these):",
      JSON.stringify(parentContext, null, 2),
      "",
      config.subTaskInstruction,
      "",
      "SECTIONS TO ANALYZE:",
      JSON.stringify(
        nodes.map(n => ({
          id: n.id,
          level: n.level,
          title: n.title,
          parentId: n.parentId,
          contentPreview: n.content.slice(0, 600),
          childTitles: n.children.map(c => c.title),
          wordCount: n.wordCount
        })),
        null, 2
      )
    ].join("\n");
 
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
 
    const res = await ai.models.generateContent({
      model: modelId,
      contents: batchPrompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig
      }
    });
 
    const json = safeJsonParse(res.text || '{}');
    const specs = parseSpecResponse(json);
    Object.assign(specCache, specs);
    callbacks.onBatchComplete(specs);
  }
}
 
// ============================================================
// DIAGNOSTIC EVALUATION (replaces handleRunTests)
// ============================================================
 
/**
 * Run a structured diagnostic evaluation of a section against its spec.
 */
export async function runDiagnosticEvaluation(params: {
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
}): Promise<DiagnosticResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
 
  // Determine content based on scope
  let contextContent = params.section.fullContent;
  if (params.scope === 'full') {
    contextContent = params.fullDocument;
  } else if (params.scope === 'parent' && params.section.parentId) {
    const parent = params.findSection(params.sections, params.section.parentId);
    if (parent) contextContent = parent.fullContent;
  }
 
  // Build the prompt using the structured spec
  const prompt = buildDiagnosticPrompt({
    baseInstruction: params.config.diagnosticInstruction,
    personaInstruction: params.persona.instruction,
    customInstruction: params.customInstruction,
    sectionTitle: params.section.title,
    sectionFunction: params.spec.function,
    mainClaim: params.spec.mainClaim,
    requiredMoves: params.spec.requiredMoves,
    incomingContext: params.spec.incomingContext,
    outgoingCommitments: params.spec.outgoingCommitments,
    scope: params.scope,
    content: contextContent.slice(0, 12000), // Slightly more generous limit
  });
 
  const thinkingConfig = params.thinkingBudget > 0 
    ? { thinkingBudget: params.thinkingBudget } 
    : undefined;
 
  const response = await ai.models.generateContent({
    model: params.modelId,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      thinkingConfig
    }
  });
 
  const json = safeJsonParse(response.text || '{}');
 
  // Normalize the response
  const moveResults: MoveResult[] = (json.moveResults || []).map((mr: any, i: number) => ({
    moveId: mr.moveId || `move-${i}`,
    moveDescription: mr.moveDescription || params.spec.requiredMoves[i]?.description || '',
    status: ['present', 'partial', 'missing', 'unclear'].includes(mr.status) 
      ? mr.status 
      : 'unclear',
    location: mr.location || undefined,
    diagnosis: mr.diagnosis || undefined,
    suggestedAction: mr.suggestedAction || undefined,
  }));
 
  const validReadiness = ['draft', 'developing', 'nearly-there', 'solid'];
  
  return {
    moveResults,
    coherenceNotes: json.coherenceNotes || [],
    overallReadiness: validReadiness.includes(json.overallReadiness) 
      ? json.overallReadiness 
      : 'draft',
    nextPriority: json.nextPriority || 'Review the diagnostic results and address the first missing move.',
  };
}
 
/**
 * Derive an overall status from a DiagnosticResult for the treemap coloring.
 */
export function diagnosticToStatus(diag: DiagnosticResult): 'success' | 'fail' | 'stale' {
  const counts = { present: 0, partial: 0, missing: 0, unclear: 0 };
  diag.moveResults.forEach(mr => { counts[mr.status]++; });
  
  if (counts.missing === 0 && counts.unclear === 0 && counts.partial === 0) return 'success';
  if (counts.present === 0 && diag.moveResults.length > 0) return 'fail';
  return 'stale'; // Mixed — some work done, more needed
}
 
/**
 * Build a fallback spec from a legacy goals string, for backward compatibility.
 */
export function specFromLegacyGoals(goals: string, mainClaim?: string): SectionSpec {
  return {
    function: 'argue',
    mainClaim: mainClaim || '',
    requiredMoves: goals 
      ? [{ id: 'move-0', description: goals }]
      : [],
    incomingContext: [],
    outgoingCommitments: [],
  };
}

/**
 * Estimates intra-document dependencies based on contexts and commitments.
 */
export async function generateDependenciesEstimation(
  sections: Section[],
  testSuite: TestSuite,
  modelId: string,
  thinkingBudget: number,
  config: PromptsConfig
): Promise<Record<string, Dependency[]>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });

  // Flatten sections
  const flatSections: Section[] = [];
  const traverse = (nodes: Section[]) => {
    nodes.forEach(n => {
      flatSections.push(n);
      traverse(n.children);
    });
  };
  traverse(sections);

  const sectionsWithSpecs = flatSections.filter(s => {
    const spec = testSuite[s.id]?.spec;
    return spec && (spec.incomingContext.length > 0 || spec.outgoingCommitments.length > 0);
  });

  if (sectionsWithSpecs.length < 2) return {};

  const contextData = sectionsWithSpecs.map(s => ({
     id: s.id,
     title: s.title,
     incomingContext: testSuite[s.id].spec?.incomingContext || [],
     outgoingCommitments: testSuite[s.id].spec?.outgoingCommitments || [],
  }));

  const prompt = `
${config.dependenciesPrompt}

SECTIONS DATA:
${JSON.stringify(contextData, null, 2)}
  `;

  const thinkingConfig = thinkingBudget > 0 ? { thinkingBudget } : undefined;

  const res = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig
      }
  });

  const json = safeJsonParse(res.text || '{}');
  const result: Record<string, Dependency[]> = {};
  
  for (const key in json) {
    if (Array.isArray(json[key])) {
      result[key] = json[key]
        .map((d: any) => ({
          id: d.id,
          type: d.type === 'reference' ? ('reference' as const) : ('prerequisite' as const)
        }))
        .filter((d: Dependency) => d.id);
    }
  }
  return result;
}