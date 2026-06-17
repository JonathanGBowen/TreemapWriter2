# Gestalt-theoretic design — reading, writing, analyzing as wholes and parts

> **What this is.** A design essay: *why* the tool should treat a manuscript (and
> its own prompts) the way Gestalt theory treats wholes and parts, and the concrete
> levers that follow. This is the reasoning layer — the *why*. The current
> architecture (the *how*) lives in [`../AGENTS.md`](../AGENTS.md); the founding
> principles in [`VISION.md`](VISION.md); the backlog in
> [`../STATUS.md`](../STATUS.md). When this essay and the code disagree, trust the
> code.
>
> **Provenance.** Drawn directly from five Wertheimer sources — *On Truth* (1934),
> *Some Problems in the Theory of Ethics* (1935), *On the Concept of Democracy*
> (1937), *Gestalt Theory* (Wertheimer & Riezler, 1944), and the *Productive
> Thinking* (1959) annotations. A happy accident makes the fit exact: the tool's own
> sample manuscript (`DEFAULT_MARKDOWN` in `src/lib/constants.ts`) is a dissertation
> *about* Gestalt productive thinking — S1→S2 gaps and vectors, type-A/B behaviour,
> Wertheimer's part/piece notation. The tool should embody the philosophy it helps
> write.

## I. The doctrine, in the authors' own terms

1. **Part vs. piece.** A *piece* is an element cut off and judged in isolation,
   blind to context; a *part* is what it is by its **function, place, and role in
   the whole** — "the single tone is what it is in the whole, as part, not as piece;
   and the whole breathes in every part." The *same datum* can be taken either way;
   cutting a part off as a piece is an error, not a neutral choice.
2. **The whole determines the part.** "What happens to a part of the whole is, in
   clear-cut cases, determined by the laws of the inner structure of its whole."
   Transpose a melody — every element changes, the whole is still recognized. *B as
   leading-tone of C is a different thing from B as the tonic.*
3. **Structural truth (tF / fT).** A statement can be true as a piece yet false as a
   part (`tF` — technically accurate, deceptive; achievable *even with all data
   present*, by "shifting the emphasis, displacing the center of gravity,"
   *Umzentrierung*). A caricature is false in every detail yet truer than a
   photograph (`fT`). "I have failed to grasp if I know everything as a sum, if I
   have not grasped the inner connections of the whole."
4. **Productive thinking: gaps and vectors.** A problem-state S1 is *structurally
   incomplete* — a gap, a structural trouble, strains and stresses. Genuine thinking
   is not a sum of steps or blind trial but the growth of one line of thinking "from
   above to below," along **vectors** the trouble itself sets up, toward S2 where the
   gap is filled and "the ends are made good."
5. **Recentering (Umzentrierung).** The transition from a one-sided view to the
   centering the objective structure requires — changing the role of the parts, and
   sometimes **the goal itself**: "to stick to set goals is often sheer
   thoughtlessness."
6. **A- vs. B-reactions = an operational definition of understanding.** An
   *A-reaction* grasps the structure and adapts the method as sense requires; a
   *B-reaction* is blind, piecemeal, slavish. "Generalization" names but does not
   answer — foolish generalizations are generalizations too.
7. **Gestalt boundaries are not arbitrary** — they are "subject to examination on
   grounds of being correct or incorrect."
8. **Subtractive abstraction is blind** (*Democracy*, *Ethics*): defining a thing by
   an and-sum of differentiae "blind to the role each item plays in the hierarchical
   structure" narrows the horizon. Beneath surface diversity (A) can lie an identical
   structural principle (B).
9. **The human stake** (*Ethics*): "temporary blindness," the *narrowing of the
   field of consciousness*, defeats the faculties of *homo sapiens*. "The stake is
   not the instrument; it is man himself." — the ethical frame for an accessibility
   tool.

## II. How the tool handles wholes and parts today

The exegetical spine is already Gestalt-leaning. A manuscript is a tree of
`Section` (`src/types/index.ts`), each node carrying `content` (its own prose) and
`fullContent` (its subtree); the whole is a synthetic `root` (`buildRootSection`,
`src/lib/utils.ts`). `SectionSpec` (`function`, `mainClaim`, `requiredMoves`,
`incomingContext`, `outgoingCommitments`) defines a part by its relations — part-in-
whole thinking. The stated thesis is "structure not summary" ([`VISION.md`](VISION.md)).

But examined by its own lights, the tool treats parts as **pieces** at two points:

- **(a) Compression by char-prefix is the piecemeal sin.** When context is tight,
  spec generation fell back to `markdown.slice(0, 4000)` and `content.slice(0, N)`
  (`src/services/ai/ai-provider.specs.ts`). A prefix is a *piece torn from context* —
  the exact and-sum move Wertheimer condemns; the tool broke its own thesis at the
  one moment it mattered.
- **(b) A section was judged as a piece, not a part.** `buildDiagnosticPrompt`
  (`src/lib/constants.ts`) and `buildAnalysisRequestText` (`src/lib/analysis-helpers.ts`)
  passed the section's own spec + text but no *live* surround. Nothing checked
  whether a section's `incomingContext` is actually *met* by the upstream section's
  `outgoingCommitments`. The part was never tested in its whole.

