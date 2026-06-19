// Pure (non-AI) helpers around DiagnosticResult / SectionSpec, extracted from
// the retired `lib/ai-pipeline.tsx` during Phase 3.5. The AI calls themselves
// live in `services/ai/ai-provider.impl.ts`; what stayed here is the small
// layer of derivation logic that runs locally and has no network dependency.

import type { DiagnosticResult, Section, SectionSpec } from '../types';

/** Derive an overall status from a DiagnosticResult for the treemap coloring. */
export function diagnosticToStatus(diag: DiagnosticResult): 'success' | 'fail' | 'stale' {
  const counts = { present: 0, partial: 0, missing: 0, unclear: 0 };
  diag.moveResults.forEach(mr => { counts[mr.status]++; });

  if (counts.missing === 0 && counts.unclear === 0 && counts.partial === 0) return 'success';
  if (counts.present === 0 && diag.moveResults.length > 0) return 'fail';
  return 'stale';
}

/** Build a fallback spec from a legacy goals string, for backward compatibility. */
export function specFromLegacyGoals(goals: string, mainClaim?: string): SectionSpec {
  return {
    function: 'argue',
    mainClaim: mainClaim || '',
    requiredMoves: goals
      ? [{ id: 'move-0', description: goals }]
      : [],
    incomingContext: [],
    outgoingCommitments: [],
  };
}

// --- structural surround (part-in-whole context) ---------------------------
//
// Wertheimer's distinction (On Truth, 1934): a *piece* is an element cut off and
// judged in isolation; a *part* is what it is by its function, place, and role in
// the whole. Evaluating a section with only its own spec + text treats it as a
// piece. The surround below is the section's *live* relations to the actual whole —
// the document's claim (the macro-vector), the parent's claim, the preceding
// section's outgoing commitments (what this section's incoming context should build
// on), and the following section's incoming needs (what this section's outgoing
// commitments must meet). All are role-reconstructions drawn from neighbours' specs,
// never raw prose slices, so a part is judged inside its whole rather than as a piece.

export interface StructuralSurround {
  /** The root spec's main claim — the whole this part ultimately serves. */
  documentClaim?: string;
  parentTitle?: string;
  parentClaim?: string;
  /** Preceding sibling's outgoing commitments (the upstream the part receives). */
  upstreamCommitments?: string[];
  /** Following sibling's incoming context (the downstream the part must supply). */
  downstreamNeeds?: string[];
}

const cleanList = (arr?: string[]): string[] =>
  (arr ?? []).map((s) => s.trim()).filter(Boolean);

/** Locate a section's parent and its immediate siblings within the tree. */
function findNeighbours(
  sectionId: string,
  sections: Section[],
): { parent: Section | null; prev: Section | null; next: Section | null } | null {
  const byId = new Map<string, Section>();
  const walk = (nodes: Section[]) =>
    nodes.forEach((n) => {
      byId.set(n.id, n);
      walk(n.children);
    });
  walk(sections);

  const node = byId.get(sectionId);
  if (!node) return null;

  const parent = node.parentId ? byId.get(node.parentId) ?? null : null;
  const siblings = parent ? parent.children : sections;
  const idx = siblings.findIndex((s) => s.id === sectionId);
  return {
    parent,
    prev: idx > 0 ? siblings[idx - 1] : null,
    next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
  };
}

/**
 * Derive a section's part-in-whole context from the section tree and the spec map
 * (sectionId → SectionSpec, with `'root'` holding the document-level spec). Pure:
 * returns only role-reconstructions, never section prose. Unknown ids yield `{}`.
 */
export function buildStructuralSurround(
  sectionId: string,
  sections: Section[],
  specs: Record<string, SectionSpec | undefined>,
): StructuralSurround {
  const neighbours = findNeighbours(sectionId, sections);
  if (!neighbours) return {};
  const { parent, prev, next } = neighbours;

  const surround: StructuralSurround = {};

  const docClaim = specs['root']?.mainClaim?.trim();
  if (docClaim) surround.documentClaim = docClaim;

  const parentClaim = parent ? specs[parent.id]?.mainClaim?.trim() : undefined;
  if (parent && parentClaim) {
    surround.parentTitle = parent.title;
    surround.parentClaim = parentClaim;
  }

  const upstream = prev ? cleanList(specs[prev.id]?.outgoingCommitments) : [];
  if (upstream.length) surround.upstreamCommitments = upstream;

  const downstream = next ? cleanList(specs[next.id]?.incomingContext) : [];
  if (downstream.length) surround.downstreamNeeds = downstream;

  return surround;
}

/** Render a StructuralSurround as a prompt block. Empty surround → empty string. */
export function formatStructuralSurround(s: StructuralSurround): string {
  const lines: string[] = [];
  if (s.documentClaim)
    lines.push(`DOCUMENT'S MAIN CLAIM (the whole this part serves): ${s.documentClaim}`);
  if (s.parentClaim)
    lines.push(
      `PARENT SECTION${s.parentTitle ? ` ("${s.parentTitle}")` : ''} MAIN CLAIM: ${s.parentClaim}`,
    );
  if (s.upstreamCommitments?.length) {
    lines.push(
      'WHAT THE PRECEDING SECTION COMMITTED TO ESTABLISH (this section\'s incoming context should build on these):',
    );
    s.upstreamCommitments.forEach((c) => lines.push(`  - ${c}`));
  }
  if (s.downstreamNeeds?.length) {
    lines.push(
      "WHAT THE FOLLOWING SECTION EXPECTS THIS SECTION TO HAVE ESTABLISHED (this section's outgoing commitments must meet these):",
    );
    s.downstreamNeeds.forEach((c) => lines.push(`  - ${c}`));
  }
  if (lines.length === 0) return '';
  return [
    'STRUCTURAL SURROUND (judge this section as a PART functioning in the WHOLE, not as an isolated piece):',
    ...lines,
  ].join('\n');
}
