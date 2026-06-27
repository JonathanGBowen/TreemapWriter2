# Qualitative design — the felt whole beneath the structured one

> **What this is.** A design essay, companion to the three Gestalt essays
> ([`gestalt-design.md`](gestalt-design.md), [`-II`](gestalt-design-II.md),
> [`-III`](gestalt-design-III.md)). It reads the tool's handling of wholes and
> parts — of the manuscript *and* of its own prompts — through John Dewey's
> **"Qualitative Thought" (1930)**, and grows concrete levers out of the reading.
> Where the Gestalt essays hold the whole as **structure** (a claim, a
> commitment-mesh, a dependency topology), this one asks after the felt
> **pervasive quality** that, for Dewey, *grounds and regulates* all structure.
> The *why* lives here; the architecture-as-built lives in
> [`../AGENTS.md`](../AGENTS.md), the backlog in [`../STATUS.md`](../STATUS.md),
> the dated record in [`migration-log.md`](migration-log.md). **When this essay
> and the code disagree, trust the code.**
>
> **Provenance.** Drawn directly from one source, read closely: John Dewey,
> "Qualitative Thought," *The Symposium* 1.1 (1930), pp. 244–263. Every quotation
> below is from that text. No secondary Dewey, no textbook gloss — the essay is
> meant to encounter the argument itself, the way the Gestalt essays encounter
> Wertheimer.
>
> **A note on standing.** A *proposal-plus-record*: §IV marks what shipped in the
> first pass (2026-06-27) and what is named-and-deferred. The guiding hypothesis —
> that Dewey and the tool's existing Gestalt foundation are in **harmony** — is
> taken up and *interrogated* in §III, because the brief asked for interrogation
> where it seemed called for, and it did.

## I. The doctrine, in Dewey's own terms

1. **Situation vs. object.** The pair on which everything turns. A *situation* is
   "a complex existence that is held together in spite of its internal complexity
   by the fact that it is dominated and characterized throughout by a single
   quality." An *object* is "some element in the complex whole that is defined in
   abstraction from the whole of which it is a distinction." The polemic: "in
   current logical formulations, the beginning is always made with 'objects'" —
   and so "connection among such entities is mechanical and arbitrary, not
   intellectual." The situation is prior; it *controls* which objects and
   relations are even relevant.
2. **The pervasive quality.** A situation is unified by "an underlying and
   pervasive quality" that "permeates, affects, and controls every detail." It is
   what "gives meaning to each and binds them together." It "regulates pertinence
   or relevancy and force of every distinction and relation; it guides selection
   and rejection." "Confusion and incoherence are always marks of lack of control
   by a single pervasive quality."
3. **The situation cannot be stated.** "The situation as such is not and cannot be
   stated or made explicit. It is taken for granted, 'understood,' or implicit in
   all propositional symbolization." The quart-bowl image: "A quart bowl cannot be
   held within itself or in any of its contents. It may, however, be contained in
   another bowl" — what is the situation in one proposition can become a *term* in
   another. Quality is *felt*, but "feeling" is not a psychical entity: "'Feeling'
   and 'felt' are names for a *relation* of quality."
4. **The problem is HAD before it is STATED.** "The problem is had or experienced
   before it can be stated or set forth; but it is had as an immediate quality of
   the whole situation." "All thought in every subject begins with just such an
   unanalyzed whole." And the hinge: "a problem *stated* is well on its way to
   solution... Thought is the operation by which it is converted into pertinent and
   coherent terms." The "Oh" of wonder opens an inquiry; the "Good" of "a
   rounded-out and organized situation" closes it.
5. **Predication develops a quality; the copula is an active verb.** "Predication
   ... marks an attempt to make a qualitative whole which is directly and
   non-reflectively experienced into an object of thought for the sake of its own
   development." Subject and predicate are not pre-existing pieces joined: they are
   "correlative determinations of this quality." "The logical force of the copula
   is always that of an active verb" — "that is red" really means "that reddens";
   the subject is "the pervasive quality as means or condition," the predicate "as
   outcome or end," and the copula marks "the direction of movement between these
   limits."
