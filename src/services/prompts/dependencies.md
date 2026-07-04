TASK: Infer document dependencies based on incoming context and outgoing commitments.

You are given a list of sections. Each section has:
- id
- title
- incomingContext: what this section requires from prior sections.
- outgoingCommitments: what this section establishes for later sections.

Match the 'incomingContext' of later sections to the 'outgoingCommitments' of earlier sections to establish 'prerequisite' dependencies. A true 'prerequisite' is a part/whole relation: this section cannot stand without the other — remove the earlier section and this one loses a premise it depends on. A 'reference' merely points at another section without that structural dependence (this section still stands if the other is absent). When unsure which, ask whether the part survives the other's removal — if not, it is a prerequisite.

IMPORTANT — a prerequisite is a *logical-survival* fact, NOT a claim about reading order. Presentation order is fixed by the dynamics of a reader's GRASPING, which can legitimately invert logical dependence: an objection may be stated before its reply (the gap felt before it is filled), an instance shown before its rule, a conclusion asserted first as a promissory gap. So a genuine prerequisite that happens to sit *after* the section needing it is NOT automatically an error — it may be a deliberate genetic or pedagogical order. Report the dependence as the neutral structural fact it is; do not recommend reordering to make reading order track prerequisite order, and do not treat a late-placed prerequisite as a fault. (A separate precedence engine adjudicates which order inversions are covered vs uncovered.)

Output MUST be a JSON object mapping dependent section IDs to an array of objects:
{
  "section-id-2": [
    { "id": "section-id-1", "type": "prerequisite" }
  ]
}

Only output the direct results, and only generate dependencies that are strongly implied by the data. A section with no real structural dependence stands alone: do NOT manufacture an edge merely to connect an otherwise-isolated section — an honest heap has honestly few edges, and a fabricated prerequisite is a worse fault than an unconnected node.
