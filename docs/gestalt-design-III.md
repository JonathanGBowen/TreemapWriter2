# Gestalt-theoretic design, a third reading — centering, made visible

> **What this is.** A *third* design essay, after a direct re-encounter with five
> Wertheimer sources read this time **for one operation specifically: centering /
> recentering (*Umzentrierung*).** The first essay
> ([`gestalt-design.md`](gestalt-design.md)) established the doctrine and Tier 1;
> the second ([`gestalt-design-II.md`](gestalt-design-II.md)) re-sequenced the
> roadmap around ADHD and named the deferred visual layers (L3b: the strain
> whole-view / "directional vector connectors"). This one does not restate them —
> it isolates *centering*, shows that the tool already **had** Wertheimer's
> relational network and was centering it the wrong way, and records the fix that
> shipped. When essay and code disagree, trust the code. For the felt **pervasive
> quality** beneath all this structure — and Dewey's warning that a centering
> readout is worth only as much as it returns the writer to a heightened
> qualitative apprehension — see the companion [`dewey-design.md`](dewey-design.md).
>
> **Provenance.** Read directly for this essay: *Productive Thinking* — the
> Introduction, "Two Boys Play Badminton / A Girl Describes Her Office" (Chap. 7),
> the "Dynamics and Logic of Productive Thinking" conclusion, and the
> "Arbitrary Component and Necessary Part" appendix — and "On the Concept of
> Democracy" (1937).
>
> **A note on standing.** Unlike essay II, this layer is **built**, not proposed.
> The migration-log entry (2026-06-26) records the change and how to verify it.

---

## I. The fresh encounter — centering, in the author's own terms

Across the five texts one operation recurs and is named most precisely in
"A Girl Describes Her Office": **centering** is "the way one views the parts, the
items in a situation, their meaning and role as determined in regard to a center,
a core, or radix." Its decisive feature is **directional**, and Wertheimer is
emphatic that this is *not* a matter of counting connections:

> "The deeper meaning of being the center does not rest on the fact that what is
> single is outstanding; it is more important that the center is the source of the
> arrows, that it is the heart of the matter."

The girl's office is the worked example. She describes a relational network that
is *correct and complete* — every relation stated — yet **miscentered**: she
centers it on her own ego, the order in which the people occur to her. The
logician's degree-count table (Fig. 120) cannot fix this: by relation-numbers the
boss B is a *homotype* of the girl and of E. Only the **direction** of the arrows
reveals B as the radix — "B is at the source of the arrows… Ego is not." The cure
is to re-lay the network so the boss leads, then the secretaries, then the clerks:
the "two-wings" distortion resolves into a clean hierarchy.

Three corollaries sharpen the lever:

- **The warning (the Conclusion).** The Prägnanz tendency can run toward
  "premature closure," "a seductive simplification" — a picture made to *look*
  tidy without revealing structural truth. Tidiness is not centering.
- **Arbitrary component vs. necessary part (the appendix; the melody example).**
  *si duo faciunt idem, non est idem.* Two items equal by magnitude can differ
  utterly in structural role; restructuring turns an arbitrary component into a
  necessary part. Equal word count is not equal structural load.
- **The part-system (Democracy).** Every item must be read "in its place, in its
  role, in its function as a part" of the hierarchical whole, centered on the
  radix (there: justice/reason), with the rest secondary — "not accidental
  additions but logically determining in the structure."

## II. The diagnosis — the topology modal *was* the miscentering girl's office

The Argument Topology modal (`src/features/modals/DependencyGraphModal.tsx`) holds
exactly the object Wertheimer analyses: a **directed** relational network. Its data
layer (`topo/topo-derive.ts`) already exposes the direction — `arcs` with
`source` (prerequisite) → `target` (dependent), plus `inbound()` ("DEPENDS ON")
and `outbound()` ("FEEDS"). Everything needed to find "the source of the arrows"
was present and unused for it.

And the modal was centering that network the two wrong ways the texts name:

1. **On authored order.** `topo-sim-atlas.ts initialLayout()` lays sections out
   "one column per Part in chapter order." That is the girl's ego-centered first
   description — the order the parts occur to the author — taken as the structure.