6. **"Enough is always enough."** Against the idealist demand that a judgment be
   "coextensive with the whole universe" to be true: "enough is always enough, and
   the underlying quality is itself the test of the 'enough' for any particular
   case." Sometimes the "safe" or "out" of an umpire suffices; sometimes "my
   kingdom for a horse"; sometimes "a volume." Adequacy is purposive, not absolute.
7. **Assimilation before similarity (the Bradley promontory).** We do not
   associate *by* contiguity or *by* an "external existential identity." Bradley
   explains two promontories' resemblance by identity of form; Dewey: "form is not
   one isolated element among others, but is an arrangement or pattern of elements.
   Identity of pattern ... can be apprehended only *after* the other promontory has
   been suggested." What links is "a present immediate quality." "'Assimilation'
   denotes the efficacious operation of pervasive quality; 'similarity' denotes a
   *relation*" — and assimilation "comes first and need not eventuate in the
   express conception of resemblance." The Goya example: a viewer "says at first
   sight that it is by Goya... long before he has made any analysis"; the
   quality-judgment is "a more dependable basis" for later point-by-point analysis
   "than an external analysis performed by a critic who knows history and
   mechanical points of brushwork but who is lacking in sensitiveness to pervasive
   quality."
8. **Formulae must return to quality.** Symmetry, harmony, rhythm, proportion are
   named "upon subsequent analysis," but "the apprehension of these formal
   relationships is not primary." A translation into explicit relations is worth
   only "the extent to which the propositional statements return to effect a
   heightening and deepening of a qualitative apprehension. Otherwise, esthetic
   appreciation is replaced by judgment of isolated technique." Science is no
   exception: "Scientific thought is, in its turn, a specialized form of art, with
   its own qualitative control."

## II. How the tool handles wholes and parts today, by Dewey's lights

The exegetical spine is, like Wertheimer's, congenial to Dewey: a manuscript is a
tree of `Section` (`src/types/index.ts`), the whole a synthetic `root`; the thesis
is "structure, not summary." `SectionSpec` defines a part by its relations. And
the tool has gone far in *holding the whole* — the document claim (root
`mainClaim`), the commitment-mesh (`incomingContext`↔`outgoingCommitments`), the
radix/centering topology (`src/features/modals/topo/`). Read by Dewey, all of this
is the whole reconstructed **as objects and their stated relations.** That is not
an error — Dewey says you *must* make the quality "into an object of thought for
the sake of its own development." But it leaves a gap that is exactly the shape of
his argument:

- **The pervasive quality has no representation.** The tool holds the document's
  *claim* (a proposition — an object cut from the situation) and its *gist* (the
  document at low resolution). It holds nothing that answers to Dewey's pervasive
  quality — the felt tone "that runs through them all, that gives meaning to each."
  The "ground" beneath the structure is simply absent.
- **The commitment-mesh is the tool's Bradley.** The mesh asks whether a section's
  `incomingContext` is satisfied by an upstream `outgoingCommitment` — matching
  *stated tokens*. That is precisely the "external existential identity" Dewey
  refutes via the promontories: connection asserted between explicit elements,
  rather than grounded in "a present immediate quality." It predicts a failure
  mode the mesh cannot catch — sections whose tokens match yet do not cohere, and
  sections bound by a real quality whose tokens never line up.
- **The whole is held only as the *stated* problem.** Every next-step surface —
  `nextAction` (gap → vector), `commitmentFindings`, the Structural-Tension
  Register — operates on the problem *after* it is articulated. Dewey's prior
  stage, the problem *had* as an immediate quality before it can be said, has no
  home. For the tool's user that prior stage is the stuck state itself.
