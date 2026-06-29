// Structural-strain metric (Phase 3, L3b of docs/gestalt-design-II.md) — the data
// behind the Structural-Tension Register. Pure and deterministic-FIRST: a section's
// strain begins from the no-network commitment-mesh check (checkCommitmentMesh), and AI
// findings (Phase-1 commitmentFindings, an "adrift" Beethoven reconstruction, a
// recapitulative move) may only CORROBORATE/escalate — never originate a high band. The
// user is false-alarm-sensitive, so blocked and spec-less sections are always neutral and
// AI-alone caps at "medium". No React / Plotly / state imports → unit-testable.

import type { AuditFinding, AuditFindingKind, Section, SectionSpec, TestSuite } from '../types';
import { checkCommitmentMesh } from './diagnostic-helpers';
import { CHAPTER_WORDS } from './magnitude';

export type StrainBand = 'none' | 'medium' | 'high';

export type StrainSignalKind =
  | 'unmet-incoming'
  | 'dangling-outgoing'
  | 'center-of-gravity'
  | 'adrift'
  | 'recapitulative'
  // C1 (docs/gestalt-design-IV.md): Wertheimer 1912 §18 — number ≠ value. A section
  // large in WORD COUNT but light in structural ADVANCE: bulk that is not doing work,
  // "a mountain of copper small change [that] cannot buy a house."
  | 'ballast'
  // WS4b: whole-document argument-audit findings, folded in as AI-sourced signals
  // (so they cap at 'medium' alone and only reach 'high' when a deterministic mesh
  // break corroborates the same section). Defined once in types/index.ts.
  | AuditFindingKind;

export interface StrainSignal {
  kind: StrainSignalKind;
  /** Human-readable description of the tension. */
  detail: string;
  /** The neighbour the relation points to, when located. */
  relatedTitle?: string;
  direction?: 'upstream' | 'downstream' | 'self';
  /** Whether this came from the deterministic mesh check or an AI diagnostic. */
  source: 'deterministic' | 'ai';
}

export interface SectionStrain {
  sectionId: string;
  title: string;
  band: StrainBand;
  signals: StrainSignal[];
}

type SpecMap = Record<string, SectionSpec | undefined>;

/** A section is blocked if it or an ancestor has a non-reference dependency whose target
 *  is not yet succeeding — mirrors Treemap's checkIsBlocked so the two never disagree. */
function isBlocked(sectionId: string, byId: Map<string, Section>, testSuite: TestSuite): boolean {
  let currentId: string | null = sectionId;
  const seen = new Set<string>();
  while (currentId && currentId !== 'root' && !seen.has(currentId)) {
    seen.add(currentId);
    const deps = testSuite[currentId]?.dependencies ?? [];
    const blocked = deps.some((d) => d.type !== 'reference' && testSuite[d.id]?.status !== 'success');
    if (blocked) return true;
    currentId = byId.get(currentId)?.parentId ?? null;
  }
  return false;
}

/** Collect the AI corroboration signals for a section from its last diagnostic + gestalt ops.
 *  `words` is the section's word count, used only for the size-gated ballast signal. */
function aiSignals(testSuite: TestSuite, sectionId: string, words: number): StrainSignal[] {
  const entry = testSuite[sectionId];
  if (!entry) return [];
  const out: StrainSignal[] = [];

  for (const f of entry.lastDiagnostic?.commitmentFindings ?? []) {
    out.push({
      kind: f.kind,
      detail: f.detail,
      relatedTitle: f.relatedSectionTitle,
      direction: f.kind === 'unmet-incoming' ? 'upstream' : f.kind === 'dangling-outgoing' ? 'downstream' : 'self',
      source: 'ai',
    });
  }

  if (entry.wholeFromPart?.alignment === 'adrift') {
    out.push({
      kind: 'adrift',
      detail: 'reads adrift from the whole — the document claim cannot be recovered from this part',
      source: 'ai',
    });
  }

  const hasRecapitulative = entry.lastDiagnostic?.moveResults.some((m) => m.advance === 'recapitulative') ?? false;
  if (hasRecapitulative) {
    out.push({
      kind: 'recapitulative',
      detail: 'has a move that is present but recapitulative (adds nothing new)',
      source: 'ai',
    });
  }

  // Ballast (C1): only when a recapitulative move COINCIDES with large bulk — number
  // diverging from value. Conservative by design (rides an existing AI finding + a size
  // gate), so it never fires on a large section that is doing real work, and being
  // AI-sourced it cannot originate a high band.
  if (hasRecapitulative && words >= CHAPTER_WORDS) {
    out.push({
      kind: 'ballast',
      detail: 'heavy in words but light in advance — a chapter-scale section carrying a recapitulative move',
      source: 'ai',
    });
  }

  return out;
}

