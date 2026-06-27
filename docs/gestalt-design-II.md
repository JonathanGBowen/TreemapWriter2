# Gestalt-theoretic design, a second reading — the whole that holds the part

> **What this is.** A *second* design essay, written after a fresh, direct
> encounter with five Wertheimer sources. The first essay
> ([`gestalt-design.md`](gestalt-design.md)) established the doctrine, recorded
> what shipped (Tier 1: part-not-piece context), and laid out roadmap items 3–7
> and a prompt-by-prompt pass. This one does not restate that — it **adds the
> levers a direct re-reading surfaces that the first underweights**, and
> **re-sequences the roadmap around the one constraint that matters most here:
> ADHD.** Where the two essays touch the same idea, this one cross-links rather
> than copies (the doctrine table and the Tier-1 record live in the first essay;
> the type inventory lives in the code). When essay and code disagree, trust the
> code. A **Deweyan companion** ([`dewey-design.md`](dewey-design.md)) reads the
> same problem through *Qualitative Thought* (1930) — the felt **pervasive
> quality** beneath the structure these essays build, and a first-class home for
> the *had-but-not-yet-stated* trouble that is the ADHD writer's hardest moment.
>
> **Provenance.** Read directly for this essay: *Syllogisms in Productive
> Thinking* (the Levy 1981 reprint of Wertheimer), *On the Concept of Democracy*
> (1937), *Some Problems in the Theory of Ethics* (1935), and *Gestalt Theory*
> (1938). *On Truth* (1934) is cross-referenced from the first essay (tF/fT,
> *Umzentrierung*), not re-derived here.
>
> **A note on standing.** This was a *proposal* layer when written — it named exact
> code sites for a later build. **Status (2026-06-26): most of it has since shipped**
> (Phases 1–3 + essay III; see STATUS.md → "Gestalt roadmap" and the migration-log,
> which are canonical). What remains deferred is the treemap *Tension Lens* / strain
> whole-view (L3b) and boundary-correctness (first-essay item 7). Read the levers below
> for the *why*; trust the code for the *what*.

---

## I. The fresh encounter — four texts, read for the part/whole

The first essay quarried these sources for a doctrine table. Read again, *as
arguments rather than as quotations*, three of them turn out to carry a tool
lever the first essay either misses or buries. I take them one at a time, in the
author's own terms, before turning to the tool.

### 1. *Syllogisms in Productive Thinking* — the present-but-empty move

Wertheimer's subject is the most domesticated object in logic: the modus
barbara, *all M are P; S is M; therefore S is P*. His observation is
phenomenological and unsettling. **The same valid syllogism, performed by the
same person, is sometimes a genuine advance and sometimes nothing at all.** Run
mechanically — "good old Caius is a man, therefore mortal" — it "seems amazingly
meager, rather irrelevant, nay empty — saying nothing"; the conclusion "easily
appears as a kind of recapitulation, a mere statement of something one basically
already knows, albeit in an externally new form." Run in live thinking, the
identical form "really forges ahead"; one "senses that somehow one has made real
progress; there is something here of the beauty of penetrating, forward-moving
knowledge." His question — *what is the difference?* — is the dissertation
writer's question, and no current feature of this tool asks it.

The failure this names is not the missing move. It is the move that is **present,
valid, locally well-formed, and inert** — the paragraph whose conclusion the
reader already held before reading it; the chapter that restates its premises in
"an externally new form" and calls the restatement a result. Call it the
*petitio* failure. It is the single most characteristic disease of the
overlong, overworked dissertation, and it is invisible to a checker that only
asks "is each required move *there*?" A document can pass every present/partial/
missing test and still forge ahead nowhere. (See L1.)

### 2. *On the Concept of Democracy* — subtractive abstraction and the caricature

This essay is, almost incidentally, the cleanest worked example of part-vs-piece
in the whole corpus, because Wertheimer chooses a case where the piecemeal
reading is *seductive*. The "old traditional" way to say what democracy is:
compare it with other forms of government, list the similarities and
differences, collect the differentiae — "an and-sum of characteristics." He
grants the method "its merits," then names its danger exactly: "such an item is
likely to be used blindly, with no reference to the role it plays in the
hierarchical logical structure; the view is one-sided, the mental horizon
artificially narrowed."

Then the demonstration. Take "majority rule" *as an item for itself, without
regard to the function it has in democracy*, and you blind yourself to what it
means. A free vote (not vote by intimidation), full information and open
discussion, the appeal to "what is right and what is wrong" over the mere
counting of noses, a particular attitude toward the defeated minority — "these
are **not accidental additions but logically determining in the structure**."
Strip the function and the very same procedure becomes "a caricature": majority
decision between two profit-interest groups, the majority crushing the minority
because "we have the majority, so what?" — the piece, torn from the whole,
**inverts into its opposite while every word of the definition stays true.**