The remaining gaps (no structural-truth check; a flat `nextPriority`; no recentering;
heading-given boundaries; a quantity-only treemap) are the roadmap in §IV.

## III. What shipped now (Tier 1: part-not-piece context)

The foundation the rest builds on — context that honours the part/piece distinction.

1. **Killed prefix-truncation in spec generation.** The redundant 4000-char document
   preview is gone; the document-level spec reconstruction (`rootCtx`) plus a
   structural outline now carry the whole as a *role-reconstruction*, never a slice
   (`src/services/ai/ai-provider.specs.ts`). The per-section `contentPreview` slice is
   left with a TODO: it is unavoidable *there* because that pass is what *derives* the
   spec, so no reconstruction yet exists — its proper fix lands with item 7.
2. **Structural surround on every part-level call.** A new pure helper —
   `buildStructuralSurround` / `formatStructuralSurround` (`src/lib/diagnostic-helpers.ts`,
   tested) — derives a section's *live* part-in-whole context from the section tree and
   the spec map: the document's claim (the macro-vector), the parent's claim, the
   preceding section's outgoing commitments (what this section's incoming context
   should build on), and the following section's incoming needs (what this section's
   outgoing commitments must meet). All are role-reconstructions, never prose slices.
   It is threaded (back-compatibly, behind optional params) into both prompt builders
   and wired at the diagnostic path (`App.tsx`), the analysis path
   (`src/features/tests-panel/use-analysis-actions.ts`), and the modal's prompt
   preview (`src/features/modals/TestRunnerModal.tsx`) so the previewed prompt matches
   the one actually sent. The whole-document pass is already the whole, so it gets no
   surround.

## IV. The roadmap (documented, not yet built)

Each item: text-idea → change → code site.

3. **Structural-truth / center-of-gravity diagnostic (tF·fT).** A cross-boundary
   coherence check ("true in itself, still true as a part? center of gravity
   displaced?") plus a **commitment-mesh test**: each `incomingContext` should be
   satisfied by an upstream `outgoingCommitment`; surface unmet / duplicated /
   misplaced commitments. Catches the classic dissertation failure — every chapter
   locally fine, the whole incoherent. Extend `DiagnosticResult` (`src/types/index.ts`)
   + `diagnostic.md` (`src/services/prompts/`). *(Idea 3.)*
4. **Gap→vector next-actions.** Reframe `nextPriority` as a **located gap + the
   vector that fills it** ("S1 is incomplete *here*; the direction that makes the ends
   good is *toward* X"). Concrete, located, self-directing — the most ADHD-activating
   unit Wertheimer offers. `DiagnosticResult` shape + `diagnostic.md` + rendering in
   `src/features/tests-panel/TestsPanel.tsx`. *(Idea 4.)*
5. **Recentering operation (Umzentrierung) + "question the goal."** A first-class AI
   move proposing alternative structural centerings of a section or the whole
   argument, and — at the deepest level — asking whether *this section's goal is right
   for the whole.* The unstick button for the one-sided / "narrowed field" state. New
   prompt + registry entry (`src/services/prompts/registry.ts`); a method on the
   AIProvider interface (`src/services/ai-provider.ts`, `ai-provider.impl.ts`); a UI
   hook. *(Ideas 5, 9.)*
6. **Argument-structure whole-view on the treemap.** Overlay the argument on the
   quantity view: the commitment-mesh (incoming↔outgoing), located gaps, the main
   vector; an "argument" coloring beside word-count area. Externalizes the whole so an
   ADHD writer holds inner connections without holding all text in working memory.
   `src/features/treemap/Treemap.tsx` + a derivation helper. *(Ideas 2, 9.)*
7. **Boundary correctness + B-reaction guardrails.** Flag structurally-wrong section
   breaks (one argument split across two sections, or two crammed into one) — and here
   the deferred `contentPreview` slice resolves, by reconstructing role rather than
   slicing. Check AI revision proposals for *B-reactions* (boilerplate hedging /
   template transitions, locally plausible but blind to function).
   `src/services/ai/ai-provider.revisions.ts` + a boundary prompt. *(Ideas 6, 7.)*

## V. Why this matters for ADHD (grounded in the texts)

- ADHD's core load is holding the *whole* while attending to a *part*. Wertheimer's
  *whole-determines-part* is therefore an **accessibility principle**: externalize the
  whole (item 6) so a part can be worked without losing it.
- *Ethics*' "narrowing of the field of consciousness" precisely describes hyperfocus
  tunnel and a displaced center of gravity; the tool must keep re-presenting the whole
  and make **recentering cheap** (item 5).
- The **gap→vector** unit (item 4) replaces amorphous "work on your dissertation" with
  a located structural trouble that carries its own direction — activating, not
  paralyzing.
- "The goal itself as part" grants permission to *change the goal* when stuck — an
  antidote to perfectionist stall.
