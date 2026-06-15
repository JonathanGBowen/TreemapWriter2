// Living Sprints — context reinstatement (Direction D). The single hardest thing
// for this writer is reinstating context; the app does it *for* them as the
// opening move of every sprint. v1 uses in-memory sources only (free, no new
// infrastructure): the goal, the last sentence, and the section's incoming
// context. Git-snapshot / FTS-search fragments are a deliberate later seam (see
// docs/phase-5.md — `search()` is not yet shipped) — `extraFragments` lets a
// future async provider feed richer material in without changing callers.

import type { Section, TestSuiteEntry } from '../types';
import { lastSentenceOf } from './sprintPlan';

export interface ReinstateFragment {
  /** Where it came from, e.g. "incoming context". */
  source: string;
  text: string;
}

export interface Reinstatement {
  /** The claim this section must earn (spec.mainClaim → mainClaim → goals). */
  goal: string;
  /** The verbatim last sentence of the section body (may be empty). */
  lastSentence: string;
  /** Prior material worth reattaching, capped for a glance (not a reading task). */
  fragments: ReinstateFragment[];
}

const DEFAULT_FRAGMENT_CAP = 3;

export function buildReinstatement(
  section: Section | null,
  entry: TestSuiteEntry | undefined,
  opts: { cap?: number; extraFragments?: ReinstateFragment[] } = {},
): Reinstatement {
  const cap = opts.cap ?? DEFAULT_FRAGMENT_CAP;
  const goal = (entry?.spec?.mainClaim || entry?.mainClaim || entry?.goals || '').trim();
  const lastSentence = section ? lastSentenceOf(section.content) : '';

  const fragments: ReinstateFragment[] = [];
  const seen = new Set<string>();
  const push = (source: string, text: string) => {
    const t = (text || '').trim();
    if (!t || seen.has(t) || fragments.length >= cap) return;
    seen.add(t);
    fragments.push({ source, text: t });
  };

  // Cheapest source first: concepts/claims this section receives from earlier on.
  for (const c of entry?.spec?.incomingContext ?? []) push('incoming context', c);
  // Then any externally-supplied fragments (git/FTS, when those land).
  for (const f of opts.extraFragments ?? []) push(f.source, f.text);

  return { goal, lastSentence, fragments: fragments.slice(0, cap) };
}
