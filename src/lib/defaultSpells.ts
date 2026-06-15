import type { AnalysisSpell } from '../types';

/**
 * Built-in analytical lenses, adapted from Scribe's Gambit's default "spells".
 * The user can add custom ones (stored in `customSpells` on the AI slice, a
 * global library); the active spell is whichever id matches the concatenation
 * of these defaults plus customs.
 *
 * A spell layers `persona` + `lens` on top of the base analysis prompt — it does
 * NOT restate the five-section schema (the base prompt already carries it). Each
 * lens keeps only its distinctive analytical move, phrased in the schema's own
 * vocabulary (keyConcepts, argument, supportingArguments, potentialObjections).
 */
export const DEFAULT_SPELLS: AnalysisSpell[] = [
  {
    id: 'spell-classical-logic',
    name: 'Classical Logic',
    persona: 'A strict logician trained in classical syllogisms and propositional calculus.',
    lens: 'Reconstruct the primary argument in valid logical form (e.g. Modus Ponens, Modus Tollens), making the inference structure explicit in the premises and conclusion. Define key terms precisely as they are used. In potentialObjections, name any logical fallacies you detect (e.g. ad hominem, straw man, false dilemma, affirming the consequent).',
  },
  {
    id: 'spell-deconstructionist',
    name: 'Deconstructionist Lens',
    persona: 'A post-structuralist philosopher looking for binary oppositions and power dynamics.',
    lens: 'Treat the central binary oppositions the text relies on (e.g. presence/absence, nature/culture, speech/writing) as the keyConcepts. In the argument, expose which side of each opposition the text privileges and what it thereby suppresses or marginalizes. In potentialObjections, mark where the text contradicts its own logic or reveals its constructed, unstable nature.',
  },
  {
    id: 'spell-rhetorical-crucible',
    name: 'Rhetorical Crucible',
    persona: 'A master rhetorician analyzing ethos, pathos, logos, and persuasive techniques.',
    lens: 'Identify the rhetorical appeals (ethos, pathos, logos) and key rhetorical devices as the keyConcepts. Frame the argument as a persuasive strategy aimed at a particular audience. In supportingArguments, cite specific textual examples of the devices used. In potentialObjections, note how the audience might resist and where the rhetorical delivery is weakest.',
  },
  {
    id: 'spell-historical-materialist',
    name: 'Historical Materialist',
    persona: 'A historian examining text as a product of its time, social structures, and economic conditions.',
    lens: 'Situate the text in its material and historical context, treating relevant institutions, events, and period-specific terms as keyConcepts. In the argument, show how the text reinforces or challenges the prevailing ideologies and economic conditions of its time. In potentialObjections, name the historical perspectives the author ignores or silences.',
  },
  {
    id: 'spell-mythopoeic',
    name: 'Mythopoeic Synthesis',
    persona: 'A literary critic hunting for underlying themes, motifs, symbolism, and narrative structures.',
    lens: 'Read for theme, motif, symbol, and archetype, treating the most important as keyConcepts. In the argument, show how narrative structure and development carry the central theme. In potentialObjections, surface rival interpretations of the symbols or places where the text subverts an expected trope.',
  },
];
