// The deterministic "gaps" dialogue focus — the structure's own account of what a
// section is missing, which is precisely what gap-blindness cannot generate. Pure
// composition over canonical records (no AI call, no network): the strain register's
// signals (deterministic mesh breaks first, AI corroboration after), the last
// diagnostic's missing/partial/unclear moves, and its gap→vector next action.
// A dialogue seeded from this focus carries the section prose to the model
// (`isGapFocus` is the marker the send path keys on).

import type { Section, TestSuite } from '../types';
import { buildSpecMap, computeStrain } from './strain-metrics';
import type { StrainSignal } from './strain-metrics';

export const GAP_FOCUS_MARKER = 'STRUCTURAL GAPS';

/** Whether a persisted dialogue focus came from `buildGapFocus`. */
export const isGapFocus = (context: string | null | undefined): boolean =>
  !!context?.startsWith(GAP_FOCUS_MARKER);

const relation = (sig: StrainSignal): string => {
  if (!sig.relatedTitle) return '';
  if (sig.direction === 'upstream') return ` (← ${sig.relatedTitle})`;
  if (sig.direction === 'downstream') return ` (→ ${sig.relatedTitle})`;
  return ` (${sig.relatedTitle})`;
};

/**
 * Compose the gaps focus for one section, or null when the structure reports
 * nothing absent (the affordance simply doesn't render — silence over noise).
 */
export function buildGapFocus(
  sectionId: string,
  sections: Section[],
  testSuite: TestSuite,
): string | null {
  const byId = new Map<string, Section>();
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      byId.set(n.id, n);
      walk(n.children);
    });
  walk(sections);
  const section = byId.get(sectionId);
  if (!section) return null;

  const lines: string[] = [];

  const strain = computeStrain(sectionId, sections, byId, buildSpecMap(testSuite), testSuite);
  for (const sig of strain.signals) {
    lines.push(`- ${sig.kind}: ${sig.detail}${relation(sig)}`);
  }

  const diagnostic = testSuite[sectionId]?.lastDiagnostic;
  for (const m of diagnostic?.moveResults ?? []) {
    if (m.status === 'missing' || m.status === 'partial' || m.status === 'unclear') {
      lines.push(`- move ${m.status}: "${m.moveDescription}"${m.diagnosis ? ` — ${m.diagnosis}` : ''}`);
    }
  }

  const next = diagnostic?.nextAction;
  if (next) {
    lines.push(`- next: ${next.gap}${next.location ? ` (at ${next.location})` : ''} → ${next.vector}`);
  }

  if (lines.length === 0) return null;
  return `${GAP_FOCUS_MARKER} — what "${section.title}" is missing, by the structure's own account:\n${lines.join('\n')}`;
}
