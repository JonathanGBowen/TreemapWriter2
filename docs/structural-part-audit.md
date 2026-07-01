# Structural analysis in name only? — an audit of the heading≡part identity

> **What this is.** An audit, not an essay. It asks one question of the code: does the tool's
> "structural" analysis operate on **structural-functional parts**, or on parts delimited by the
> **markdown headings** — i.e. by the textual composition? It inventories every place the
> pipeline *breaks the document into parts → interprets them → reassembles them*, and grades each
> against Wertheimer. It is the empirical companion to
> [`gestalt-and-text-structure.md`](gestalt-and-text-structure.md), which named the *two wholes*
> (the argument vs. the composition) in theory; this asks whether the code honours that
> distinction or quietly collapses it. **When this audit and the code disagree, trust the code**
> — and note that line numbers are deliberately omitted (they drift; the code is canonical,
> per [`../CLAUDE.md`](../CLAUDE.md)). Citations are by file + identifier.
>
> **Provenance.** Read for this audit: the parse/analysis pipeline itself — `src/lib/utils.ts`,
> `src/services/ai/*`, `src/services/prompts/*`, `src/lib/*-helpers.ts`,
> `src/features/modals/topo/*` — against Wertheimer's *On Truth* (a Gestalt "limits itself";
> "a part may figure in two or more different wholes") and the "natural joints" lesson from
> *Productive Thinking* (already cited in the code's own `ai-provider.segment.ts` and
> `decompose-step.md`).
>
> **Standing.** Diagnostic + remediation **directions** — not committed code, not a spec. The
> remediation names what taking Wertheimer's point seriously would require and one design
> constraint the user has fixed (keep Articulation; add, don't repurpose).

---

## I. The question, sharpened

The tool's founding thesis is *structure, not summary* — "exegetical reconstruction," never
restatement ([`VISION.md`](VISION.md)). But **structure of what parts?** A "part" can be two
different things, and the theory essay already distinguished them
([`gestalt-and-text-structure.md`](gestalt-and-text-structure.md) §I):

- a **textual block** — a heading-delimited section, a unit of the *composition*; or
- a **structural-functional part** — a move, a joint, a configurational unit determined by the
  *argument's* inner structure.

Wertheimer's whole point is that these need not coincide. The boundaries of a substantive whole
"limit themselves" and are "subject to examination on grounds of being correct or incorrect" —
they are not handed over by an external delimiter. And "a part may figure in two or more
different wholes." So if the tool takes the markdown headings as its parts, it imports the
*text's* caesuras as the *structure's* joints — the one move *On Truth* forbids — and the
elaborate part/whole vocabulary layered on top (`tF`/`fT`, commitment-mesh, radix) would be
describing relations among text-given pieces, structural in name only.

This audit tests exactly that.

## II. The foundational break is purely textual

`parseMarkdown` (`src/lib/utils.ts`) is the sole splitter, and it creates a `Section` **only**
at a line matching the heading regex `/^(#{1,6})\s+(.*)/`. Nothing else — a topic shift, a
paragraph break, a change of argumentative gear — creates a part. A section's `content` is its
own prose up to its first *child* heading; `fullContent` is its whole subtree; `wordCount` (the
treemap's area) is counted over `fullContent`. The whole document is materialised as a
*synthetic section* — `buildRootSection` sets `id: 'root'`, `fullContent = md`.

**No part boundary in this app exists that is not a `#`.** Every persistent, keyed, visualised
result hangs off a `Section.id` (plus the synthetic `'root'`): the `TestSuite` map, `SectionSpec`,
`DiagnosticResult`, `Dependency[]`, gist segments, topo stations, spec-test alignment, sessions,
snapshots. That single fact is inherited by everything below.

## III. The verdict, on two axes

The worry splits into two independent questions, and the split is the finding.

### Axis 1 — Interpretation granularity: is the *reading* whole-derived, or built from pieces?

**Largely whole-derived, and sincerely so.** This is real, and it deserves stating plainly
before the criticism.

- The document-level passes genuinely read the complete text. `root-task.md` opens *"Analyze the
  ENTIRE document,"* returns *"a SINGLE JSON object (NOT keyed by section id),"* and states the
  doctrine outright: **"A document is not an and-sum of chapters but a single line of development
  that closes a gap."** The root diagnostic (`runDiagnostic` on `fullDocument`), root analysis
  (*"the text below is the ENTIRE document"*), `compareVersions` (both whole drafts),
  `generatePersonas`, document-level atmosphere, and gist Stage-A (`analyzeGist`, whole document
  in one call) are all operands on the whole text.
- The per-section passes are **part-in-whole**, not isolated pieces. `buildStructuralSurround` /
  `formatStructuralSurround` (`src/lib/diagnostic-helpers.ts`) inject the document claim, the
  parent's claim, and the neighbours' commitments — *role-reconstructions, never prose slices* —
  into the section diagnostic, analysis, spec-test, and recenter prompts. Full `fullContent` is
  sent, never a slice.

The genuine "and-sum" offenders are **narrow but real**:

- **`getCoachAdvice` / `buildCoachPrompt`** (`src/services/ai/ai-provider.impl.ts`) — the
  document triage sees **no prose at all**: only assembled per-section metadata (title, level,
  `wordCount`, goals, status, missing moves) plus the document's character length. This is the
  purest form of "I know everything as a sum" that *On Truth* warns of: the tool's whole-document
  advice is computed from a table of section statuses.
- **`estimateDependencies`** (`ai-provider.impl.ts`, prompt `dependencies.md`) — the argument
  graph is inferred from per-section spec *strings* (`incomingContext` vs `outgoingCommitments`),
  never from text. A double decomposition: text → per-section commitment declarations → edges
  matched between them.
- The `content.slice(0, 800)` / `slice(0, 600)` previews in the L1/sub **spec** passes
  (`ai-provider.specs.ts`) — the only char-prefix truncations fed to a model, and already
  flagged in-code as an unresolved "part-not-piece" compromise pointing at
  [`gestalt-design.md`](gestalt-design.md) item 7.

(`runSpecTestWhole` and gist Stage-B are *assembled* from per-section role/analysis
reconstructions rather than the raw whole — but deliberately, and Wertheimer-aware; `buildSkeleton`
feeds role-reconstructions and the whole verdict is explicitly *"not a sum of per-section
judgments."* These are defensible.)

**So on Axis 1 the app is not naively piecemeal.** The user's first fear — that the analyses are
"built up out of the parts as delimited by the text" — is, at the level of *interpretation*,
largely answered: the readings are whole-derived or whole-conditioned, with a short list of
fixable exceptions.

### Axis 2 — Part ontology: are the *parts themselves* text-given?

**Uniformly, foundationally, yes.** And this is where the tool fails Wertheimer.

- Every analysable unit is a heading-delimited `Section.id`. The whole exists in only two
  degenerate forms: `'root'` = the entire text as **one undifferentiated blob**, or an
  **assembly** of heading-parts. There is no third form — *the whole grasped as a configuration
  of its own structural parts.* Even the whole-derived root analysis, having read everything,
  can only deposit its result as a `SectionAnalysis` keyed to the synthetic `'root'`: it reads
  the whole but never **articulates it into parts** other than the headings already there.
- The dependency graph, the radix/centering engine (`topo-derive.ts`, `topo-centering.ts`), and
  the deterministic commitment-mesh (`checkCommitmentMesh`, matching a section's `incomingContext`
  against parent/sibling `outgoingCommitments` by token overlap) are all **section-to-section**.
  Version comparison aligns the two drafts **by heading title** (`alignByTitle`).
- The one pass that hunts for parts off the heading grid is Articulation
  (`ai-provider.segment.ts`): it reads paragraph blocks and cuts *"by natural articulation, never
  to a count (Wertheimer)."* **This is a genuine, valuable faculty and must stay** — its real job
  is to propose or repair **headings** for transcripts, pasted/imported text, and header-less
  drafts, and emitting headings is exactly right *for that job*. But its only output is a
  `SegmentEdit` — `insert | retitle | relevel | merge | split` of a markdown heading — applied
  and reparsed into the same tree (it even carries Wertheimer's shard metaphor: `merge` removes
  "a heading whose section is a SHARD… [and its body] rejoins the part above"). The problem is
  not that Articulation emits headings; it is that it is the app's **only** joint-faculty, so
  *"find the headers"* silently doubles as *"find the structural parts."* **A joint the tool
  notices can only be recorded as "put a heading here."**

### Synthesis

The piecemeal-ness is **not (mostly) in the input** — the app does real work to read wholes and
condition parts on wholes. The failure is in the **ontology**: the markdown heading is *welded
to* the concept of "structural part." Two consequences follow, and both are Wertheimer's own
objections:

1. The whole, once perceived, **can only be re-expressed through headings.** The tool can grasp
   the whole (root analysis reads everything) but has no organ to *speak* the whole's structure
   except in the vocabulary of headings.
2. Any structural-functional part that **spans** two headings, **subdivides** one, or **belongs
   to two wholes at once** (*On Truth*) is **inexpressible.**

So the section↔structural-part mapping the theory essay anticipated (§IV.4, "Sharing") isn't done
*badly* — it is **foreclosed**, because "structural part" is not a first-class object distinct
from "heading-section." There are not two things to map; there is one thing wearing two names.
The tool takes Wertheimer's **second** move — *read a part in its whole* — while violating his
**first** — *let the whole determine what the parts are.* And a faithful part-in-whole reading of
the *wrong* parts is, in the end, still piecemeal, because the parts were never the whole's own.

The disguise is real and worth naming: the richer the part-in-whole apparatus (`tF`/`fT`, the
mesh, the radix, even a Wertheimer-citing articulator), the more it makes heading-sections *feel*
like validated structural units whose boundaries were never in question — exactly the failure
[`gestalt-design-III.md`](gestalt-design-III.md) warns of, where miscentering is "the more
energetically disguised as true centering the less it is so in fact."

## IV. The inventory

Grouped by how each site treats the part. Rubric: **Unit** (text-given?) · **Interpretation**
(whole-conditioned?) · **Reassembly** (summative?) · **Escape** (can it name a non-heading part?).

- **G0 · The foundational break** — `parseMarkdown`, `buildRootSection` (`src/lib/utils.ts`).
  Unit: heading-section. The source every group below inherits.
- **G1 · Whole-derived interpretations** — root spec (`ai-provider.specs.ts` + `root-task.md`),
  root diagnostic + root analysis (`ai-provider.impl.ts`, `analysis-helpers.ts`),
  `compareVersions`, `generatePersonas`, document atmosphere, gist Stage-A (`analyzeGist`).
  *Axis-1 good; Axis-2 caveat: every result is still keyed to `Section.id`/`'root'` — the whole is
  read but not articulated into its own parts.*
- **G2 · Part-in-whole section passes** — section diagnostic, section analysis
  (`use-analysis-actions.ts`), spec-test-section, recenter (`ai-provider.gestalt.ts`), all fed
  `buildStructuralSurround` (`diagnostic-helpers.ts`). *Surround mitigates Axis-1; Axis-2 fails
  (units and neighbours are all heading-sections).*
- **G3 · Genuine reassembly-from-parts** — **coach** (`buildCoachPrompt`, metadata only — worst),
  **dependencies** (`estimateDependencies`, commitment strings only), spec-test-whole
  (`buildSkeleton`, `specTestHelpers.ts` — deliberate/defensible), gist Stage-B (`composeGist` —
  from whole-derived Stage-A, acceptable).
- **G4 · The sole joint-finder** — Articulation (`ai-provider.segment.ts`; `SegmentEdit` in
  `src/types/index.ts`). A **legitimate header tool — keep it.** The crux is not its output but
  its *solitude*: structural-part discovery has no separate home.
- **G5 · Sub-section units, quarantined** — `ParagraphBlock` (`paragraph-helpers.ts`), reverse
  outline (`generate-reverse-outline.md`), gist segments (which *are* sections,
  `flattenGistSegments` in `gist-helpers.ts`), `RequiredMove` (within-section only). *A finer
  grain exists — but it carries prose distillation/rewrite, never structural analysis, and is
  always scoped inside a section.*
- **Reassembly points** — `flattenTree` (treemap), `deriveTopo` (graph nodes = sections),
  `buildSkeleton` (whole verdict), `alignByTitle` (version alignment by heading title),
  `joinSpans` (gist prose), strain propagation up `parentId`.

## V. Remediation directions

Directions, not a spec. The aim is to give structural parts a first-class existence so that the
section↔part mapping *can* diverge (the whole point of the two-wholes theory), without disturbing
what already works.

1. **The missing primitive.** A first-class **`StructuralPart`** (a move / configuration node),
   *decoupled from `Section`*, addressing text through the codebase's existing **verbatim-anchor**
   pattern — the same "literal-match-or-orphan" mechanism already used by `SegmentEdit`,
   `GistSegment`, and `ProvenanceMark` (reuse `anchorFor` in `paragraph-helpers.ts`) — over
   arbitrary spans. It must be able to (a) span multiple sections, (b) subdivide one, and (c)
   belong to more than one whole.
2. **A many-to-many map** between structural parts and text-spans/sections, so the heading tree
   and the structural configuration become **two views to reconcile** rather than one welded
   pair. The **treemap** — the app's one *simultaneous* surface
   ([`gestalt-and-text-structure.md`](gestalt-and-text-structure.md) §VII) — is the natural place
   to reconcile them.
3. **Give the whole-grasp an organ of expression.** The passes that already read the whole (root
   analysis, gist Stage-A) should be able to **emit the configuration of structural parts they
   discover**, not only a `'root'` blob keyed to the synthetic section.
4. **Fix the two narrow and-sum offenders.** `getCoachAdvice` should read prose (or the
   whole-derived analysis), not only per-section metadata; `estimateDependencies` should be able
   to infer edges from the whole text / whole analysis, not only from matched per-section
   commitment strings.
5. **Add a NEW structural-part faculty *alongside* Articulation — do not repurpose or destroy
   it.** Articulation keeps its genuine role: *text → good headings* (proposing headers for
   transcripts, imports, and header-less drafts; improving existing ones). The new, **separate**
   function reads the whole and emits `StructuralPart`s (anchored spans, many-to-many to
   sections) — **never** `SegmentEdit`s. Two functions, two purposes: one shapes the *textual
   composition* (headings), the other discovers the *substantive configuration*. They can even
   cooperate — Articulation proposes where a reader-facing heading would help; the structural
   faculty says where the argument's joints actually fall — and their disagreements are exactly
   the substance/text divergences the tool exists to surface.
6. **Trade-offs to name honestly.** Markdown-on-disk is the source of truth and is inherently
   heading-structured, so a structural-part layer must live *alongside* it (in the cache /
   `TestSuite`), keyed by anchors, not headings. That is added complexity and a persistence/
   staleness surface. The payoff is precisely the capacity the current model forecloses: to
   represent, diagnose, and visualise the places where the argument's parts and the text's
   sections come apart.

## VI. What must not change (the fair ledger)

Remediation should preserve, not undo, the genuine Gestalt work already here:

- the **whole-derived** root spec/analysis/diagnostic and their explicit anti-and-sum framing;
- the **structural surround** that makes section passes part-in-whole rather than isolated;
- the **DAG-over-tree** dependency graph, which already lets *relations* diverge from reading
  order (backward arcs) even though *nodes* remain sections;
- **Articulation** as a header tool, per the above;
- the **whole verdict** that refuses to be a tally of section scores.

The tool has taken half of Wertheimer's lesson — read the part in its whole — with real care. The
missing half is the harder and prior one: let the whole decide *what the parts are*, and give
those parts a home that the text's headings do not already own.

---

*Companion theory: [`gestalt-and-text-structure.md`](gestalt-and-text-structure.md) (the two
wholes; §IV.3 Boundary, §IV.4 Sharing, §VII the treemap as simultaneous surface). Doctrine and
the boundary-correctness roadmap item: [`gestalt-design.md`](gestalt-design.md) (item 7).
Centering made visible: [`gestalt-design-III.md`](gestalt-design-III.md). Why the project is
shaped this way: [`VISION.md`](VISION.md). The architecture as built: [`../AGENTS.md`](../AGENTS.md).*
