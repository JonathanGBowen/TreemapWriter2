// Pure helpers for the spec-anchored A/B whole-test. No React, no store, no SDK —
// the orchestrator (lib/specTestRun.ts), the workspace, and the Compare fold all
// lean on these so they stay thin and testable. The design is Gestalt-faithful:
// alignment is by HEADING TITLE (reusing compareHelpers), the part-level scope is
// expanded by COMMITMENT-MESH NEIGHBOURS (a change can sever a join with a part
// that did not change), and the whole is judged from its ROLE SKELETON + the
// deterministic mesh delta — never a sum of section scores. See docs/gestalt-
// design.md §III/§VI and docs/gestalt-design-II.md L1–L4.

import { parseMarkdown } from './utils';
import { alignByTitle } from './compareHelpers';
import {
  buildStructuralSurround,
  formatStructuralSurround,
  checkCommitmentMesh,
  type MeshFinding,
} from './diagnostic-helpers';
import type {
  CommitmentFinding,
  ComparisonDirection,
  MeshDelta,
  Section,
  SectionSpec,
  SectionSpecTest,
  SpecTestReport,
  TestSuite,
} from '../types';

/** The diff-scoping mode for a run. 'changed' deep-reads only sections whose own
 *  prose changed PLUS their mesh neighbours; 'all' deep-reads every both-present
 *  section that has a rubric. (A chapter-subtree scope is a deferred refinement.) */
export type SpecTestScope = 'changed' | 'all';

/** One aligned section's plan: why it will (or won't) be deep-read, with the prose
 *  for each side. `scopeReason` mirrors the SectionSpecTest enum; 'changed' and
 *  'mesh-neighbour' are the deep-read kinds (one AI call), the rest are free. */
export interface SectionTestPlanItem {
  title: string;
  presentInA: boolean;
  presentInB: boolean;
  scopeReason: SectionSpecTest['scopeReason'];
  proseA: string;
  proseB: string;
}

/** The deep-read kinds — the items that cost one AI call. */
export const isDeepRead = (reason: SectionSpecTest['scopeReason']): boolean =>
  reason === 'changed' || reason === 'mesh-neighbour';

// --- held rubric (title → spec) --------------------------------------------

/**
 * Build the held rubric: title → SectionSpec, walking a section tree and reading
 * each node's spec from a TestSuite (keyed by id). The alignment key is the title
 * (cf. compareHelpers), so the rubric survives the title-derived id drift that a
 * rename/reorder causes. Sections with no spec are simply absent (a 'no-rubric'
 * section in the plan).
 */
export const buildSpecByTitle = (sections: Section[], testSuite: TestSuite): Map<string, SectionSpec> => {
  const map = new Map<string, SectionSpec>();
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      const spec = testSuite[n.id]?.spec;
      if (spec) map.set(n.title, spec);
      walk(n.children);
    });
  walk(sections);
  return map;
};

// --- prose extraction + change detection -----------------------------------

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * Map each section's OWN prose (heading + text before its first child) by title.
 * Own prose (not `fullContent`) keeps change-detection precise — editing a leaf
 * does not mark every ancestor changed — and keeps the parts disjoint, so the
 * suite never double-counts a passage. Duplicate titles collapse to the last
 * (the same title-key limit `alignByTitle` documents).
 */
export const extractSectionProse = (markdown: string): Map<string, string> => {
  const out = new Map<string, string>();
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      out.set(n.title, n.content);
      walk(n.children);
    });
  walk(parseMarkdown(markdown));
  return out;
};

// --- mesh-neighbour scope expansion ----------------------------------------

/**
 * The titles structurally adjacent to a changed section — its parent and its
 * immediately preceding/following siblings, the parts whose incoming/outgoing
 * commitments interlock with it (the same relations `buildStructuralSurround`
 * walks). A change can sever a join with one of these even when its own prose did
 * not change, so the suite pulls them in. The changed titles themselves are not
 * returned (they are already deep-read).
 */