That last clause is the precise mechanism the first essay calls `tF` (true as a
piece, false as a part) and locates in *On Truth*. Democracy gives it a second,
independent home and — crucially — names the *generative* error behind it:
**subtractive abstraction**, the and-sum, the item severed from its role. This
matters for the tool because the tool *itself performs abstraction* every time it
writes a `SectionSpec`. (See L2.)

### 3. *Some Problems in the Theory of Ethics* — the narrowing of the field

Wertheimer's target is ethical relativism: the doctrine that different value
systems are "merely different sets of facts," each "with an absolutely equal
claim to recognition." His structural diagnosis of *why the doctrine looks valid*
is the gift to an accessibility tool. The relativist treats values "torn from
their determining nexus and compare[s] them as such" — facts "of equal
theoretical rank," catalogued. The inference from *different evaluations* to
*incommensurable axioms* is valid "if the objective were here nothing more than a
mere cataloguing of naked facts." It is the and-sum again, raised to a theory of
everything.

And then the human mechanism, in one phrase the first essay quotes but does not
build on. Men in a crowd act in ways they cannot afterward understand; the
behavior "was possible only because of a **tremendous narrowing of the field of
consciousness**." Blindness is not the absence of a fact. It is a *structural*
event — the field contracts, the determining nexus drops out of view, and a part
gets taken for a whole. **This is the most exact description of ADHD's executive
load I have found in the literature, and it predates the construct by fifty
years.** Hyperfocus is a narrowing of the field; the displaced center of gravity
is a narrowing of the field; the stall in front of "work on your dissertation" is
a field so wide it has no center at all. The tool's whole reason to exist can be
stated in Wertheimer's words: **to keep the field from narrowing — to keep the
whole present while a part is worked.** (See §IV.)

### 4. *Gestalt Theory* (1938) — inner necessity, and the symphony

The 1938 lecture supplies the two ideas the activation layer and the whole-view
need. First, **dynamics**. A field "tends to become fraught with meaning,
homogeneous, to be dominated by an inner necessity"; "from its whole-tendencies
the field also derives its dynamics." The incomplete whole is not inert and
waiting — it is *under tension*, and the tension points. Second, the **symphony**:
his "third kind of set," where "the whole conditions of a set determine the
character and place of any" member, and his closing image — a Beethoven symphony
"where from a part of the whole we could grasp something of the inner structure
of the whole itself." That image is also a *test*: in a real whole, the part
carries the whole's signature; a part from which the whole cannot be recovered
has stopped being a part. (See L3.)

---

## II. Four levers (the proposal)

Each lever: *text → idea → tool change → code site → ADHD rationale.* Two are
new; two sharpen roadmap items 3–6 of the first essay. All four map onto the
emphases chosen for this work — smarter structural analysis, externalizing the
whole, the ADHD activation layer, and the prompt pass (§III).

### L1 · The present-but-empty move check *(smarter analysis — NEW)*

**Text.** *Syllogisms*: the valid move that "says nothing," recapitulation in "an
externally new form," versus the move that "forges ahead."

**Idea.** Today a move is scored on one axis — `MoveStatus = present | partial |
missing | unclear` (`src/types/index.ts`), reduced to a treemap color by
`diagnosticToStatus` (`src/lib/diagnostic-helpers.ts`). Every value on that axis
asks *is the move there?* None asks *does the move advance?* Add an **orthogonal
axis: `productive | recapitulative`** (working names) — does this move give the
reader something not already in hand, or restate what the section's own premises
and its incoming context already secured? A move can be `present` and
`recapitulative` at once; that pairing is the petitio paragraph, and it is
exactly the locally-valid, globally-empty prose that bloats a dissertation.

**Code site (for the later build).** Extend `MoveResult` with the new axis
(`src/types/index.ts`); teach `diagnostic.md` (`src/services/prompts/`) to judge
it, *using the incoming context already available in the structural surround* —
"new relative to what?" is answerable only against the whole. Surface it as a
quiet glyph on the move, not a fail (a recapitulative move is often a *deletion*
opportunity, the most ADHD-friendly edit there is).

**ADHD rationale.** Perfectionist revision adds; it rarely subtracts. A check
that can say "this paragraph is true and you can cut it" converts a vague unease
("this feels padded") into a located, low-risk action.

### L2 · Commitment-mesh + center-of-gravity, sharpened *(smarter analysis — extends item 3)*

**Text.** *Democracy*: the differentia "used blindly, with no reference to the
role it plays"; the additions that are "not accidental … but logically
determining in the structure." *On Truth* (via the first essay): displaced center
of gravity, `tF`.

