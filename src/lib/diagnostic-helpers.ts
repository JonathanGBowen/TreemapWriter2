// Pure (non-AI) helpers around DiagnosticResult / SectionSpec, extracted from
// the retired `lib/ai-pipeline.tsx` during Phase 3.5. The AI calls themselves
// live in `services/ai/ai-provider.impl.ts`; what stayed here is the small
// layer of derivation logic that runs locally and has no network dependency.

import type {
  CommitmentFinding,
  DiagnosticResult,
  NextAction,
  Section,
  SectionSpec,
} from '../types';

/** Derive an overall status from a DiagnosticResult for the treemap coloring. */
export function diagnosticToStatus(diag: DiagnosticResult): 'success' | 'fail' | 'stale' {
  const counts = { present: 0, partial: 0, missing: 0, unclear: 0 };
  diag.moveResults.forEach(mr => { counts[mr.status]++; });

  if (counts.missing === 0 && counts.unclear === 0 && counts.partial === 0) return 'success';
  if (counts.present === 0 && diag.moveResults.length > 0) return 'fail';
  return 'stale';
}

const asTrimmed = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const COMMITMENT_KINDS: readonly CommitmentFinding['kind'][] = [
  'unmet-incoming',
  'dangling-outgoing',
  'center-of-gravity',
];

/**
 * Tolerant parse of the optional commitment-mesh findings from a diagnostic JSON
 * response. Drops malformed entries; returns undefined when none survive, so a terse
 * or legacy response never produces an empty-but-present array. See gestalt-design-II L2.
 */
export function parseCommitmentFindings(raw: unknown): CommitmentFinding[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const findings: CommitmentFinding[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const kind = rec.kind;
    const detail = asTrimmed(rec.detail);
    if (!detail) continue;
    if (typeof kind !== 'string' || !COMMITMENT_KINDS.includes(kind as CommitmentFinding['kind'])) continue;
    const related = asTrimmed(rec.relatedSectionTitle);
    findings.push({
      kind: kind as CommitmentFinding['kind'],
      detail,
      relatedSectionTitle: related || undefined,
    });
  }
  return findings.length ? findings : undefined;
}

/**
 * Tolerant parse of the optional located gap → vector. Returns undefined unless BOTH
 * the gap and the vector are present, so a partial object falls back to `nextPriority`
 * rather than rendering a one-sided action. See gestalt-design-II L4.
 */
export function parseNextAction(raw: unknown): NextAction | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rec = raw as Record<string, unknown>;
  const gap = asTrimmed(rec.gap);
  const vector = asTrimmed(rec.vector);
  if (!gap || !vector) return undefined;
  const location = asTrimmed(rec.location);
  return { gap, vector, location: location || undefined };
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

// --- deterministic commitment-mesh check (Phase 3, L2) ---------------------
//
// The long-deferred deterministic counterpart to the AI commitmentFindings: a pure,
// no-network check of whether a section's `incomingContext` is actually met by what the
// surrounding sections commit to establish, and whether its `outgoingCommitments` are
// consumed downstream. It is the trustworthy spine of the strain register (the user is
// false-alarm-sensitive), so it is deliberately HIGH-PRECISION and errs toward silence:
// it only judges a relation when both ends have real specs, matches generously by shared
// significant token, and stays neutral whenever it cannot tell (no spec, unresolved id,
// tokenless item). It never asserts a break it is not sure of.

/** A deterministic structural break between a section and a named neighbour. */
export type MeshFindingKind = 'unmet-incoming' | 'dangling-outgoing';

export interface MeshFinding {
  kind: MeshFindingKind;
  /** The specific incoming/outgoing item left unpaired. */
  detail: string;
  /** The neighbour the relation points to. */
  relatedSectionTitle?: string;
  /** Which way the unmet relation points. */
  direction: 'upstream' | 'downstream';
}

const MESH_STOPWORDS = new Set([
  'this', 'that', 'these', 'those', 'with', 'from', 'into', 'about', 'which', 'their',
  'there', 'where', 'what', 'when', 'will', 'shall', 'must', 'have', 'been', 'they',
  'them', 'then', 'than', 'such', 'each', 'also', 'only', 'some', 'more', 'most',
  'between', 'within', 'because', 'section', 'sections', 'chapter', 'establish',
  'establishes', 'established', 'provide', 'provides', 'reader', 'argument',
]);

