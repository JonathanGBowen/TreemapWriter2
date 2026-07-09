import type { RevisionType } from '../../types';

/**
 * Per-revision-type chip classes. Literal Tailwind strings so the JIT picks them
 * up. Colors mirror the Glass Box engine's `revisionTypeColors`: Addition→green,
 * Replacement→cyan, Deletion→magenta (palette 3C keeps magenta on diff removals —
 * removed/prior prose is still content), Rewording→feat-running,
 * Citation→feat-confidence, Tone Adjustment→feat-tone, Flow Improvement→magenta,
 * Assembly→yellow. (The warm near-duplicates `pink`/`assembly` were retired into
 * magenta/yellow; `gold`/`indigo`/`purple` were namespaced/demoted to the
 * feat-confidence/feat-tone/feat-running feature tier.)
 */
export const revisionTypeChipClass: Record<RevisionType, string> = {
  Addition: 'text-hld-green border-hld-green/60 bg-hld-green/10',
  Replacement: 'text-hld-cyan border-hld-cyan/60 bg-hld-cyan/10',
  Deletion: 'text-hld-magenta border-hld-magenta/60 bg-hld-magenta/10',
  Rewording: 'text-hld-feat-running border-hld-feat-running/60 bg-hld-feat-running/10',
  Citation: 'text-hld-feat-confidence border-hld-feat-confidence/60 bg-hld-feat-confidence/10',
  'Tone Adjustment': 'text-hld-feat-tone border-hld-feat-tone/60 bg-hld-feat-tone/10',
  'Flow Improvement': 'text-hld-magenta border-hld-magenta/60 bg-hld-magenta/10',
  Assembly: 'text-hld-yellow border-hld-yellow/60 bg-hld-yellow/10',
};
