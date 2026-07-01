# Substance and sequence — the two wholes of a text

> **What this is.** A theory-forward essay. It reads three Wertheimer texts for one
> question: when his part/whole distinction is turned on *a text*, which whole does it
> name — the **argument** or the **composition**? — and how do the two relate? This is a
> reasoning layer, a *why*, not a shipped feature. It sits beside the numbered
> `gestalt-design-*` essays, which built the levers (the radix engine, the
> commitment-mesh, the structural-truth verdicts) that this essay tries to give a single
> account of. It cites them rather than restating them. **When essay and code disagree,
> trust the code.**
>
> **Provenance.** Read directly for this essay: Wertheimer, *On Truth* (*Social
> Research*, 1934) — the anchor; *Syllogisms in Productive Thinking* (1925; tr. Levy,
> 1981); and *Productive Thinking* (1945/1959), ch. 7, "Two Boys Play Badminton; A Girl
> Describes Her Office." *On Truth* supplies the conceptual spine (piece vs. part,
> `t/f` vs `T/F`); the other two supply the machinery — recentering, the simultaneous
> grasp, and the girl's office, which turns out to be the whole problem in miniature.
>
> **Standing.** Proposed / analytical. It names a frontier the current apparatus does not
> yet reach — and argues that the apparatus is *right* up to a boundary and *degenerate*
> past it — but it commits to no change. A note on notation: following *On Truth*, I write
> the object taken as an isolated **piece** as `|a|`, and the same content taken as a
> **part** of a whole as `a·⟨abc⟩` ("a in the whole *abc*"). Piece-truth is `t/f`;
> real, part-in-whole truth is `T/F`.

---

## I. Two structures of the whole

*On Truth* begins with the classical definition — a proposition is true when it
corresponds with its object — and then refuses to rest there: **"But truth demands
more."** The burglar who hired the theft answers the judge, "I did not take it from the
desk." As a piece the statement corresponds to its object; it is `t`. As a *part of the
whole situation* — the hiring, the theft, the alibi — it is a lie; it is `F`. The
proposition's form is `tF`. Real truth, Wertheimer insists, considers the statement *and*
its object "as parts in their related wholes," in their "role," "place," and "function."
And crucially: the same content can be a part of more than one whole — "a part may figure
in two or more different wholes," `a·⟨abc⟩` and `a·⟨amn⟩`, and its truth can flip between
them.

Now point this at *a text*, and a fork appears that Wertheimer never had to name because
he was not building a writing tool. A given passage — a sentence, a paragraph, a
subsection — is simultaneously a part of **two different wholes**:

1. **The substantive whole** — the argument, the essential idea as it develops. Here the
   passage is a *move*: a premise, a distinction, an objection, a concession, the
   discharge of a commitment. Its neighbours are the moves it depends on and the moves
   that depend on it.
2. **The textual whole** — the composition, the document as written. Here the passage is
   a *block*: a subsection inside a section inside the document — the H1-blocks are
   linearly-sequenced parts of the whole document, the H2-blocks linearly-sequenced parts
   of their H1, and so on down. Its neighbours are what physically precedes and follows
   it, and what contains it.

These are not the same whole. The very same sentence is at once "the step that earns the
main claim" and "the third paragraph of §2.1." Its role, place, and function — Wertheimer's
triad — can be excellent in one and disastrous in the other. To ask whether a passage is a
*part* or a mere *piece* is therefore two questions, not one, and the answers can come
apart.

The tool already carries both wholes as distinct data. The **textual whole** is the
`Section` tree (`src/types/index.ts`): a strict single-parent hierarchy keyed on heading
level, linear within the markdown file (`startLine`/`endLine` preserve reading order),
drawn as a treemap whose tile **area is `wordCount`**. The **substantive whole** is
another structure laid over the same sections: `SectionSpec` (`mainClaim`,
`requiredMoves`, `incomingContext`, `outgoingCommitments`), `SectionAnalysis`, and the
`Dependency` graph — which the radix engine (`src/features/modals/topo/topo-centering.ts`)
treats as a **directed acyclic graph** of prerequisite→dependent edges. Two structures,
one set of sections. The rest of this essay is about their relationship: where they
converge, where they come apart, and what the coming-apart demands of a tool built to help
someone write.

