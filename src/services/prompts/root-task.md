Analyze the ENTIRE document below to produce a single DOCUMENT-LEVEL specification — the top of the hierarchy, sitting ABOVE its chapters. This spec is the standard the chapters will be generated and checked against, so it must capture what the whole work has to accomplish.

Read the full text (or, if only an outline is provided, reason from the structure) and reconstruct the document as a whole.

Begin from the GAP — the structural trouble the whole work exists to resolve. Name the problem-state (S1) the field is in without this contribution and the resolved state (S2) the document moves it to; the main claim and macro-moves are the path from S1 to S2. A document is not an and-sum of chapters but a single line of development that closes a gap.

THE HONEST-HEAP EXCEPTION. That "single line of development" is the default and, for a dissertation, almost always right — but it is not a universal law. Where a part's inner functional content genuinely approaches zero — an inventory or reference appendix, a glossary, truly coordinate case studies or catalogue entries with no argued throughline between them — piecemeal, and-summative arrangement is the CORRECT form, not a defect ("classical piecemeal logic is adequate in those instances in which the inner functional content approaches zero" — Wertheimer, On Truth). Do NOT manufacture a throughline, a gap, or forced commitments for such material; dressing a genuine heap as an organism is itself the document-scale lie (tF). Reach for this exception only when the material plainly resists a line of development — default to the single line otherwise.

MAIN CLAIM: The document's overarching thesis — the single sentence that, if false, would make the entire work pointless. A logician's reconstruction of the central contribution that closes the gap above, not a description of the topic.

REQUIRED MOVES: 3-7 MACRO-level arcs the document as a whole must execute. These span chapters; they are NOT chapter summaries. Good document-level moves:
- "Establish the theoretical framework in the early chapters that the later case studies presuppose"
- "Show that the objection raised in Chapter 2 is decisively answered before the synthesis"
- "Sustain a single line of argument from the problem statement through to the contribution"
Bad (too local, or mere description):
- "Chapter 3 discusses methodology"
- "Cover the relevant literature"

OUTGOING COMMITMENTS: What the document as a whole promises to deliver to its reader and field — its contribution, scope, and the claims a reader should leave convinced of.

INCOMING CONTEXT: The scholarly / field background the document presupposes (the problem space or literature it enters). May be brief.

FUNCTION: Use "synthesize" unless another value clearly fits the whole work better:
introduce | explicate | argue | compare | critique | synthesize | apply | evaluate | narrate | transition

Return a SINGLE JSON object (NOT keyed by section id):
{
  "function": "synthesize",
  "mainClaim": "...",
  "requiredMoves": ["...", "..."],
  "incomingContext": ["...", "..."],
  "outgoingCommitments": ["...", "..."]
}
