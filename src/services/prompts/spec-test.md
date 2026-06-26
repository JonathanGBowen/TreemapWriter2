You are running a SPEC TEST on ONE section across two versions of the same academic document: VERSION A (earlier) and VERSION B (later). A single STRUCTURED SPECIFICATION — the rubric — is HELD FIXED across both versions. Your job is to judge, move by move, whether B realizes that rubric better or worse than A, and — decisively — whether B's changes serve the section's role in the WHOLE or only improve it as an isolated piece.

Judge this section AS A PART functioning in a WHOLE, never as an isolated piece. The STRUCTURAL SURROUND below is not optional context: the document's main claim is the whole this section serves; the parent claim is its local whole; the preceding section's commitments are what this section's incoming context should build on; the following section's needs are what its outgoing commitments must meet. A section can pass every move on its own terms and still fail as a part — that failure (Wertheimer's tF: "true as a piece, false as a part") is the most important thing this test exists to catch.

For EACH required move in the rubric, assess BOTH versions:
- statusA / statusB: "present" (clearly accomplished), "partial" (attempted but incomplete), "missing" (not addressed), or "unclear" (attempted but confusing) — in version A and in version B respectively.
- advanceA / advanceB: does the move actually FORGE AHEAD, or does it merely restate what the reader already holds? "productive" = it establishes something genuinely new relative to the section's incoming context and its own premises; "recapitulative" = it is true but says nothing new — a result the premises or prior sections already secured, dressed in an externally new form. A move can be "present" and "recapitulative" at once — that pairing is the petitio paragraph, and a move that goes from productive in A to recapitulative in B has DEFLATED (it is now a cut opportunity, not a gain), even though it is still "present". Judge "new relative to what?" against the structural surround. Omit an advance field only if you genuinely cannot tell.
- diagnosis: one concrete line on what changed for this move between A and B.
- receipts: one or more SHORT verbatim quotes copied exactly from A or B, each tagged with its side. No claim about a move without a receipt.

Then assess the section AS A PART:
- wholeSignature (the Beethoven test): reading EACH side's prose ALONE, can the document's main claim be reconstructed from it? "aligned" = the part clearly carries the whole's signature; "partial" = it points the right way but the emphasis has shifted; "adrift" = from this prose you would infer a different whole (the part has come loose). Report it for a and for b — a section that drifts from "aligned" in A to "adrift" in B has regressed as a part even if its local moves improved.
- commitmentDelta: prose-level commitment breaks the revision INTRODUCED or HEALED, judged against the surround. "introduced" = a break absent in A but present in B (B stops delivering an outgoing commitment a later section needs, or no longer builds on the incoming context it relies on — a tF signal). "healed" = a break present in A but resolved in B. Each finding: "kind" ("unmet-incoming" | "dangling-outgoing" | "center-of-gravity"), a concrete "detail", and "relatedSectionTitle" when a neighbour is involved. Report only real breaks; empty lists are the correct answer for a well-meshed revision.
- truth: the structural-truth verdict on B relative to A for THIS section. "whole-true" (locally better AND serves the whole better), "tF" (locally better but the part's role in the whole degraded — a piece-improvement that the whole pays for), "fT" (rougher or less complete in detail yet truer to the whole — e.g. a deliberate simplification that sharpens the part's role; do not punish this), "whole-false" (worse as a part), or "lateral" (changed without a clear direction).
- direction: "improved" | "regressed" | "mixed" | "lateral" — the plain net direction of B vs A for this section.
- summary: one line — the fixed-rubric verdict for this section, naming the whole-vs-piece judgment where it applies.

Return ONLY valid JSON adhering to this schema:
{
  "moveDeltas": [
    {
      "moveId": "move-0",
      "moveDescription": "the move text",
      "statusA": "present|partial|missing|unclear",
      "statusB": "present|partial|missing|unclear",
      "advanceA": "productive|recapitulative",
      "advanceB": "productive|recapitulative",
      "diagnosis": "what changed for this move, one line",
      "receipts": [{ "quote": "verbatim excerpt", "side": "a|b" }]
    }
  ],
  "wholeSignature": { "a": "aligned|partial|adrift", "b": "aligned|partial|adrift" },
  "commitmentDelta": {
    "introduced": [{ "kind": "unmet-incoming|dangling-outgoing|center-of-gravity", "detail": "...", "relatedSectionTitle": "..." }],
    "healed": [{ "kind": "unmet-incoming|dangling-outgoing|center-of-gravity", "detail": "...", "relatedSectionTitle": "..." }]
  },
  "truth": "whole-true|tF|fT|whole-false|lateral",
  "direction": "improved|regressed|mixed|lateral",
  "summary": "one-line fixed-rubric verdict for this section"
}
