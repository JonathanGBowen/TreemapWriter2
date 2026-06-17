import type { AnalysisSpell } from '../types';

/**
 * Built-in comparison lenses for the Version Compare workspace. A lens layers a
 * `persona` + `lens` (analytical focus) onto the base comparison prompt, exactly
 * as the Grimoire analysis "spells" do — it does NOT restate the comparison
 * schema (direction / verdict / conceptualDrift / improvements / losses /
 * moveChanges / sectionNotes); the base prompt already carries it. Each lens
 * keeps only its distinctive evaluative move, phrased in that schema's own
 * vocabulary.
 *
 * Reusing `AnalysisSpell` is deliberate: the shapes are identical, so the lens
 * picker can offer these comparison lenses AND the user's Grimoire spells from
 * one list, with nothing extra to persist or maintain.
 *
 * The set is seeded from established editorial and argumentation frameworks:
 * developmental vs. line editing, the reverse-outline technique for detecting
 * argument drift, and Toulmin's claim/grounds/warrant analysis.
 */
export const DEFAULT_COMPARE_LENSES: AnalysisSpell[] = [
  {
    id: 'compare-developmental',
    name: 'Developmental Edit',
    persona: 'A developmental editor who judges a revision by the big picture — the soundness of the argument, the clarity of the structure, and the sufficiency of the evidence.',
    lens: 'Compare the two versions at the level of the whole argument. In improvements, name where B makes the central claim sounder, the structure clearer, or the evidence more sufficient than A. In losses, name where B has weakened the argument, blurred the structure, or left a claim less supported. Let conceptualDrift report any change in what the document is fundamentally arguing.',
  },
  {
    id: 'compare-line',
    name: 'Line Edit',
    persona: 'A line editor attending to language at the level of the sentence and paragraph — clarity, rhythm, economy, and the author\'s voice.',
    lens: 'Compare the two versions sentence by sentence rather than argument by argument. In improvements, cite specific passages B renders clearer, tighter, or truer to the author\'s voice. In losses, cite passages where B is now clumsier, vaguer, or flatter in voice than A. Keep moveChanges empty unless a sentence-level edit changed what a passage actually does.',
  },
  {
    id: 'compare-reverse-outline',
    name: 'Reverse-Outline Drift',
    persona: 'A close reader who reverse-outlines a draft — reconstructing the implicit outline a text actually follows, one claim per paragraph, to see its true shape.',
    lens: 'Reconstruct the implicit outline of each version, then lay them side by side. Treat the migration of the thesis or any section\'s throughline as the central finding and report it in conceptualDrift. In moveChanges, note where a paragraph\'s job changed, where the order of the argument shifted, or where a new idea appears late in B that the earlier material no longer sets up.',
  },
  {
    id: 'compare-toulmin',
    name: 'Toulmin Integrity',
    persona: 'An argumentation theorist who reads with Toulmin\'s scheme — claim, grounds, warrant, backing, qualifier, rebuttal.',
    lens: 'Track each version\'s claims and the warrants licensing them. In improvements, mark where B makes an implicit warrant explicit, adds backing, or properly qualifies a claim A overstated. In losses, mark where B drops a warrant, removes backing, or states a claim more strongly than its grounds now support. Use moveChanges for changes in which claims do the load-bearing work.',
  },
  {
    id: 'compare-citation',
    name: 'Citation & Evidence Integrity',
    persona: 'A scrupulous reader who checks that every claim keeps its evidence and every citation keeps its claim.',
    lens: 'Compare how the two versions handle evidence and attribution. In improvements, note citations or quotations B adds, strengthens, or integrates more honestly. In losses, flag orphaned claims (a claim kept while its supporting citation or quotation was cut), weakened attributions, or evidence quietly dropped between A and B. Ground every finding in a verbatim receipt from each side.',
  },
  {
    id: 'compare-concision-voice',
    name: 'Concision vs. Voice',
    persona: 'An editor weighing the gains of tightening prose against the cost to nuance and authorial voice.',
    lens: 'Read B as a tightening (or loosening) of A and weigh the trade. In improvements, cite where cutting sharpened the point. In losses, cite where concision cost a necessary qualification, a distinction, or the author\'s voice — and where added length added only padding. Let conceptualDrift note any case where trimming changed the actual claim, not just its expression.',
  },
];
