// The store-free orchestrator for the spec-anchored A/B whole-test. ONE function —
// the seam BOTH UI surfaces (the dedicated Spec Test workspace and the Version
// Compare fold) AND the future automatic snapshot/session-end trigger call. It owns
// no React, no store, no toast: it takes resolved operands + the held rubric, runs
// the diff+mesh-scoped per-section pass and the single whole-verdict pass, and
// returns the assembled report. The whole verdict is authoritative; the tally is
// transparency only. See docs/gestalt-design-II.md L1–L4 and lib/specTestHelpers.ts.

import { parseMarkdown } from './utils';
import {
  planSpecTestRun,
  meshDeltaFor,
  rubricSpecsById,
  surroundForTitle,
  buildSkeleton,
  formatChangedProse,
  formatMeshDelta,
  structuralResult,
  unparseableResult,
  summarizeTally,
  rollupDirection,
  isDeepRead,
  type SpecTestScope,
  type SectionTestPlanItem,
} from './specTestHelpers';
import type { AIProvider } from '../services/ai-provider';
import type {
  MeshDelta,
  PromptsConfig,
  ReadingMode,
  Section,
  SectionSpec,
  SectionSpecTest,
  SpecTestReport,
  WholeVerdict,
} from '../types';

/** Just the two methods the orchestrator needs — keeps the lib edge type-only. */
export type SpecTestRunner = Pick<AIProvider, 'runSpecTestSection' | 'runSpecTestWhole'>;

/** A resolved comparison operand (cf. compareHelpers.resolveOperand). */
export interface SpecTestOperand {
  markdown: string;
  label: string;
}

export interface RunSpecTestOptions {
  /** title → held SectionSpec rubric (the test). */
  specByTitle: Map<string, SectionSpec>;
  /** The rubric's section tree — for neighbour finding + the surround's intended whole. */
  rubricSections: Section[];
  /** The document-level (root) spec — the macro-vector + the mesh root. */
  rootSpec?: SectionSpec;
  scope: SpecTestScope;
  mode: ReadingMode;
  rubricSource: 'live' | 'snapshot-a';
  config: PromptsConfig;
  /** Called as each section result resolves, for incremental UI fill. */
  onSection?: (result: SectionSpecTest) => void;
  /** Per-section context guard: return true to skip a section too large to deep-read. */
  shouldSkipForContext?: (proseA: string, proseB: string) => boolean;
}

/** The fallback whole verdict when the AI whole call fails — grounded in the
 *  deterministic mesh delta, so the report still leads with a structural truth. */
const fallbackWhole = (meshDelta: MeshDelta): WholeVerdict => {
  const introduced = meshDelta.introduced.length;
  return {
    truth: introduced ? 'tF' : 'lateral',
    direction: rollupDirection(meshDelta),
    centerOfGravity: '',
    verdict: introduced
      ? 'The whole-level read could not be generated; the deterministic mesh check found newly severed structural joins (below).'
      : 'The whole-level read could not be generated; no structural-mesh regressions were detected.',
    meshDelta,
    ...(introduced ? { recenteringVector: 'Repair the introduced commitment breaks listed in the mesh delta.' } : {}),
  };
};

/** Evaluate ONE planned section: structural (no AI) for non-deep-read or
 *  context-skipped items, else one part-level AI call. Returns whether the model
 *  was actually called (for the deep-read tally). */
async function evaluateSection(
  ai: SpecTestRunner,
  item: SectionTestPlanItem,
  ctx: {
    specByTitle: Map<string, SectionSpec>;
    rubricSections: Section[];
    specsById: Record<string, SectionSpec | undefined>;
    mode: ReadingMode;
    config: PromptsConfig;
    shouldSkipForContext?: (proseA: string, proseB: string) => boolean;
  },
): Promise<{ result: SectionSpecTest; deepRead: boolean }> {
  const spec = ctx.specByTitle.get(item.title);
  if (!isDeepRead(item.scopeReason) || !spec) return { result: structuralResult(item), deepRead: false };

  if (ctx.shouldSkipForContext?.(item.proseA, item.proseB)) {
    return {
      result: {
        ...structuralResult(item),
        scopeReason: item.scopeReason,
        summary: 'Skipped — this section exceeds the configured model’s context window.',
      },
      deepRead: false,
    };
  }

  const aiResult = await ai.runSpecTestSection({
    sectionTitle: item.title,
    spec,
    structuralSurround: surroundForTitle(item.title, ctx.rubricSections, ctx.specsById),
    proseA: item.proseA,
    proseB: item.proseB,
    mode: ctx.mode,
    config: ctx.config,
  });
  const result: SectionSpecTest = aiResult
    ? { ...aiResult, scopeReason: item.scopeReason, presentInA: item.presentInA, presentInB: item.presentInB }
    : unparseableResult(item);
  return { result, deepRead: true };
}

export async function runSpecTestForOperands(
  ai: SpecTestRunner,
  a: SpecTestOperand,
  b: SpecTestOperand,
  opts: RunSpecTestOptions,
): Promise<SpecTestReport> {
  const { specByTitle, rubricSections, rootSpec, scope, mode, rubricSource, config, onSection, shouldSkipForContext } = opts;

  const aSections = parseMarkdown(a.markdown);
  const bSections = parseMarkdown(b.markdown);
  const plan = planSpecTestRun(a.markdown, b.markdown, specByTitle, rubricSections, scope);
  const meshDelta = meshDeltaFor(aSections, bSections, specByTitle, rootSpec);
  const specsById = rubricSpecsById(rubricSections, specByTitle, rootSpec);
  const ctx = { specByTitle, rubricSections, specsById, mode, config, shouldSkipForContext };

  const results: SectionSpecTest[] = [];
  let deepRead = 0;

  // Per-section part-level pass (sequential — bounds cost + keeps the trace legible).
  for (const item of plan) {
    const { result, deepRead: dr } = await evaluateSection(ai, item, ctx);
    if (dr) deepRead++;
    results.push(result);
    onSection?.(result);
  }

  // The single whole-level pass — judged from the role-skeleton + mesh delta, never
  // a sum of the section scores. Falls back to a mesh-grounded verdict on failure.
  const deepReadItems = plan.filter((it) => isDeepRead(it.scopeReason));
  const aiWhole = await ai.runSpecTestWhole({
    documentClaim: rootSpec?.mainClaim ?? '',
    skeletonA: buildSkeleton(aSections, specByTitle),
    skeletonB: buildSkeleton(bSections, specByTitle),
    changedProse: formatChangedProse(deepReadItems),
    meshDeltaText: formatMeshDelta(meshDelta),
    mode,
    config,
  });
  const whole: WholeVerdict = aiWhole ? { ...aiWhole, meshDelta } : fallbackWhole(meshDelta);

  return {
    whole,
    sections: results,
    tally: summarizeTally(results, deepRead),
    mode,
    labelA: a.label,
    labelB: b.label,
    scopeLabel: scope === 'all' ? 'all' : 'changed',
    rubricSource,
  };
}