export const meshNeighbourTitles = (changed: Set<string>, sections: Section[]): Set<string> => {
  const out = new Set<string>();
  const visit = (siblings: Section[], parentTitle: string | null) => {
    siblings.forEach((node, idx) => {
      if (changed.has(node.title)) {
        if (parentTitle) out.add(parentTitle);
        if (idx > 0) out.add(siblings[idx - 1].title);
        if (idx < siblings.length - 1) out.add(siblings[idx + 1].title);
      }
      visit(node.children, node.title);
    });
  };
  visit(sections, null);
  for (const t of changed) out.delete(t);
  return out;
};

/**
 * Plan the run: align A and B by title, classify each section, and — under the
 * 'changed' scope — expand the deep-read set by mesh neighbours. Under 'all', every
 * both-present section with a rubric is deep-read.
 */
export const planSpecTestRun = (
  markdownA: string,
  markdownB: string,
  specByTitle: Map<string, SectionSpec>,
  rubricSections: Section[],
  scope: SpecTestScope,
): SectionTestPlanItem[] => {
  const contentA = extractSectionProse(markdownA);
  const contentB = extractSectionProse(markdownB);
  const aligned = alignByTitle(markdownA, markdownB);

  // First pass: presence + own-prose change, ignoring scope.
  const base = aligned.map((t) => {
    const proseA = contentA.get(t.title) ?? '';
    const proseB = contentB.get(t.title) ?? '';
    const hasRubric = specByTitle.has(t.title);
    const changed = t.presentInA && t.presentInB && norm(proseA) !== norm(proseB);
    return { ...t, proseA, proseB, hasRubric, changed };
  });

  const changedTitles = new Set(base.filter((b) => b.hasRubric && b.changed).map((b) => b.title));
  const neighbours = scope === 'changed' ? meshNeighbourTitles(changedTitles, rubricSections) : new Set<string>();

  return base.map((b): SectionTestPlanItem => {
    let scopeReason: SectionSpecTest['scopeReason'];
    if (!b.hasRubric) scopeReason = 'no-rubric';
    else if (b.presentInA && !b.presentInB) scopeReason = 'a-only';
    else if (!b.presentInA && b.presentInB) scopeReason = 'b-only';
    else if (b.changed) scopeReason = 'changed';
    else if (scope === 'all') scopeReason = 'mesh-neighbour'; // deep-read though unchanged
    else if (neighbours.has(b.title)) scopeReason = 'mesh-neighbour';
    else scopeReason = 'unchanged';
    return {
      title: b.title,
      presentInA: b.presentInA,
      presentInB: b.presentInB,
      scopeReason,
      proseA: b.proseA,
      proseB: b.proseB,
    };
  });
};

// --- deterministic commitment-mesh delta -----------------------------------

/** title → SectionSpec map, applied over one version's tree by id (+ 'root'). The
 *  rubric is held fixed; re-keying per tree keeps `checkCommitmentMesh`'s ids
 *  consistent within each version despite title-derived ids drifting on reorder. */
const specsForTree = (
  sections: Section[],
  specByTitle: Map<string, SectionSpec>,
  rootSpec?: SectionSpec,
): Record<string, SectionSpec | undefined> => {
  const map: Record<string, SectionSpec | undefined> = {};
  if (rootSpec) map['root'] = rootSpec;
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      map[n.id] = specByTitle.get(n.title);
      walk(n.children);
    });
  walk(sections);
  return map;
};

const meshFindingsFor = (
  sections: Section[],
  specs: Record<string, SectionSpec | undefined>,
): CommitmentFinding[] => {
  const out: MeshFinding[] = [];
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      out.push(...checkCommitmentMesh(n.id, sections, specs));
      walk(n.children);
    });
  walk(sections);
  // MeshFinding → CommitmentFinding (drop the `direction` axis the report doesn't use).
  return out.map((f) => ({
    kind: f.kind,
    detail: f.detail,
    ...(f.relatedSectionTitle ? { relatedSectionTitle: f.relatedSectionTitle } : {}),
  }));
};

const findingKey = (f: CommitmentFinding): string => `${f.kind}|${f.detail}|${f.relatedSectionTitle ?? ''}`;

