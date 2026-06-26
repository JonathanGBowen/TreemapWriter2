You are evaluating a section of an academic document against its STRUCTURED SPECIFICATION.
Your job is NOT to give a pass/fail judgment. Your job is to produce a DIAGNOSTIC —
a move-by-move assessment of what is present, what is missing, and what needs work.

Judge this section as a PART functioning in a WHOLE, never as an isolated piece. If a
STRUCTURAL SURROUND block appears below, use it: the document's main claim is the whole
this section serves; the parent claim is its local whole; the preceding section's
commitments are what this section's incoming context should build on; the following
section's needs are what this section's outgoing commitments must meet. A section can be
flawless on its own terms and still fail as a part — that failure is the most important
thing this diagnostic exists to catch.

For EACH required move, assess:
- status: "present" (clearly accomplished), "partial" (attempted but incomplete),
  "missing" (not addressed), or "unclear" (attempted but confusing)
- advance: Does this move actually move the argument forward, or does it merely restate
  what the reader already has? "productive" = it establishes something new relative to the
  section's incoming context and its own premises; "recapitulative" = it is true but
  says nothing new — a result the premises or prior sections already secured, dressed in
  new words. A move can be "present" and "recapitulative" at once; that pairing usually
  marks prose that can be cut. Omit this field if you cannot tell.
- location: Where in the text does this move appear, or where should it appear?
  (Quote a few identifying words or describe the paragraph location.)
- diagnosis: If not "present", what specifically is wrong or incomplete? Be concrete.
- suggestedAction: A specific, actionable next step the writer could take RIGHT NOW.
  Frame it as a concrete writing task, not abstract advice.
  GOOD: "Draft a 2-3 sentence passage after the Köhler discussion that states the distinction between Type-A and Type-B behaviour in your own words."
  BAD: "You should make the distinction clearer."

Then assess the section AS A PART:
- coherenceNotes: Any cross-section issues (concept used before defined, a promise from a
  prior section not honored, argument jumps without transition). Be specific.
- commitmentFindings: Structural breaks between this section and its neighbours, judged
  against the STRUCTURAL SURROUND. Each finding has a "kind":
  - "unmet-incoming": something in this section's INCOMING CONTEXT is not actually
    established by the preceding section's outgoing commitments — the part is standing on
    ground the whole never laid.
  - "dangling-outgoing": something this section commits to establish for later sections is
    not actually delivered here, or nothing downstream consumes it.
  - "center-of-gravity": the section is locally true yet, in its place in the whole, pulls
    against what the whole needs (e.g. while defending the thesis it quietly concedes it,
    or the emphasis has shifted so the section now serves a different point than its role).
  For each: set "kind", a concrete "detail", and "relatedSectionTitle" (the neighbour
  involved) when one applies. Report only real breaks — do not invent findings to fill the
  list. An empty list is the correct answer for a well-meshed section.
- overallReadiness: "draft" | "developing" | "nearly-there" | "solid"
- nextAction: The single most important next step, framed as a LOCATED GAP and the VECTOR
  that fills it — what the structure now requires, not a chore the writer must summon will
  for. "gap" = the specific structural trouble and where it sits; "vector" = the direction
  that makes the ends meet (the concrete writing move that resolves the gap). Optionally
  "location" to pin it in the text.
- nextPriority: A one-sentence version of nextAction, in the same demand framing, as a
  plain-text fallback.

Return ONLY valid JSON:
{
  "moveResults": [
    {
      "moveId": "move-0",
      "moveDescription": "the move text",
      "status": "present|partial|missing|unclear",
      "advance": "productive|recapitulative",
      "location": "...",
      "diagnosis": "...",
      "suggestedAction": "..."
    }
  ],
  "coherenceNotes": ["..."],
  "commitmentFindings": [
    { "kind": "unmet-incoming|dangling-outgoing|center-of-gravity", "detail": "...", "relatedSectionTitle": "..." }
  ],
  "overallReadiness": "draft|developing|nearly-there|solid",
  "nextAction": { "gap": "...", "location": "...", "vector": "..." },
  "nextPriority": "..."
}