## II. Piecemeal and real truth, in each register

Wertheimer's four combinations — `tF`, `tT`, `fF`, `fT`, plus the limiting `t(?)` — apply
to *both* registers, and reading them twice is the fastest way to see that the registers
are genuinely two.

**In the substantive register**, a claim can be piece-true yet part-false. The burglar is
the pure case; the doctored balance sheet is the everyday one — every figure correct, the
whole a deception "by shifting the emphasis, displacing the center of gravity"
(*Umcentrierung*). A locally valid lemma can sever a join the argument needed. The tool
names this exact species: `StructuralTruth` has the value `'tF'` — glossed in the type as
"locally better, the whole worse / a join severed" — and `CommitmentFinding` has the kind
`'center-of-gravity'`, "locally true, yet in its place pulls against what the whole needs."
That is `On Truth`'s displaced center of gravity, compiled.

**In the textual register**, a block can be piece-fine — well-written, internally
coherent, accurate — and still part-false, because its *placement*, its *level*, or its
*sequence* misrepresents its role. This is the register the girl's office lives in. She
describes her workplace and states every relation "correctly and completely" — yet centred
on her own ego, in the order the people occur to her, the description is a tangle. *"Oh,
but I have told you everything," she answered. Nevertheless, I was in the dark.* No datum
is false. No datum is missing. The falsity is entirely in the *arrangement* — the same
crime as the heavy-type war report, where identical words in the general staff's dispatch
were made to yield "entirely opposite impressions." Structure lies while content tells the
truth.

**`fT` appears in both, and is worth keeping.** Substantively, `fT` is the caricature —
"false in practically every detail and yet a truer representation of its object than a
photograph." The tool honours this too: `StructuralTruth` `'fT'` is "rougher in detail yet
truer to the whole (a brave simplification)." Textually, `fT` is the exposition that plays
fast and loose with specifics but lands the shape — the vivid ordering that distorts a
local fact to make the whole legible. *Se non è vero, è ben trovato.*

And then the case that is not one of the four but the horizon of all of them: **`t(?)`.**
"Tell me the truth about this," someone asks, and the answer "may contain many facts that
are individually valid and can leave the questioner entirely ignorant… if I have not
grasped the inner connections of the whole." The girl's `t(?)` — everything told, nothing
understood — is the reader's-eye view of a substance/text mismatch. When true substance is
run through a bad linearization, the reader receives every piece and reassembles no whole.
**`t(?)` is the characteristic pathology of the two-wholes problem**: not falsehood, but a
whole made ungraspable by the way its parts were laid in a line. Most of what follows is an
anatomy of how `t(?)` is produced — and it is produced, overwhelmingly, at the seam where a
non-linear substance is forced into a linear text.

## III. Convergence — when the two wholes coincide

The two wholes converge when the substance is *itself* a sequence or a nesting, and the
composition simply mirrors it.

A proof converges: premises, then what they force; *modus barbara* is written major, minor,
conclusion, and to read it in order *is* to think it. A chronological narrative converges.
A cleanly nested argument converges: a thesis whose three sub-arguments are three
subsections, each self-contained, is a substantive tree drawn as a heading tree. In all
these, good exposition *is* faithful linearization — reading order equals dependence order,
containment equals subordination. In the tool's terms the `Dependency` graph's arcs all run
forward through the `Section` order: the radix engine's **backward-arc count is zero** and
its **miscentering scalar is zero**. Nothing is out of place because the substance had a
place for everything and the text kept it.

