// Pure (non-AI) helpers around DiagnosticResult / SectionSpec, extracted from
// the retired `lib/ai-pipeline.tsx` during Phase 3.5. The AI calls themselves
// live in `services/ai/ai-provider.impl.ts`; what stayed here is the small
// layer of derivation logic that runs locally and has no network dependency.

import type {
  CommitmentFinding,
  DiagnosticResult,
  LedgerEntry,
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
  /** This section (or an ancestor) is a DECLARED HEAP — its interlocks may honestly be
   *  empty; the model must not manufacture commitments for and-summative material (Phase 3). */
  declaredHeap?: boolean;
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
  declaredHeapSectionIds?: Set<string>,
): StructuralSurround {
  const neighbours = findNeighbours(sectionId, sections);
  if (!neighbours) return {};
  const { parent, prev, next } = neighbours;

  const surround: StructuralSurround = {};
  if (declaredHeapSectionIds?.has(sectionId)) surround.declaredHeap = true;

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
  if (s.declaredHeap)
    lines.push(
      'DECLARED HEAP: the writer has declared this section (or its parent) an HONEST HEAP — an aggregate whose inner functional content approaches zero (an inventory, coordinate cases). Its incoming/outgoing interlocks may honestly be empty; do NOT manufacture commitments or flag missing interlocks for and-summative material here.',
    );
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

/** True when `item` shares a significant token with a PRECOMPUTED token set (the widened
 *  later/earlier document pool). A missing/empty set means "no wider coverage here" →
 *  false, so this only ever ADDS a way to be met — it never manufactures a new break. */
function itemMetBySet(item: string, poolTokens: Set<string> | undefined): boolean {
  if (!poolTokens || poolTokens.size === 0) return false;
  for (const t of significantTokens(item)) if (poolTokens.has(t)) return true;
  return false;
}

/**
 * The document-wide context that WIDENS the mesh beyond textual adjacency (Arpeggio
 * Phase 3, repairing muddle I.2.3). Optional on every mesh call: when absent the mesh
 * behaves EXACTLY as before (adjacency only). When present it only ever silences a
 * would-be break — a commitment consumed anywhere later, established anywhere earlier,
 * covered by a paid IOU, or sitting under a declared heap is no longer flagged. Built
 * once per document by `buildMeshContext` (the token pools are precomputed prefix/suffix
 * unions, so the per-section check stays cheap).
 */
export interface MeshContext {
  /** Section ids under a declared-heap (self or ancestor) — interlock pressure suppressed. */
  declaredHeap: Set<string>;
  /** sectionId → union of significant tokens of ALL later sections' `incomingContext`. */
  laterIncomingTokens: Map<string, Set<string>>;
  /** sectionId → union of significant tokens of ALL earlier sections' `outgoingCommitments` + claim. */
  earlierOutgoingTokens: Map<string, Set<string>>;
  /** `owes` phrases of paid IOUs — a commitment they cover is silent. */
  paidCover: string[];
}

/**
 * Every section id under a DECLARED HEAP — one whose self or any ancestor carries an
 * OPEN `declared-heap` ledger entry. The mesh suppresses interlock pressure for these;
 * the diagnostic surround tells the model their interlocks may honestly be empty.
 */
export function declaredHeapSet(sections: Section[], ledger: LedgerEntry[]): Set<string> {
  const heapRoots = new Set(
    ledger.filter((e) => e.kind === 'declared-heap' && e.status === 'open').map((e) => e.openedAtSectionId),
  );
  const out = new Set<string>();
  if (heapRoots.size === 0) return out;
  const mark = (nodes: Section[], under: boolean) =>
    nodes.forEach((n) => {
      const now = under || heapRoots.has(n.id);
      if (now) out.add(n.id);
      mark(n.children, now);
    });
  mark(sections, false);
  return out;
}

/**
 * Precompute a `MeshContext` from the live document + ledger. Pure. `declaredHeap`
 * marks every section whose self-or-ancestor carries an OPEN `declared-heap` entry;
 * the token maps are a suffix union (later incoming) and a prefix union (earlier
 * outgoing + claim) over the reading order; `paidCover` is the `owes` of paid IOUs.
 * `ledger` defaults to none, so a caller wanting only the distance-widening (e.g. a
 * snapshot audit with no live ledger) can omit it.
 */
export function buildMeshContext(
  sections: Section[],
  specs: Record<string, SectionSpec | undefined>,
  ledger: LedgerEntry[] = [],
): MeshContext {
  const order: Section[] = [];
  const walk = (nodes: Section[]) => nodes.forEach((n) => { order.push(n); walk(n.children); });
  walk(sections);

  const declaredHeap = declaredHeapSet(sections, ledger);

  // Suffix union of later sections' incoming tokens (snapshot BEFORE folding in self).
  const laterIncomingTokens = new Map<string, Set<string>>();
  const laterAcc = new Set<string>();
  for (let i = order.length - 1; i >= 0; i -= 1) {
    laterIncomingTokens.set(order[i].id, new Set(laterAcc));
    for (const item of cleanList(specs[order[i].id]?.incomingContext))
      for (const t of significantTokens(item)) laterAcc.add(t);
  }

  // Prefix union of earlier sections' outgoing + claim tokens.
  const earlierOutgoingTokens = new Map<string, Set<string>>();
  const earlierAcc = new Set<string>();
  for (let i = 0; i < order.length; i += 1) {
    earlierOutgoingTokens.set(order[i].id, new Set(earlierAcc));
    const sp = specs[order[i].id];
    for (const item of cleanList(sp?.outgoingCommitments)) for (const t of significantTokens(item)) earlierAcc.add(t);
    const claim = sp?.mainClaim?.trim();
    if (claim) for (const t of significantTokens(claim)) earlierAcc.add(t);
  }

  const paidCover = ledger.filter((e) => e.kind === 'iou' && e.status === 'paid').map((e) => e.owes);

  return { declaredHeap, laterIncomingTokens, earlierOutgoingTokens, paidCover };
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
 *  or parent claim). Silent unless some upstream source actually declared content. With a
 *  `ctx`, an item established anywhere EARLIER in the document, or covered by a paid IOU,
 *  is also met — so only genuinely-unestablished context flags. */
function unmetIncoming(
  sectionId: string,
  spec: SectionSpec,
  n: Neighbours,
  specs: Record<string, SectionSpec | undefined>,
  ctx?: MeshContext,
): MeshFinding[] {
  const incoming = cleanList(spec.incomingContext);
  if (!incoming.length) return [];
  const prevOut = n.prev ? cleanList(specs[n.prev.id]?.outgoingCommitments) : [];
  const parentOut = n.parent ? cleanList(specs[n.parent.id]?.outgoingCommitments) : [];
  const parentClaim = n.parent ? (specs[n.parent.id]?.mainClaim?.trim() ?? '') : '';
  const pool = [...prevOut, ...parentOut, ...(parentClaim ? [parentClaim] : [])];
  if (!pool.length) return [];
  const wider = ctx?.earlierOutgoingTokens.get(sectionId);
  const paid = ctx?.paidCover ?? [];
  const relatedSectionTitle = prevOut.length ? n.prev?.title : n.parent?.title;
  return incoming
    .filter((item) => !itemMetBy(item, pool) && !itemMetBySet(item, wider) && !itemMetBy(item, paid))
    .map((detail) => ({ kind: 'unmet-incoming', detail, relatedSectionTitle, direction: 'upstream' }));
}

/** Outgoing commitments consumed by NOTHING downstream (the following sibling's incoming).
 *  Silent unless that sibling has a spec with declared incoming context. With a `ctx`, a
 *  commitment consumed anywhere LATER in the document, or covered by a paid IOU, is also
 *  met — the muddle-#3 repair: a commitment paid three sections later no longer flags. */
function danglingOutgoing(
  sectionId: string,
  spec: SectionSpec,
  n: Neighbours,
  specs: Record<string, SectionSpec | undefined>,
  ctx?: MeshContext,
): MeshFinding[] {
  const outgoing = cleanList(spec.outgoingCommitments);
  const nextSpec = n.next ? specs[n.next.id] : undefined;
  const downstreamIn = cleanList(nextSpec?.incomingContext);
  if (!outgoing.length || !nextSpec || !downstreamIn.length) return [];
  const wider = ctx?.laterIncomingTokens.get(sectionId);
  const paid = ctx?.paidCover ?? [];
  return outgoing
    .filter((item) => !itemMetBy(item, downstreamIn) && !itemMetBySet(item, wider) && !itemMetBy(item, paid))
    .map((detail) => ({ kind: 'dangling-outgoing', detail, relatedSectionTitle: n.next?.title, direction: 'downstream' }));
}

export function checkCommitmentMesh(
  sectionId: string,
  sections: Section[],
  specs: Record<string, SectionSpec | undefined>,
  ctx?: MeshContext,
): MeshFinding[] {
  if (ctx?.declaredHeap.has(sectionId)) return []; // declared heap → interlock pressure suppressed
  const neighbours = findNeighbours(sectionId, sections);
  const spec = specs[sectionId];
  if (!neighbours || !spec) return []; // unresolved id or spec-less → neutral, never a false break
  return [
    ...unmetIncoming(sectionId, spec, neighbours, specs, ctx),
    ...danglingOutgoing(sectionId, spec, neighbours, specs, ctx),
  ];
}
