import type { RevisionType } from '../../types';

/**
 * Per-revision-type chip classes. Literal Tailwind strings so the JIT picks them
 * up. Colors mirror the Glass Box engine's `revisionTypeColors`: Addition→green,
 * Replacement→cyan, Deletion→magenta, Rewording→purple, Citation→feat-confidence,
 * Tone Adjustment→feat-tone, Flow Improvement→magenta, Assembly→yellow. (The warm
 * near-duplicates `pink`/`assembly` were retired into magenta/yellow, and the two
 * feature accents `gold`/`indigo` were namespaced as feat-confidence/feat-tone.)
 */
export const revisionTypeChipClass: Record<RevisionType, string> = {
  Addition: 'text-hld-green border-hld-green/60 bg-hld-green/10',
  Replacement: 'text-hld-cyan border-hld-cyan/60 bg-hld-cyan/10',
  Deletion: 'text-hld-magenta border-hld-magenta/60 bg-hld-magenta/10',
  Rewording: 'text-hld-purple border-hld-purple/60 bg-hld-purple/10',
  Citation: 'text-hld-feat-confidence border-hld-feat-confidence/60 bg-hld-feat-confidence/10',
  'Tone Adjustment': 'text-hld-feat-tone border-hld-feat-tone/60 bg-hld-feat-tone/10',
  'Flow Improvement': 'text-hld-magenta border-hld-magenta/60 bg-hld-magenta/10',
  Assembly: 'text-hld-yellow border-hld-yellow/60 bg-hld-yellow/10',
};