But notice what even perfect convergence is *for*. In the footnote that turns his
*Syllogisms* essay on itself, Wertheimer says the essay's own achievement is a
**recentering** — leading the reader from the syllogism seen as a "mere sum of attributes"
(`S a₁`) to the syllogism seen as "the objectively existing interlocking of the parts"
(`S a₂`). The linear text is the *vehicle*; the destination is a structure grasped **all at
once**. Gauss does not add `1+2+⋯+n` in sequence; he *sees* the configuration
`(1+n)+(2+(n−1))+⋯` and is done. A converged text is a ladder built so straight that the
reader can climb it without noticing — and then kick it away, holding the whole
simultaneously. So even here the telos is beyond the sequence. This is the seed of the
frontier in §VII, and it is worth stating as a progression of media, each buying a little
more freedom from the line:

> **1-D prose** (pure sequence) → **nested headings** (sequence *plus* a containment axis)
> → the **2-D treemap** (a spatial field taken in at a glance).

Each step is a partial escape from linearity. The treemap is the furthest the tool has gone.

## IV. Divergence — four asymmetries

Text is linear **not because the app forces it** but because prose is read in time: one
word after another, one section after the next. The girl's description is a sequence for
the same reason speech is a sequence. So whenever the substance is *not* itself a sequence,
divergence is not a defect to be fixed but a structural fact to be managed. It shows up
along four asymmetries.

### 1. Linearity — the space of substance-structures

The textual whole is fixed in shape: a nested-linear tree. The substantive whole is not.
Run the substance through the following gallery and watch what the line does to it.

- **(a) Linear chain** (a total order, `A→B→C`). Maps isomorphically. The text *is* the
  substance. Proofs and deductions live here; convergence (§III) is automatic.
- **(b) Tree / hierarchy** (nested containment). Maps to the heading tree — but the
  *traversal order* is a free variable. Depth-first or breadth-first? Which child first?
  The girl's office is a tree (boss → two secretaries → four clerks); her failure is a bad
  *walk* of a correct tree — ego-first instead of root-first. The lesson is precise and the
  tool encodes it: centring is "not a matter of the distribution of numbers of relations" —
  by relation-count the boss `B` is a *homotype* of the girl and of `E` — but of
  **direction**: "the center is the source of the arrows." The good linearization starts at
  the radix.
