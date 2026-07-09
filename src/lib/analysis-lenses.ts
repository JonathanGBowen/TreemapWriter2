import type { AnalysisLens } from '../types';

/**
 * Built-in analytical lenses — ported verbatim from ScribesGambit's
 * DEFAULT_SPELLS. Each lens is a persona (the voice, sent as the model's
 * system instruction) plus instructions (the interpretive frame, sent as
 * content). All lenses produce the same SectionAnalysis shape; they differ
 * only in how they read the text. Classical Logic is the default.
 *
 * These are constants, not user-editable config, to keep the promptsConfig
 * schema (and its Rust mirror) unchanged. The shared JSON/format contract
 * that every lens shares IS user-editable — it lives in
 * `promptsConfig.analysisPrompt` (services/prompts/analysis.md).
 */
export const DEFAULT_ANALYSIS_LENSES: AnalysisLens[] = [
  {
    id: 'lens-classical-logic',
    name: 'Classical Logic',
    persona: 'A strict logician trained in classical syllogisms and propositional calculus.',
    instructions: `Analyze the following text for its logical structure.

1. Central Thesis: The main conclusion.
2. Key Concepts: Define key terms as they are used.
3. Primary Argument Reconstruction: Reconstruct the main argument in valid logical form (e.g., Modus Ponens, Modus Tollens). Identify premises and conclusion.
4. Supporting Arguments/Evidence: List any sub-arguments.
5. Potential Objections: Identify any logical fallacies (e.g., ad hominem, straw man, false dilemma).`,
  },
  {
    id: 'lens-deconstruction',
    name: 'Deconstructionist Lens',
    persona: 'A post-structuralist philosopher looking for binary oppositions and power dynamics.',
    instructions: `Deconstruct the following text.

1. Central Thesis: What is the apparent central claim?
2. Key Concepts: Identify the central binary oppositions (e.g., presence/absence, nature/culture).
3. Primary Argument Reconstruction: How does the text privilege one side of an opposition? What is suppressed or marginalized?
4. Supporting Arguments/Evidence: Find examples of hierarchical language.
5. Potential Objections: Where does the text contradict its own logic or reveal its constructed nature?`,
  },
  {
    id: 'lens-rhetoric',
    name: 'Rhetorical Crucible',
    persona: 'A master rhetorician analyzing ethos, pathos, logos, and persuasive techniques.',
    instructions: `Analyze the text's rhetorical strategies.

1. Central Thesis: The core persuasive claim.
2. Key Concepts: Identify the rhetorical appeals (ethos, pathos, logos) and key rhetorical devices.
3. Primary Argument Reconstruction: How is the argument structured to persuade the audience? What is the overarching persuasive strategy?
4. Supporting Arguments/Evidence: List specific textual examples of the rhetorical devices used to support the claim.
5. Potential Objections: How might the audience resist this persuasion? What are the weaknesses in the rhetorical delivery?`,
  },
  {
    id: 'lens-historical-materialist',
    name: 'Historical Materialist',
    persona: 'A historian examining text as a product of its time, social structures, and economic conditions.',
    instructions: `Analyze the text within its historical context.

1. Central Thesis: The historical reality or social commentary the text reflects.
2. Key Concepts: Define terms, institutions, or historical events relevant to the era.
3. Primary Argument Reconstruction: How does the text reinforce or challenge the prevailing ideologies of its time?
4. Supporting Arguments/Evidence: Cite examples that ground the text in its specific material and historical reality.
5. Potential Objections: What historical perspectives are ignored or silenced by the author?`,
  },
  {
    id: 'lens-mythopoeic',
    name: 'Mythopoeic Synthesis',
    persona: 'A literary critic hunting for underlying themes, motifs, symbolism, and narrative structures.',
    instructions: `Analyze the text for overarching themes and literary devices.

1. Central Thesis: The primary message or moral of the narrative.
2. Key Concepts: Identify key symbols, motifs, and archetypes.
3. Primary Argument Reconstruction: How do the narrative structure and character arcs develop the central theme?
4. Supporting Arguments/Evidence: Highlight specific passages that demonstrate thematic resonance or symbolic depth.
5. Potential Objections: Are there contrasting interpretations of these symbols? Where does the text subvert expected tropes?`,
  },
];

/** The lens applied when the user hasn't picked one — ScribesGambit's spells[0]. */
export const DEFAULT_LENS_ID = 'lens-classical-logic';

/**
 * Resolve a lens by id, falling back to the default. Always returns a lens,
 * so callers (including refactors of pre-lens versions) never have to
 * branch on undefined.
 */
export const findLens = (id?: string): AnalysisLens =>
  DEFAULT_ANALYSIS_LENSES.find((l) => l.id === id) ??
  DEFAULT_ANALYSIS_LENSES.find((l) => l.id === DEFAULT_LENS_ID) ??
  DEFAULT_ANALYSIS_LENSES[0];