**Idea.** The first essay's item 3 already proposes a commitment-mesh test. The
Democracy reading sharpens *what counts as a finding and how to name it.* An
`incomingContext` that **no upstream `outgoingCommitment` satisfies** is not a
soft "coherence note" — it is a structural break, a part whose role-giving nexus
is absent, and it should be a **first-class diagnostic finding** with the
upstream and downstream sections named. The mirror case — an `outgoingCommitment`
that nothing downstream consumes — is the dissertation's dead-end promise. And
the center-of-gravity check gets the Democracy idiom: *is this section locally
true but, in its place in the whole, doing the opposite of what the whole needs?*
(the chapter that, defending the thesis, quietly concedes it).

**Code site.** A finding type on `DiagnosticResult` (`src/types/index.ts`) plus
`diagnostic.md`; the derivation can reuse `buildStructuralSurround`
(`src/lib/diagnostic-helpers.ts`), which already assembles upstream commitments
and downstream needs — the data is computed and currently only *narrated to the
model*, never *checked*. Clean part-alignment here depends on the **stable
section IDs** work (`STATUS.md`).

**ADHD rationale.** "Every chapter is fine; the whole doesn't hold together" is
the failure an ADHD writer is *least* equipped to catch unaided, because catching
it requires holding all parts in the field at once. This is precisely the holding
the tool should do *for* them.

### L3 · The Beethoven test + requiredness made visible *(externalize the whole — one NEW, one sharpens item 6)*

**Text.** *Gestalt Theory* (1938): "from a part of the whole we could grasp
something of the inner structure of the whole itself"; the field "dominated by an
inner necessity," deriving "its dynamics" from "its whole-tendencies."

**Idea, part (a) — the Beethoven test (NEW).** Hand the AI **one section, alone,
with no surround**, and ask it to reconstruct the *document's* main claim from it.
Compare the reconstruction to the actual root spec's `mainClaim`. A large gap
means the part no longer carries the whole's signature — it has drifted (the
hyperfocus tangent that grew its own agenda). This is a cheap, powerful coherence
probe that inverts the usual flow: instead of feeding the whole *into* the part's
evaluation, it asks whether the whole can be *read out of* the part. A real part
passes; a piece fails.

**Idea, part (b) — strain on the whole-view (sharpens item 6).** Item 6 already
proposes overlaying the argument's commitment-mesh on the treemap. The 1938
"inner necessity" sharpens *what to draw*: render **requiredness as visible
strain** — heat, tension, a pull — precisely where commitments are unpaid or
incoming context is unmet (the L2 findings). The treemap stops being a quantity
map (area = word count) for a moment and becomes a *force* map: the writer *sees*
where the structure is under tension and being pulled toward completion.

**Code site.** (a) a new `AIProvider` method + prompt
(`src/services/ai-provider.ts`, `ai-provider.impl.ts`, `src/services/prompts/`);
(b) a derivation helper + `src/features/treemap/Treemap.tsx` (which already
colors by status and borders by readiness — strain is a new channel, not a
rewrite).

**ADHD rationale.** This is the load-bearing accommodation. ADHD's core cost is
holding the whole while attending to a part; externalizing the whole *as a
picture with forces in it* offloads exactly that, and a force map recruits the
fast, pre-attentive visual system that an ADHD writer's slow, taxed verbal
working memory cannot lean on.

### L4 · Requiredness as the activation engine *(ADHD activation — reframes items 4–5)*

**Text.** *Ethics*: situations carry requirements; the good completes the
structure. *Gestalt Theory*: "inner necessity," dynamics from whole-tendencies.
*On Truth* (via the first essay): *Umzentrierung*, and "to stick to set goals is
often sheer thoughtlessness."

**Idea.** The first essay's item 4 reframes `nextPriority` as a *located gap +
the vector that fills it*. The requiredness reading changes the **rhetoric of
presentation**, which for ADHD is not cosmetic. Do not present the next action as
a task the writer must *summon the will* to do. Present it as something the
**structure demands** — the gap is a strain in the whole, and the vector is the
direction the strain already points. The motive force is relocated from the
writer's depleted executive function to the externalized structure's "inner
necessity." And item 5's recentering becomes a *permission*: when the field has
narrowed onto a goal that no longer serves the whole, the tool offers the cheap
"question the goal" move — Wertheimer's blessing on changing the goal — as the
sanctioned exit from a perfectionist stall, not a failure.

**Code site.** `DiagnosticResult.nextPriority` reshaped to a located gap+vector
(`src/types/index.ts`), rendered in
`src/features/tests-panel/TestsPanel.tsx`; a recentering prompt + registry entry
(`src/services/prompts/registry.ts`) + `AIProvider` method. Note: the existing
ambient cue and streaming coach (`src/features/coach/`, per `STATUS.md`) are the
natural surface for the "demand" rhetoric — this is a reframe of copy and shape,
much of it landing in prompt text.