- **(c) DAG / partial order** (dependencies with no single line; a claim resting on
  several, some claims independent). Many valid topological sorts exist; the text must pick
  one, and the pick reveals or hides. **This is exactly what the tool's `Dependency` graph
  is.** `topo-centering.ts` ranks it by longest path ("sources at 0, sinks at max: *boss →
  secretaries → clerks*") — a canonical linearization — and flags **backward arcs**, arcs
  "flowing against authored order": places where reading order contradicts dependence
  order. Here divergence is not merely real, it is *computed*, and the code's own tests call
  a backward arc "the two-wings distortion" — the girl's office, named in a unit test.
- **(d) Co-constitutive / cyclic web** (implicit definition; concepts that define one
  another). *On Truth* states the danger exactly: "if a part is really taken from a system,
  then the remainder, implicitly defined, is substantially changed." A web has no
  foundation; every linearization must present *as prior* something that is in fact
  co-constituted — an unavoidable little `tF` at every seam. Here the tool's model begins to
  strain: the cycle is real, and `topo-centering.ts` survives it only by being "cycle-safe
  via SCC condensation" — it *collapses* each cycle to a single node to recover a DAG. That
  collapse is not a neutral convenience. It is a philosophical decision to impose an order
  on the orderless so that the rank machinery can run.
- **(e) Simultaneous configuration / Gestalt.** Gauss again. There is no "first" pair; the
  regrouping is a configuration *seen*, not a sequence *performed*. Prose can only *stage*
  it — "pair the first term with the last…" — and the staging is a ladder to be kicked away.
  Divergence is here total: the substance has **no intrinsic order at all**, so any linear
  text is pure scaffolding. And this is where the tool's apparatus **degenerates**: a fully
  co-constitutive whole is one big strongly-connected component; SCC condensation collapses
  it to a single node; every section lands at rank 0; the radix is undefined and the
  miscentering scalar is meaningless. *Precisely where the substance is most holistic, the
  order-based model goes silent.* That silence is a finding, not a bug — see §VII.
- **(f) Centred radial / star** (one radix, many consequences radiating out). Boy A's
  insight — that a good game needs reciprocity — radiates to cooperation, to fairness, to
  courts of justice; it is a hub, not a chain and not a containment-tree. Linearizing a hub
  forces a choice prose cannot dodge: **announce the centre then spool out the spokes**
  (deductive, what Wertheimer calls "validity" order) or **build up to the centre**
  (inductive, his "logical-genetic" order). Same substance, two faithful and very different
  texts.

### 2. Centering

Grant a linearization; *which centre* organizes it? The substance has a natural centre —
the radix, "the source of the arrows, the heart of the matter." The text may be centred
elsewhere: on the ego (the girl), on the **order of discovery** (the lawyer relives "I
looked, I couldn't find it, then it dawned on me" where the argument wants "the receipt
concerned suit A; the A files were burned; therefore it is gone"), or on sheer rhetorical
convenience. Reading the centre off arrow-*direction* rather than connection-*count* is the
move [`gestalt-design-III.md`](gestalt-design-III.md) already mechanized; I only add that
the miscentering it measures is one face of the substance/text gap.

### 3. Boundary

"A Gestalt limits itself." A substantive whole has natural edges — what belongs to it and
what does not — and heading breaks can miscut them: one argument split across two sections,
or two arguments crammed into one. The treemap makes block-boundaries visible and
draggable, but whether a boundary is *right* is, Wertheimer insists, "subject to
examination on grounds of being correct or incorrect," not free choice. Boundary-correctness
is roadmap item 7 in [`gestalt-design.md`](gestalt-design.md); the two-wholes framing says
*why* it is not cosmetic: a miscut boundary is a place where the textual whole denies the
substantive whole its own edge.

### 4. Sharing

*On Truth*'s deepest structural point is that a part may belong to two wholes. But the
`Section` tree is **single-parent**: a block sits under exactly one heading. So a passage
that does real work in two arguments must be filed under one and cross-referenced from the
other — or, worse, duplicated, which is the piecemeal sin in its purest form (a part torn
into two pieces). The tool has already met this limit and routed around it: the `Dependency`
graph permits in- and out-degree greater than one — it is a DAG laid *over* the tree.
**That is the two-wholes tension made into two data structures**: a text can only be
*read* as a tree, because reading is sequential and nesting is the most a sequence can
carry, but it must be *thought* as a graph, because ideas depend on many ideas at once.

## V. Draft under construction vs. finished text

The two contexts the problem lives in are not symmetric, and conflating them causes real
mistakes.

**In a draft, divergence is the engine, not the fault.** A draft's composition almost
always encodes the writer's *first, one-sided whole-view* — Wertheimer's inadequate
first centring — or the order in which things were discovered: goal-centred, ego-centred,
provisional. Productive revision simply *is* recentering: the "click" in which a section's
real role surfaces (`S a₁ → S a₂`), the badminton shift from "I against you" to "we." A
backward arc in a draft is usually thinking-in-progress — you wrote `C` before you saw it
needed `B` first — and the right response is to re-sequence, not to panic. The tool's
gap→vector next-actions and its recentering moves ([`gestalt-design.md`](gestalt-design.md),
[`gestalt-design-III.md`](gestalt-design-III.md)) are built for exactly this. The deepest
of them is Wertheimer's permission to treat **"the goal itself as a part"** — to change
what a section is *for* when the whole requires it; "to stick to set goals is often sheer
thoughtlessness." The failure mode is the opposite: perseveration, clinging to the first
outline because it is the outline you have.

**In a finished text, there are two independent axes of evaluation**, and their
independence is the whole story:

1. **Substantive truth** — is the argument really `T`?
2. **Presentational fidelity** — does the composition *do justice* to the substance's
   configuration, or does it leave the reader in `t(?)`?

These are orthogonal. A true argument can be so mis-linearized that the reader gets nothing
(`tT` substance delivered as `t(?)`); a false argument can be impeccably composed (the
doctored balance, the heavy-type dispatch). The treemap is the tool's *diagnostic diagram*,
and *A Girl Describes Her Office* is explicit that a **diagram** succeeds where a **list**
fails: looking at the office as a drawing, one sees it is "distorted," "two wings which need
some adjustment," and the correction follows. A list hides centring; a diagram reveals it.

But one caution the current metric cannot yet voice, and the two-wholes framing forces into
the open: **for substance of kinds (d) and (e), a nonzero miscentering may be unavoidable
and not a fault.** The backward-arc/miscentering scalar presupposes that the substance *is*
a partial order and that reading-order *ought* to track dependence-order. When the substance
has no intrinsic order — a web, a simultaneous configuration — some residual "backwardness"
is simply the shadow of forcing a configuration through a one-dimensional channel. The
metric misfires by construction, not by defect. A finished text can be as faithful as prose
allows and still carry irreducible miscentering, because prose is a line and the thing was
not.

## VI. The mapping space

Put the two structures on two axes. The **substance** ranges over the gallery of §IV.1
(chain, tree, DAG, web, configuration, star); the **text** is the single fixed shape
(nested-linear tree). Writing is the choice of a map from the first to the second, and the
interesting cases are the cells of that grid.

- **Close alignment.** Chain → sequence (the proof); tree → heading-tree (well-nested
  exposition). Reading order equals dependence order; backward arcs vanish. This is the
  target every expository writer is aiming at, usually without a name for it.
- **Complete divergence.** Configuration → sequence: Gauss, where the naïve linear text
  `1+2+⋯+n` actively *hides* the insight it exists to convey. Web → sequence: a coherentist
  system forced to begin somewhere, every possible beginning a small lie about what depends
  on what. Tree → ego-traversal: the girl — the right tree, walked from the wrong node.
- **The instructive middles.**
  - **Size ≠ structural weight.** The treemap sizes tiles by `wordCount`, but a one-line
    simultaneous insight (Gauss) may need pages of scaffolding while the load-bearing radix
    is a sentence. Text-size and structural load come apart — [`gestalt-design-IV.md`](gestalt-design-IV.md)'s
    *si duo faciunt idem, non est idem* (equal magnitude, unequal role) and
    [`gestalt-design-III.md`](gestalt-design-III.md)'s deferred "area = structural load" are
    the two ends of this observation. A treemap that looks balanced can be centred entirely
    wrong.
  - **Radial substance, order as rhetoric.** Lead-with-centre vs. build-to-centre is not a
    matter of correctness but of the reader you are writing for; the *same* star yields two
    honest texts. The choice is made, Wertheimer would say, *sub specie* of the question the
    reader brings — "the recentering occurs *sub specie* of `?P`."
  - **Block-level `tF`.** A block correctly *placed* in the tree can still play the wrong
    *substantive* role — locally fine, its centre of gravity displaced. This is the
    cross-boundary commitment-mesh check: the block is a good piece and a bad part.
  - **A DAG with several true faces.** Different topological sorts foreground different
    sub-arguments; there may be *no single best* linear order, only orders-good-for-a-purpose.
    "Which linearization?" is then itself a `?P` question, not a fact to be discovered.

The moral of the grid: the writer's task is not "outlining." It is to choose a
linearization-and-centering that makes the substantive Gestalt **re-graspable** — to convert
a possibly-non-linear whole into a sequence from which a reader can *reassemble* that whole.
Where the substance is a sequence, this is transcription. Where it is a configuration, it is
**staging**: building a ladder to a view you intend the reader to hold after the ladder is
gone.

## VII. The frontier for the tool

The through-line of every section above is a single asymmetry: **text is linear because
reading is temporal, and the treemap is the tool's one escape into simultaneity.** The
girl-office lesson is that the escape matters — a *list* hides centring, a *diagram* reveals
it — and the treemap is that diagram, a spatial field seen at a glance. Today it displays
the *textual* whole: the `Section` tree, area by `wordCount`. But a surface that can hold a
*simultaneous configuration* is exactly what the non-sequential substance of kinds (d),
(e), and (f) has nowhere else to go.

So the deferred "treemap centering" of [`gestalt-design-III.md`](gestalt-design-III.md) —
area as structural load, drill-and-re-root — is, on this reading, deeper than a re-encoding
of area. The real prize is a **simultaneous display of the substantive configuration that
need not be a tree or a sequence**: the DAG shown with its radix and its backward arcs, the
web shown *as a web* rather than condensed away, the star with its hub at the centre. The
RADIX projection already linearizes the DAG by rank along a spatial axis — "reading the
y-axis is reading the order of dependence, not the table of contents." The frontier is to
know when to *stop* linearizing: to show the configuration where the substance refuses the
line.

That reframes what the current apparatus is *for*. Rank, radix, backward-arc, and
miscentering all presuppose the substance is a partial order — that "which comes first?" is
always a meaningful question. For chain, tree, and DAG substance that presupposition is true
and the machinery is powerful. For web and configuration substance it is false, and the
machinery degenerates in the exact way §IV.1(e) describes: SCC-collapse, undefined radix, a
miscentering number that measures nothing. The honest next step is not to force those cases
through the rank engine but to **detect** them and offer a different view. Two directions
follow — stated as analysis, not as committed levers:

1. **Diagnose the shape before ranking it.** When the dependency graph is dominated by one
   large strongly-connected component (or is near-complete, or a shallow hub), the tool
   should *say so* — "this reads as a simultaneous configuration, not a sequence" — instead
   of reporting a meaningless rank-0 / miscentering-1. Detecting that a substance is *not
   essentially sequential* is itself a structural truth worth surfacing.
2. **Let the treemap carry substance, not only size.** Treat the one all-at-once surface the
   tool has as a candidate canvas for the *argument's* configuration, so a writer can see the
   shape of the thing in the single place the app shows things simultaneously — the place
   where centring becomes visible as it never can in a linear outline.

Both keep faith with the thesis in [`VISION.md`](VISION.md): show *structure*, not a
flattened restatement. A summary hands back the pieces in a sum; the two-wholes analysis
asks for the opposite — a rendering in which the reader can recover the whole.

## VIII. Coda — truth and justice

*On Truth* does not end in logic; it ends in ethics. Truth, Wertheimer writes, lives "more
in what a man does" than in what he states, and there is "an inner connection between truth
and justice." The girl centres the office on herself; boy A stops centring the game on his
ego; and miscentering, the essay warns, is "the more energetically disguised as true
centering the less it is so in fact."

For a writer this is not a flourish. To compose is to **do justice to the subject matter** —
to centre the text on the thing itself and not on the ego, the convenience, or the accident
of the order in which the ideas arrived. A text that is piece-perfect and whole-blind —
every block correct, the reader in the dark, `t(?)` — is not merely unclear. In
Wertheimer's strong sense it is a small injustice to its own content: it has all the parts
and denies them their whole. The reason to externalize the two wholes at all — to let a
writer *see* where composition and substance diverge — is to make that justice cheaper to
do. The tool's job was never to summarize, never to hand back the pieces in sum. It is to
help the writer find the one linearization, among the many the medium allows, that lets a
reader climb back to the whole — to turn `t(?)` into `T`.

---

*Companion readings: the doctrine and Tier 1,
[`gestalt-design.md`](gestalt-design.md); the ADHD re-sequencing,
[`gestalt-design-II.md`](gestalt-design-II.md); centering made visible,
[`gestalt-design-III.md`](gestalt-design-III.md); concrete thinking and number-Gestalts,
[`gestalt-design-IV.md`](gestalt-design-IV.md). Why the project is shaped this way:
[`VISION.md`](VISION.md). The architecture as built: [`../AGENTS.md`](../AGENTS.md).*