- **The spec is attributive.** A section *has* a `function`, *has* a `mainClaim`,
  *has* `requiredMoves` — the "property" notion Dewey diagnoses ("a subject is
  given ... and then thought adds a further determination"). The directional pair
  `incomingContext → outgoingCommitments` is latently Deweyan (a movement between
  limits), but it is read as two more properties, not as the active verbing of a
  quality.
- **The structural readouts risk "isolated technique."** The miscentering scalar,
  rank span, route length, readiness enums — Dewey's "symmetry, harmony,
  proportion." Valuable only if they "return to effect a heightening ... of a
  qualitative apprehension." Nothing in the tool enforces that return; a writer can
  optimize the metrics and lose the work.

## III. The harmony hypothesis, interrogated

The brief offered the Dewey/Gestalt harmony as a hypothesis to test, not assume.
Tested, it half-holds — and the half that breaks is the productive half.

It **holds at the level of part/piece.** Both reject the and-sum. Wertheimer's "the
single tone is what it is in the whole, as part, not as piece; and the whole
breathes in every part" and Dewey's "the quality of the whole permeates, affects,
and controls every detail" are the same refusal, stated in two registers —
structural and qualitative.

It **breaks at the level of telos.** Wertheimer, as the tool uses him (especially
[`gestalt-design-III.md`](gestalt-design-III.md)), is committed to **objective
requiredness**: boundaries "correct or incorrect," a *radix* that is the source of
the arrows, a miscentering scalar that measures distance from the correct
centering. There is, in the structure, a fact of the matter. Dewey is not: "enough
is always enough, and the underlying quality is itself the test of the 'enough.'"
There is no single correct amount of structure in the abstract — only
enough-for-this-purpose, with the situation's quality the judge. That is a real
tension, and it cuts in the writer's favor. A tool that implies one objectively
correct structure, to be hunted to exhaustion, is a stall engine for a
perfectionist; Dewey supplies the antidote *from within the same family of ideas.*

So the resolution is not "they agree." It is **subordination**: Dewey places the
felt quality *beneath* structure (its ground) and *beyond* it (its telos —
return-to-quality), and relativizes correctness to purpose. The Gestalt apparatus
the tool already built is the necessary **middle**. Read this way the tool is, at
present, a middle without a ground or a telos — which is exactly what §IV supplies.

## IV. What shipped (first pass, 2026-06-27) — and the roadmap

Each item: *Dewey-idea → change → code site.* Shipped items are marked ✓.

1. **✓ The pervasive quality (the "ground").** A root-level move
   `readPervasiveQuality` *indicates* — never *states* (honoring "cannot be
   stated"): it returns a clue to the felt tone running through the whole, plus a
   few short "registers" (threads of one quality, not an and-sum of properties),
   stored on the `root` entry as `qualitativeSignature`. Distinct from the claim (a
   proposition) and the gist (low-res restatement). Sites:
   `src/services/ai/ai-provider.qualitative.ts`, `read-pervasive-quality.md`,
   `QualitativeActions`. *(Idea I.2–3.)*
2. **✓ The Goya test.** A part-level move `readPartQuality`: from a section's prose
   alone, read the quality it carries and judge whether it *belongs* to the whole's
   quality (`belongs` / `shifted` / `alien` / `no-baseline`) — **assimilation**,
   not claim-matching. The qualitative twin of the structural Beethoven test
   (`reconstructWhole`): a part can carry the thesis yet read tonally alien, and
   vice versa, and Dewey says the quality reading is the *more dependable* basis.
   It reads against the signature from item 1 and degrades to `no-baseline` without
   one. Surfaced beside "Whole from here." *(Idea I.7.)*
3. **✓ Felt before stated.** A first-class, **persisted** register for the
   pre-articulate trouble — `feltTrouble` on `TestSuiteEntry`, with a textarea
   ("Something feels off here — even if you can't yet say what"). Persisted because
   a writer-typed note is intellectual work, like analysis: a `felt_trouble` field
   rides the Rust `TestSuiteEntry`/`PersistedTestEntry` round-trip
   (`src-tauri/src/types.rs`), schema-agnostic like `analysis`. The ramp
   `articulateTrouble` converts the note into a located **gap → vector** (reusing
   the diagnostic `NextAction`): "a problem stated is well on its way to solution."
   *(Idea I.4.)*
4. **✓ The design law (essay + one light surface).** *Every structural readout
   earns its place only if it returns the writer to a heightened qualitative
   apprehension of the whole* — Dewey's sibling to "trust the code": *the analysis
   serves the quality, or it is noise.* It ships as this paragraph plus the
   re-presentation of the qualitative signature as the document's "ground," so the
   structural readouts are read against the felt whole rather than instead of it.
   *(Idea I.8.)*
5. **Predication as active verb** *(roadmap).* Re-read the spec as the active
   verbing of the document's quality between limits (`incomingContext` as
   means/condition → `outgoingCommitments` as outcome/end), not a thing with
   properties. Touches `SectionSpec` rendering and the spec prompts; deferred
   because it reshapes a load-bearing, tested schema. *(Idea I.5.)*
6. **Quality-governed context ("enough is always enough")** *(roadmap).* The
   structural surround is a *fixed* schema (document + parent + upstream +
   downstream, every time) — a mild and-sum. Let the situation's quality govern
   *which* and *how much* surround a given call needs. `diagnostic-helpers.ts`,
   `ai-provider.specs.ts`. *(Idea I.6; see §VI.)*
7. **A quality axis on the mesh (the Bradley fix)** *(roadmap).* Beside the
   token-mesh, detect assimilative kinship by pervasive quality — surfacing
   connections the token-match misses and flagging token-matches that are
   quality-empty (the `tF` of a part that "checks out" yet does not cohere). The
   Goya test (item 2) is the first instrument of this axis. *(Idea I.7.)*
8. **A *qualitative* treemap** *(deferred, consistent with the Gestalt Tension
   Lens).* Render the pervasive quality as the *ground* (figure/ground) and each
   part's belonging-to / divergence-from it as figure — the Goya test made visible.
   Held, like the Gestalt strain whole-view, behind the heatmap-accessibility
   verdict ([`gestalt-design-II.md`](gestalt-design-II.md) L3b) and stable IDs.

## V. Why this matters for the ADHD writer (Dewey-grounded)

- **The felt-before-stated register dignifies the stuck state.** ADHD's hardest
  moment is the one the tool was silent on: *something is wrong and I cannot yet
  say what.* Dewey insists this is not a deficiency but the normal first stage of
  all thought ("had ... before it can be stated"). Giving it a home — and a ramp,
  not a demand — turns the freeze into the first move.
- **"Enough is always enough" is anti-perfectionism.** The miscentering scalar
  implies a single correct structure to hunt; Dewey relativizes correctness to the
  situation's quality and purpose. The tool should help the writer reach
  *enough-for-this*, not chase an absolute that does not exist.
- **The qualitative signature keeps the field from narrowing.** The Gestalt second
  reading names ADHD's load as "the narrowing of the field of consciousness." A
  felt, re-presentable "ground" is a cheap way to keep the whole present *as a
  felt whole* while a part is worked — complementing the structural surround with
  the quality the structure is *for*.
- **Assimilation is the low-effort entry.** The Goya reading asks only "does this
  belong?" — a fast, pre-analytic judgment, the one Dewey says is *most*
  dependable — before any point-by-point structural audit. It meets the writer
  where attention is cheapest.

## VI. Prompts as situations

The brief asked about wholes and parts of the *prompts*, not only the manuscript.
A prompt sent to the model is itself a situation. Its **system-instruction is its
pervasive quality** — the thing that should regulate which context is relevant; the
assembled blocks (spec + structural surround + scope) are objects within it. Read
this way, the **fixed structural-surround schema is a mild and-sum**: it injects
the same four role-reconstructions regardless of what the particular call needs.
"Enough is always enough" applies to context assembly too — the surround a
*situation* demands varies (item 6). This pass leaves the surround machinery intact
(it is load-bearing and tested) and instead adds the missing *qualitative* prompts
beside it; the three new prompt texts
(`read-pervasive-quality.md`, `read-part-quality.md`, `articulate-trouble.md`) are
each written to ask the model for a clue to a quality, never a summary — the
prompt-level enactment of "the situation cannot be stated."

---

## Appendix: Running notes

*These were written **before** the essay above, in the order the thoughts actually
came, as the brief requested. They are kept raw — false starts included — because
the false starts are where the harmony hypothesis was actually interrogated. The
essay is the synthesis; this is the work.*

### 1. First pass through the text — what is Dewey actually claiming?

Reading it cold, not from the textbook Dewey. The hammer-blow sentence is early:
"the subject-matter ultimately referred to in existential propositions is a
complex existence that is held together in spite of its internal complexity by the
fact that it is dominated and characterized throughout by a single quality." That
is the **situation**. Against it he sets the **object** — "some element in the
complex whole that is defined in abstraction from the whole of which it is a
distinction."

So the pair is situation / object, and the polemical claim is: *current logic
always begins with the object* ("the stone is shaly") and so can never explain how
objects connect — "connection among such entities is mechanical and arbitrary, not
intellectual." The situation is prior, and it *controls* which objects and
relations are even relevant.

Immediately this rhymes with Wertheimer's part/piece. But I want to be careful not
to collapse them yet — note the difference: Wertheimer's whole is **structural**
("the laws of the inner structure of the whole"); Dewey's situation is held
together by a **single pervasive quality** that is *felt*. Hold that difference. It
may be the whole contribution.

### 2. The thing Dewey says that Wertheimer (as the app uses him) does not

Three Dewey claims I cannot find a home for anywhere in the tool:

(a) **"The situation as such is not and cannot be stated or made explicit."** The
quart-bowl image. The tool states *everything* about the whole: documentClaim, the
role-skeleton, the mesh, the topology. Each is the situation turned into an object.
By Dewey's own argument that's necessary ("for the sake of its own development") —
BUT it means the tool never holds the situation *as* situation, only its
objectified residue. Is there a representation that *indicates without stating*?
Seed of the qualitative-signature idea.

(b) **The problem is HAD before it is STATED.** The tool only ever deals in the
*stated* problem: gap→vector, nextAction, commitmentFindings. No home for the *had*
problem, the felt "something is off and I can't say what." For an ADHD writer this
is exactly the stuck state. Big gap. (→ Lever 3.)

(c) **Assimilation precedes similarity; association is by quality.** The Bradley
promontory passage is the sharpest thing in the essay. What links is "a present
immediate quality." Assimilation comes first; "similarity" is a later judgment
requiring symbols.

### 3. The shock: the commitment-mesh IS Bradley

The moment the proposal got teeth. The mesh matches `incomingContext` to
`outgoingCommitment` as stated tokens — role-reconstructions, yes, but still
*identities posited between explicit elements*. That is **precisely** Bradley's
"external existential identity," the thing Dewey says cannot be the ground of real
connection. Dewey predicts the failure mode: tokens that match yet do not cohere (a
`tF` in Wertheimer's notation); and sections bound by a real quality whose tokens
never line up, which the mesh will never surface. So Dewey doesn't just *add* to the
mesh — he *diagnoses* it. Keep the mesh (it is the necessary objectified residue),
but it needs a quality axis, and per Dewey that axis should run *first*.

### 4. The Goya passage → a test the tool is missing

The tool already has the **Beethoven test** (`reconstructWhole`): from one part,
reconstruct the whole's *claim*, compare for drift. That is *structural*. The Goya
test is its missing twin on the *qualitative* axis: does this part *carry the
pervasive quality of the whole*, independent of whether its claim reconstructs? A
part could pass Beethoven and fail Goya, and vice versa. And per the quote, the
Goya reading is the *more dependable* basis. Almost too clean a fit. (→ Lever 2,
with Lever 1 as its baseline.)

### 5. "Enough is always enough" — interrogating the harmony

Here I tried to break the Dewey/Gestalt harmony, because the brief asked me to
interrogate rather than assume it.

Wertheimer (esp. as gestalt-design-III uses him) is committed to **objective
requiredness**: boundaries "correct or incorrect," a right radix, a miscentering
scalar. There is, in the structure, a fact of the matter. Dewey is not: "enough is
always enough, and the underlying quality is itself the test." No single correct
amount of structure in the abstract — only enough-for-this-purpose. He explicitly
mocks the idealist demand that a judgment be coextensive with the universe.

So they are *not* simply harmonious. Wertheimer's structure has a correct state;
Dewey's adequacy is purposive and plural. A real tension — and it cuts in the
*user's* favor. The miscentering scalar implies one right structure to hunt to
exhaustion; for a perfectionist ADHD writer that's a stall engine. Dewey supplies
the antidote from within the same family of ideas.

Resolution I'll commit to: the harmony holds at *part/piece* (both reject the
and-sum) but breaks at *telos*. Dewey **subordinates structure to quality** and
**relativizes correctness to purpose.** Quality is the ground and the telos;
structure is the necessary middle the tool already built. The tool is currently a
middle without a ground or a telos.

### 6. The design-law that falls out (and indicts half the tool's UI)

"The value of any such translation ... is measured ... by the extent to which the
propositional statements return to effect a heightening and deepening of a
qualitative apprehension. Otherwise, esthetic appreciation is replaced by judgment
of isolated technique." Read against the tool, "symmetry, harmony, proportion" =
the miscentering scalar, rank span, route length, readiness enums. A design law:
a structural readout earns its place only if it *returns the writer to a heightened
qualitative apprehension.* The tool's sibling to "trust the code": *the analysis
serves the quality, or it is noise.* Cheapest honest enactment: re-present the
qualitative signature as the "ground" so structure is read against the felt whole.

### 7. Predication / the copula — real, but deferring it

"is = an active verb"; subject = quality as means/condition, predicate = as
outcome/end; copula = direction of movement. Maps onto the spec: `incomingContext`
(condition) → `outgoingCommitments` (outcome) is *already* latently directional.
The Deweyan sharpening reads the whole spec as the active verbing of a quality
between limits, not a thing-with-properties. Real, but reshaping the spec is a
large, schema-touching change and not where the leverage is this pass. Name it,
defer it.

### 8. Prompts as situations

The prompt is a situation; the system-instruction its pervasive quality; the
assembled blocks objects within it. The structural-surround is a *fixed schema* —
a mild and-sum; "enough is always enough" applies to context assembly too. Don't
rebuild it now (load-bearing, tested) — but name it.

### 9. What to build this pass (deciding scope)

Emphasis on (1) quality-grounds-structure and (3) felt-before-stated. The three
levers that carry exactly those and fit the existing gestalt flow pattern with low
risk: **L1 Qualitative signature** (the ground), **L2 Goya test** (baseline = L1,
twin of Beethoven), **L3 Felt trouble + articulate ramp**. Persistence call for L3:
the gestalt results are ephemeral (Rust whitelist drops them), but a *writer-typed*
note is intellectual work like `analysis`/`dialogue`, which ARE persisted. A note
that vanishes on reload betrays the very ADHD writer it serves. So persist it: add
`felt_trouble` to the Rust round-trip. Small, well-patterned. Mesh-as-Bradley and
the qualitative treemap are the two ideas I most want and am most consciously NOT
building this pass — name both as deferrals; don't smuggle them in.

### 10. One worry, recorded honestly

Am I just relabeling Gestalt features with Dewey words? Test: does any lever do
something the Gestalt apparatus cannot? L2 (Goya) is orthogonal to its sibling
Beethoven test — quality vs. claim, and Dewey insists they diverge and that quality
is the more dependable. L3 has no Gestalt analogue at all (the *had* problem is
purely Dewey). L1 represents something the tool provably lacks (it holds claims and
structure, never the felt tone). So no — not relabelings; the missing ground and
the missing pre-articulate phase. The harmony is real but Dewey is load-bearing,
not decorative. Proceed.