2. **Groomed for neatness.** `metrics()` reported `{len, cross}` and the **OPTIMISE**
   button minimised them. Minimising route length and crossing count is precisely
   the "seductive simplification / premature closure" the Conclusion warns against:
   it makes the picture *look* clean without surfacing the radix.

Meanwhile real centering existed only as **AI text diagnostics** on a single
section (`recenter.md`, `reconstruct-whole.md`) — never in any visualization.

## III. What shipped — centering as a computed, visible layer

**The radix engine** (`topo/topo-centering.ts`, pure, unit-tested). From the arc
directions alone it computes, per section: structural **rank** (longest-path layer
over the dependency DAG — sources at 0, sinks at max, cycle-safe via SCC
condensation), **centrality** (the size of the transitive-dependents set — "how
much of the document rests on this," necessary-part-hood), and the **radix** /
**telos** / **in-cycle** flags. Document-wide it computes the **backward arcs** (a
prerequisite that sits *after* its dependent in reading order — Wertheimer's
two-wings distortion) and a **miscentering** scalar. This is the boss-finding move,
mechanised: the center is read off the arrows, not the degree count.

That engine feeds five surfaces (the topology modal threads `centering` to all):

- **Recenter on any node** (`recenterField` in `topo-centering.ts`, consumed by
  `TopoLand` / `TopoMap` / `TopoRadix`). Selecting a section re-reads the *whole
  field* relative to it — upstream (what it rests on) vs downstream (what rests on
  it) vs unrelated — the transitive closures, not the old 1-hop neighbours. This
  is the badminton recentering made spatial: "all the items change their meaning."
  It is the visual sibling of `proposeRecenterings`.
- **The RADIX projection** (`topo-layout-radix.ts` + `TopoRadix.tsx`, a third
  toggle beside ATLAS/SPINE). Here **position encodes structural rank**: radix at
  the top pole, telos at the bottom, every part layered by how much stands under
  it — "boss → secretaries → clerks." Reading the y-axis is reading the order of
  dependence, not the table of contents. Static and deterministic; no force sim.
- **Honest miscentering** (`StructuralReadout.tsx`). The FilterBar now leads with
  **BACKWARD · RANK SPAN · MISCENTER** (structural truth) and demotes ROUTE LEN /
  CROSS to a dimmed, ATLAS-only afterthought — the deliberate, philosophical
  demotion of the cosmetic metric. Backward arcs render with a warning chevron;
  radix/telos carry a distinct purple **PoleGlyph** (a layer disjoint from the
  cyan dependency arcs, the Part hues, and the status pips).
- **The inspector** names a section's place: RADIX/TELOS/CYCLE badges, its rank,
  and "rests on N · M rest on this."
- **The AI moves, grounded.** `formatStructuralEvidence` feeds the computed
  topology into `recenter.md` (which recentering serves the whole) and, fenced as
  alignment-weight only, into `reconstruct-whole.md` (how much a drift matters) —
  uniting the visual center and the textual one.

This realises, in the one venue where it is feasible, the layer essay II deferred
as L3b ("directional vector connectors / the strain whole-view"): the topology
modal keys on stable `Section.id` and is free of the treemap accessibility
constraint that killed the per-tile heatmap.

## IV. Deliberately deferred

- **Treemap centering** (area = structural load not word count; drill/re-root).
  Gated on the documented accessibility history (the killed heatmap) and the
  stable-section-ID work. Prove the idea in the topology venue first.
- **Richer edge semantics** — Wertheimer's structural "and / but / nevertheless /
  violates" beyond `prerequisite | reference`. Touches the domain types
  (`src/types/index.ts`): extend, never collapse. Its own change.
- **Strain register wiring** — feeding the topology trouble-regions (broken / weak
  / fog / backward / cycle) into the Structural-Tension Register as S₁→S₂ vectors.

---

*First essay: [`gestalt-design.md`](gestalt-design.md). Second:
[`gestalt-design-II.md`](gestalt-design-II.md). Why the project is shaped this way:
[`VISION.md`](VISION.md). What's being worked on: [`../STATUS.md`](../STATUS.md).
The architecture as built: [`../AGENTS.md`](../AGENTS.md).*
