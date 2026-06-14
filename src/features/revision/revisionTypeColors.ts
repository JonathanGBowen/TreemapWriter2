import type { RevisionType } from '../../types';

/**
 * Per-revision-type chip classes. Literal Tailwind strings so the JIT picks them
 * up. Colors mirror the Glass Box engine's `revisionTypeColors`: Addition→green,
 * Replacement→cyan, Deletion→magenta, Rewording→purple, Citation→gold, Tone
 * Adjustment→indigo, Flow Improvement→pink, Assembly→assembly-yellow.
 */
export const revisionTypeChipClass: Record<RevisionType, string> = {
  Addition: 'text-hld-green border-hld-green/60 bg-hld-green/10',
  Replacement: 'text-hld-cyan border-hld-cyan/60 bg-hld-cyan/10',
  Deletion: 'text-hld-magenta border-hld-magenta/60 bg-hld-magenta/10',
  Rewording: 'text-hld-purple border-hld-purple/60 bg-hld-purple/10',
  Citation: 'text-hld-gold border-hld-gold/60 bg-hld-gold/10',
  'Tone Adjustment': 'text-hld-indigo border-hld-indigo/60 bg-hld-indigo/10',
  'Flow Improvement': 'text-hld-pink border-hld-pink/60 bg-hld-pink/10',
  Assembly: 'text-hld-assembly border-hld-assembly/60 bg-hld-assembly/10',
};
