export {
  DEFAULT_PROMPTS_CONFIG,
  normalizePromptsConfig,
  resolvePromptsConfig,
  diffPromptsConfig,
} from "../services/prompts";

export const SECTION_FUNCTIONS = [
  { id: 'introduce', label: 'Introduce', desc: 'Sets up problem space, motivates what follows' },
  { id: 'explicate', label: 'Explicate', desc: 'Unpacks a concept, theory, or framework' },
  { id: 'argue', label: 'Argue', desc: 'Advances a claim with supporting reasons' },
  { id: 'compare', label: 'Compare', desc: 'Puts positions in productive tension' },
  { id: 'critique', label: 'Critique', desc: 'Identifies problems with a position' },
  { id: 'synthesize', label: 'Synthesize', desc: 'Integrates multiple strands' },
  { id: 'apply', label: 'Apply', desc: 'Uses a framework to analyze a case' },
  { id: 'evaluate', label: 'Evaluate', desc: 'Assesses adequacy against criteria' },
  { id: 'narrate', label: 'Narrate', desc: 'Traces a development' },
  { id: 'transition', label: 'Transition', desc: 'Bridges between major parts' },
] as const;

/**
 * Build the diagnostic evaluation prompt at runtime.
 * This replaces the old single-shot "evaluate against goals" approach
 * with a structured move-by-move diagnostic.
 */
export function buildDiagnosticPrompt(params: {
  baseInstruction: string;
  personaInstruction: string;
  customInstruction: string;
  sectionTitle: string;
  sectionFunction: string;
  mainClaim: string;
  requiredMoves: { id: string; description: string }[];
  incomingContext: string[];
  outgoingCommitments: string[];
  scope: string;
  content: string;
  /**
   * Optional part-in-whole context (parent/sibling claims and commitments),
   * pre-formatted by `formatStructuralSurround`. Present, it makes the model judge
   * the section as a part functioning in the whole rather than as an isolated piece.
   */
  structuralSurround?: string;
}): string {
  const movesList = params.requiredMoves
    .map((m, i) => `  ${i + 1}. [${m.id}] ${m.description}`)
    .join("\n");

  const incoming = params.incomingContext.length > 0
    ? params.incomingContext.map(c => `  - ${c}`).join("\n")
    : "  (none specified)";

  const outgoing = params.outgoingCommitments.length > 0
    ? params.outgoingCommitments.map(c => `  - ${c}`).join("\n")
    : "  (none specified)";

  return [
    params.baseInstruction,
    "",
    params.personaInstruction,
    "",
    params.customInstruction ? `ADDITIONAL INSTRUCTION: ${params.customInstruction}` : "",
    "",
    `SECTION: "${params.sectionTitle}"`,
    `FUNCTION: ${params.sectionFunction}`,
    `MAIN CLAIM: ${params.mainClaim}`,
    "",
    "REQUIRED MOVES (check each one):",
    movesList,
    "",
    "INCOMING CONTEXT (what prior sections should have established):",
    incoming,
    "",
    "OUTGOING COMMITMENTS (what this section must establish for later):",
    outgoing,
    "",
    params.structuralSurround || "",
    `CONTEXT SCOPE: ${params.scope}`,
    "",
    "TEXT TO EVALUATE:",
    "---",
    params.content,
    "---"
  ].filter(Boolean).join("\n");
}