const dedupe = (findings: CommitmentFinding[]): CommitmentFinding[] => {
  const seen = new Set<string>();
  const out: CommitmentFinding[] = [];
  for (const f of findings) {
    const k = findingKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
};

/**
 * The deterministic structural-join delta across A→B. With the rubric held fixed,
 * this moves only when the section TREE changes (a section added/removed/reordered
 * so a commitment's neighbour shifts) — the trustworthy, false-alarm-averse spine
 * beneath the AI's prose-level reading. `introduced` is the tF signal.
 */
export const meshDeltaFor = (
  aSections: Section[],
  bSections: Section[],
  specByTitle: Map<string, SectionSpec>,
  rootSpec?: SectionSpec,
): MeshDelta => {
  const aFindings = dedupe(meshFindingsFor(aSections, specsForTree(aSections, specByTitle, rootSpec)));
  const bFindings = dedupe(meshFindingsFor(bSections, specsForTree(bSections, specByTitle, rootSpec)));
  const aKeys = new Set(aFindings.map(findingKey));
  const bKeys = new Set(bFindings.map(findingKey));
  return {
    introduced: bFindings.filter((f) => !aKeys.has(findingKey(f))),
    healed: aFindings.filter((f) => !bKeys.has(findingKey(f))),
    persisting: bFindings.filter((f) => aKeys.has(findingKey(f))),
  };
};

// --- role-skeleton + surround (the whole judged by its inner structure) -----

/**
 * The role-reconstruction of a version: every section's function, main claim, and
 * incoming/outgoing commitments (from the held rubric) — NOT prose. This is how the
 * whole call sees the whole: by its mesh, not its word-sum (bounded context, and
 * Gestalt-correct — the whole is its inner structure).
 */
export const buildSkeleton = (sections: Section[], specByTitle: Map<string, SectionSpec>): string => {
  const lines: string[] = [];
  const walk = (nodes: Section[], depth: number) =>
    nodes.forEach((n) => {
      const indent = '  '.repeat(depth);
      const spec = specByTitle.get(n.title);
      if (spec) {
        lines.push(`${indent}- ${n.title} [${spec.function}] — ${spec.mainClaim}`);
        if (spec.incomingContext.length) lines.push(`${indent}    needs: ${spec.incomingContext.join('; ')}`);
        if (spec.outgoingCommitments.length) lines.push(`${indent}    delivers: ${spec.outgoingCommitments.join('; ')}`);
      } else {
        lines.push(`${indent}- ${n.title} (no rubric)`);
      }
      walk(n.children, depth + 1);
    });
  walk(sections, 0);
  return lines.join('\n');
};

const findIdByTitle = (sections: Section[], title: string): string | null => {
  for (const n of sections) {
    if (n.title === title) return n.id;
    const found = findIdByTitle(n.children, title);
    if (found) return found;
  }
  return null;
};

/**
 * The mandatory part-in-whole surround for a section, built from the RUBRIC's tree
 * + specs (the intended whole the part serves). Falls back to a document-claim-only
 * surround when the title is not in the rubric tree.
 */
export const surroundForTitle = (
  title: string,
  rubricSections: Section[],
  rubricSpecsById: Record<string, SectionSpec | undefined>,
): string => {
  const id = findIdByTitle(rubricSections, title);
  if (id) return formatStructuralSurround(buildStructuralSurround(id, rubricSections, rubricSpecsById));
  const docClaim = rubricSpecsById['root']?.mainClaim?.trim();
  return docClaim ? formatStructuralSurround({ documentClaim: docClaim }) : '';
};

/** Build the rubric's id→spec map (with 'root') for surround construction. */
export const rubricSpecsById = (
  rubricSections: Section[],
  specByTitle: Map<string, SectionSpec>,
  rootSpec?: SectionSpec,
): Record<string, SectionSpec | undefined> => specsForTree(rubricSections, specByTitle, rootSpec);

// --- prompt-side formatting (whole call inputs) ----------------------------

/** The changed sections' prose, A vs B, for the whole call's changed-prose block. */
export const formatChangedProse = (items: SectionTestPlanItem[]): string =>
  items
    .map((it) =>
      [
        `### "${it.title}" — VERSION A ###`,
        it.proseA || '(empty in A)',
        `### "${it.title}" — VERSION B ###`,
        it.proseB || '(empty in B)',
        '',
      ].join('\n'),
    )
    .join('\n');

/** Format the deterministic mesh delta as hard evidence for the whole prompt. */
export const formatMeshDelta = (delta: MeshDelta): string => {
  const fmt = (f: CommitmentFinding): string =>
    `  - [${f.kind}] ${f.detail}${f.relatedSectionTitle ? ` (with "${f.relatedSectionTitle}")` : ''}`;
  const parts: string[] = [];
  if (delta.introduced.length) parts.push('INTRODUCED breaks (B severed these — tF evidence):', ...delta.introduced.map(fmt));
  if (delta.healed.length) parts.push('HEALED breaks (B repaired these):', ...delta.healed.map(fmt));
  return parts.join('\n');
};

// --- structural (no-AI) results + tally ------------------------------------

/** A no-AI result for a section that is not deep-read (unchanged / a-only / b-only
 *  / no-rubric). The real direction for these lives in the whole verdict; here we
 *  state the structural fact and stay neutral. */
export const structuralResult = (item: SectionTestPlanItem): SectionSpecTest => {
  const summary =
    item.scopeReason === 'a-only'
      ? 'Present in A, absent in B — section cut.'
      : item.scopeReason === 'b-only'
        ? 'Absent in A, present in B — section added.'
        : item.scopeReason === 'no-rubric'
          ? 'No spec rubric — not tested.'
          : 'Unchanged — prose identical in A and B.';
  return {
    sectionTitle: item.title,
    presentInA: item.presentInA,
    presentInB: item.presentInB,
    scopeReason: item.scopeReason,
    truth: 'lateral',
    direction: 'lateral',
    wholeSignature: { a: 'aligned', b: 'aligned' },
    summary,
    moveDeltas: [],
  };
};

/** A fallback result when a deep-read section's AI call returned null (unparseable). */
export const unparseableResult = (item: SectionTestPlanItem): SectionSpecTest => ({
  sectionTitle: item.title,
  presentInA: item.presentInA,
  presentInB: item.presentInB,
  scopeReason: item.scopeReason,
  truth: 'lateral',
  direction: 'lateral',
  wholeSignature: { a: 'partial', b: 'partial' },
  summary: 'Could not read the model’s response for this section — re-run to retry.',
  moveDeltas: [],
});

/**
 * The transparency tally — move-delta + tF/fT counts from the section results, and
 * the deep-read vs skeleton-only split. This is NEVER the verdict (a sum of green
 * parts is not a whole-truth); the WholeVerdict is. `deepRead` is the count of
 * sections that actually called the model (passed in, since a context-skip can
 * make a planned deep-read not run).
 */
export const summarizeTally = (sections: SectionSpecTest[], deepRead: number): SpecTestReport['tally'] => {
  let gained = 0;
  let regressed = 0;
  let deflated = 0;
  let tF = 0;
  let fT = 0;
  for (const s of sections) {
    if (s.truth === 'tF') tF++;
    if (s.truth === 'fT') fT++;
    for (const m of s.moveDeltas) {
      if (m.delta === 'gained' || m.delta === 'added') gained++;
      else if (m.delta === 'regressed' || m.delta === 'removed') regressed++;
      else if (m.delta === 'deflated') deflated++;
    }
  }
  return { gained, regressed, deflated, tF, fT, deepRead, skeletonOnly: sections.length - deepRead };
};

/** Roll the section directions up to a whole-document direction — the honest-net
 *  rule the compare prompt uses (mixed when both gains and losses; lateral when
 *  neither). Used only as the FALLBACK whole direction when the AI whole call fails. */
export const rollupDirection = (delta: MeshDelta): ComparisonDirection => {
  if (delta.introduced.length && delta.healed.length) return 'mixed';
  if (delta.introduced.length) return 'regressed';
  if (delta.healed.length) return 'improved';
  return 'lateral';
};