/** Significant tokens of a phrase: lowercased, punctuation-stripped, stopwords + short tokens dropped. */
function significantTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !MESH_STOPWORDS.has(t)),
  );
}

/** True when `item` shares a significant token with any phrase in `pool`. Tokenless items
 *  (no significant tokens to judge on) count as MET — silence over a false alarm. */
function itemMetBy(item: string, pool: string[]): boolean {
  const itemTokens = significantTokens(item);
  if (itemTokens.size === 0) return true;
  for (const phrase of pool) {
    const pt = significantTokens(phrase);
    for (const t of itemTokens) if (pt.has(t)) return true;
  }
  return false;
}

/**
 * Deterministic commitment-mesh check for one section. Returns the structural breaks it
 * is confident about, or `[]` (neutral) when it cannot judge. Pure: reads only specs +
 * the tree. `specs` is the same `sectionId → SectionSpec` map `buildStructuralSurround`
 * consumes (with `'root'` holding the document spec).
 *
 * - `unmet-incoming`: an `incomingContext` item matched by NONE of {preceding sibling's
 *   outgoingCommitments, parent's outgoingCommitments, parent's mainClaim}. Emitted only
 *   when at least one of those upstream sources actually has content (else: can't judge).
 * - `dangling-outgoing`: an `outgoingCommitments` item matched by NONE of the following
 *   sibling's `incomingContext`. Emitted only when that sibling has a spec with non-empty
 *   incoming (else: can't judge).
 *
 * Any unresolved neighbour id or missing section spec yields `[]` — never a false break.
 * (Section ids are still title-derived per STATUS.md, so this guard is load-bearing.)
 */
type Neighbours = NonNullable<ReturnType<typeof findNeighbours>>;

/** Incoming-context items met by NOTHING upstream (preceding sibling / parent commitments
 *  or parent claim). Silent unless some upstream source actually declared content. */
function unmetIncoming(spec: SectionSpec, n: Neighbours, specs: Record<string, SectionSpec | undefined>): MeshFinding[] {
  const incoming = cleanList(spec.incomingContext);
  if (!incoming.length) return [];
  const prevOut = n.prev ? cleanList(specs[n.prev.id]?.outgoingCommitments) : [];
  const parentOut = n.parent ? cleanList(specs[n.parent.id]?.outgoingCommitments) : [];
  const parentClaim = n.parent ? (specs[n.parent.id]?.mainClaim?.trim() ?? '') : '';
  const pool = [...prevOut, ...parentOut, ...(parentClaim ? [parentClaim] : [])];
  if (!pool.length) return [];
  const relatedSectionTitle = prevOut.length ? n.prev?.title : n.parent?.title;
  return incoming
    .filter((item) => !itemMetBy(item, pool))
    .map((detail) => ({ kind: 'unmet-incoming', detail, relatedSectionTitle, direction: 'upstream' }));
}

/** Outgoing commitments consumed by NOTHING downstream (the following sibling's incoming).
 *  Silent unless that sibling has a spec with declared incoming context. */
function danglingOutgoing(spec: SectionSpec, n: Neighbours, specs: Record<string, SectionSpec | undefined>): MeshFinding[] {
  const outgoing = cleanList(spec.outgoingCommitments);
  const nextSpec = n.next ? specs[n.next.id] : undefined;
  const downstreamIn = cleanList(nextSpec?.incomingContext);
  if (!outgoing.length || !nextSpec || !downstreamIn.length) return [];
  return outgoing
    .filter((item) => !itemMetBy(item, downstreamIn))
    .map((detail) => ({ kind: 'dangling-outgoing', detail, relatedSectionTitle: n.next?.title, direction: 'downstream' }));
}

export function checkCommitmentMesh(
  sectionId: string,
  sections: Section[],
  specs: Record<string, SectionSpec | undefined>,
): MeshFinding[] {
  const neighbours = findNeighbours(sectionId, sections);
  const spec = specs[sectionId];
  if (!neighbours || !spec) return []; // unresolved id or spec-less → neutral, never a false break
  return [...unmetIncoming(spec, neighbours, specs), ...danglingOutgoing(spec, neighbours, specs)];
}
