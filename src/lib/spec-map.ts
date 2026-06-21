// Section-id → spec projection, used wherever a part must be read inside its
// whole. `buildStructuralSurround` (diagnostic-helpers) and the editor's
// SurroundRail both need the same `{ [sectionId]: SectionSpec, root?: ... }`
// shape; this is the one place that derives it from the testSuite so the
// pattern is not re-spelled at each call site.

import type { SectionSpec, TestSuite } from '../types';

/**
 * Project the testSuite to a sparse section-id → spec map. The synthetic
 * `'root'` entry (the document-level spec) is carried through when present, so
 * the structural surround can name the whole a part ultimately serves.
 */
export function selectSpecMap(
  testSuite: TestSuite,
): Record<string, SectionSpec | undefined> {
  return Object.fromEntries(
    Object.entries(testSuite).map(([id, entry]) => [id, entry?.spec]),
  );
}