**ADHD rationale.** "Work on your dissertation" is a field so wide it cannot
generate a vector; it produces the freeze. A single located strain with a
direction is the smallest activating unit Wertheimer offers — and framing it as
the structure's demand, not the writer's chore, is the difference between a pull
and a push.

---

## III. The prompt pass — endorse, and add one line

The first essay's §VI is a prompt-by-prompt audit and stands. Two amendments.

**Do the cheap thing first.** ✓ *Shipped (Phase 1, 2026-06-26); the broader §VI
prompt pass followed.* §VI's own highest-value note is that Tier 1
*injects* a `STRUCTURAL SURROUND` block into `diagnostic.md` and `analysis.md`,
but at the time of writing neither prompt's text ever **mentioned** it — the data was present but unconsumed.
Teaching those two prompts to *consume* the surround (judge the section against
it; reconstruct the argument as a part of it) is a one-file edit each, no schema,
and it activates machinery already built and already paying its token cost. This
is the single best ratio of leverage to effort in the entire Gestalt program and
should precede every schema-bearing item below.

**Add the empty-move instruction (L1).** ✓ *Shipped (Phase 1, 2026-06-26).* When `diagnostic.md` is edited, fold in
the *Syllogisms* test as plain instruction: for each move, in addition to "is it
present," ask "does it *advance* relative to the section's incoming context, or
merely restate it in externally new form?" This delivers most of L1's value as
content before any type change ships.

---

## IV. The ethical frame — why all of this, for this person

*Ethics* gives the through-line, and it is not decoration. The faculties that
make *homo sapiens* — "the ability and tendency to understand, to gain insight; a
feeling for truth, for justice" — are defeated not by stupidity but by **the
narrowing of the field of consciousness.** Every lever in this essay is, read at
the right altitude, one move against that narrowing:

- **L3** keeps the whole *in the field* as a picture, so attending to a part does
  not evict the whole from view.
- **L2** catches the breaks that only appear when the whole field is held at
  once — the holding an ADHD writer cannot do unaided.
- **L4** supplies the located strain-with-direction that a too-wide field cannot
  generate on its own, and **licenses recentering** when the field has narrowed
  onto the wrong goal — "to stick to set goals is often sheer thoughtlessness."
- **L1** turns the diffuse unease of bloated prose into a specific, subtractive,
  low-stakes action.

Wertheimer's closing register in *Ethics* — "the stake is not the instrument; it
is man himself" — is the right frame for an accessibility tool built by its user
for the finishing of one irreplaceable artifact. The architecture's existing
ADHD principle (minimum cognitive surface area, `VISION.md`) and this essay's
levers are the same commitment at two scales: **do not let the field narrow.**

---

## V. Re-sequenced roadmap — by ADHD leverage, cheapest first

The first essay numbers its roadmap by topic (items 3–7). This is the
recommended *build order*, ranked by leverage-per-effort for the user who has to
both build and use the result:

> **Status (2026-06-26):** items 1–4 below shipped (Phases 1–3 + essay III); item 5
> (the treemap strain whole-view, L3b) is the one big remaining deferral. The sequence
> is retained as the reasoning; STATUS.md → "Gestalt roadmap" is canonical for what shipped.

1. **§III prompt edits.** ✓ *Shipped.* `diagnostic.md` + `analysis.md` consume the
   already-injected surround; `diagnostic.md` gains the L1 empty-move
   instruction. One file each, no schema, machinery already present. *Do first.*
2. **L4 gap→vector rendering + "demand" rhetoric.** Mostly prompt text +
   `TestsPanel` copy/shape; the activation payoff is immediate and the recentering
   prompt is additive. (First essay item 4–5.)
3. **L1 / L2 diagnostic-schema additions.** The `MoveResult` advance-axis and the
   `DiagnosticResult` commitment-mesh finding. Schema-bearing; **gated on stable
   section IDs** (`STATUS.md`) for clean part-alignment. (Item 3.)
4. **L3(a) the Beethoven test.** A self-contained new AI flow; no UI dependency
   beyond a place to show the gap.
5. **L3(b) the strain whole-view on the treemap.** ⌛ *Still deferred — the one big
   remaining item (heatmap-accessibility verdict + stable IDs; see STATUS.md).* Heaviest (a new visual
   channel + derivation), highest ceiling; do last, once the L2 findings it
   visualizes exist. (Item 6.)

Item 7 of the first essay (boundary correctness + B-reaction guardrails) is left
as the first essay frames it; it composes cleanly with L1 (a B-reaction is a
recapitulative move dressed as a transition).

---

*First essay: [`gestalt-design.md`](gestalt-design.md). Why the project is
shaped this way: [`VISION.md`](VISION.md). What's being worked on:
[`../STATUS.md`](../STATUS.md). The architecture as built:
[`../AGENTS.md`](../AGENTS.md).*