/** Map a section's whole-document audit findings (WS4b) into AI-tier strain signals. */
function auditSignalsFor(sectionId: string, auditFindings: AuditFinding[]): StrainSignal[] {
  return auditFindings
    .filter((f) => f.sectionId === sectionId)
    .map((f) => ({
      kind: f.kind,
      detail: f.detail,
      relatedTitle: f.relatedSectionTitle,
      direction: f.direction,
      source: 'ai' as const,
    }));
}

/**
 * Strain for one section. Neutral (band 'none', no signals) when the section is blocked
 * or has no spec. Otherwise: deterministic mesh breaks set the base; AI signals (the last
 * diagnostic + whole-document audit findings) corroborate. Bands — 0 signals → none; with
 * a deterministic base, total ≥2 → high else medium; with NO deterministic base, AI alone
 * caps at medium (it may escalate, never originate a high — so audit findings alone stay medium).
 */
export function computeStrain(
  sectionId: string,
  sections: Section[],
  byId: Map<string, Section>,
  specs: SpecMap,
  testSuite: TestSuite,
  auditFindings: AuditFinding[] = [],
): SectionStrain {
  const title = byId.get(sectionId)?.title ?? sectionId;
  const blank: SectionStrain = { sectionId, title, band: 'none', signals: [] };

  if (!specs[sectionId]) return blank; // spec-less → neutral (an unfilled spec is never strain)
  if (isBlocked(sectionId, byId, testSuite)) return blank; // blocked already says "cannot act here yet"

  const deterministic: StrainSignal[] = checkCommitmentMesh(sectionId, sections, specs).map((f) => ({
    kind: f.kind,
    detail: f.detail,
    relatedTitle: f.relatedSectionTitle,
    direction: f.direction,
    source: 'deterministic' as const,
  }));
  const ai = [
    ...aiSignals(testSuite, sectionId, byId.get(sectionId)?.wordCount ?? 0),
    ...auditSignalsFor(sectionId, auditFindings),
  ];
  const signals = [...deterministic, ...ai];
  if (signals.length === 0) return blank;

  const band: StrainBand =
    deterministic.length === 0
      ? 'medium' // AI-only: capped
      : signals.length >= 2
        ? 'high'
        : 'medium';

  return { sectionId, title, band, signals };
}

/** Build a sectionId → SectionSpec map from the test suite (root holds the document spec). */
export function buildSpecMap(testSuite: TestSuite): SpecMap {
  return Object.fromEntries(Object.entries(testSuite).map(([id, e]) => [id, e?.spec]));
}

/**
 * Strain across the whole document, in reading order, for the register. Returns only the
 * sections under tension (band ≥ medium) and their count.
 */
export function computeAllStrain(
  sections: Section[],
  testSuite: TestSuite,
  auditFindings: AuditFinding[] = [],
): { strained: SectionStrain[]; count: number } {
  const byId = new Map<string, Section>();
  const order: string[] = [];
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      byId.set(n.id, n);
      order.push(n.id);
      walk(n.children);
    });
  walk(sections);

  const specs = buildSpecMap(testSuite);
  const strained = order
    .map((id) => computeStrain(id, sections, byId, specs, testSuite, auditFindings))
    .filter((s) => s.band !== 'none');

  return { strained, count: strained.length };
}
