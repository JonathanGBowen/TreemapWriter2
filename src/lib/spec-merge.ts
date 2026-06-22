// Merge generated/accepted specs into the testSuite.
//
// Spec generation produces `SectionSpec`s keyed by section id (with `'root'` for
// the document level); landing them in the `testSuite` is the same shape whether
// it comes from the legacy one-shot batch or the Generate-Specs workspace's
// per-level Accept. This is the one place that mapping lives, so the two callers
// can't drift. Each merged entry is marked `stale` (its prose should be re-checked
// against the new spec) and records an `ai-generate` history item, preserving the
// prior goals so the change is auditable.

import type { SectionSpec, TestSuite } from '../types';

/**
 * Return a new testSuite with `specs` merged in. `modelLabel` annotates the
 * history item (e.g. the model id, or "collaborative (claude-opus-4-8)"). Pure —
 * the caller passes the result to `setTestSuite`.
 */
export function mergeSpecsIntoTestSuite(
  prev: TestSuite,
  specs: Record<string, SectionSpec>,
  modelLabel: string,
): TestSuite {
  const next: TestSuite = { ...prev };
  Object.entries(specs).forEach(([id, spec]) => {
    const existing = next[id] || { goals: '', status: 'idle' as const, history: [] };
    next[id] = {
      ...existing,
      spec,
      mainClaim: spec.mainClaim,
      goals: spec.requiredMoves.map((m) => m.description).join('\n'),
      status: 'stale',
      history: [
        ...(existing.history || []),
        {
          timestamp: Date.now(),
          goals: existing.goals,
          instruction: `Structured spec (${modelLabel})`,
          type: 'ai-generate' as const,
        },
      ],
    };
  });
  return next;
}
