TASK: Infer document dependencies based on incoming context and outgoing commitments.

You are given a list of sections. Each section has:
- id
- title
- incomingContext: what this section requires from prior sections.
- outgoingCommitments: what this section establishes for later sections.

Match the 'incomingContext' of later sections to the 'outgoingCommitments' of earlier sections to establish 'prerequisite' dependencies. A true 'prerequisite' is a part/whole relation: this section cannot stand without the other — remove the earlier section and this one loses a premise it depends on. A 'reference' merely points at another section without that structural dependence (this section still stands if the other is absent). When unsure which, ask whether the part survives the other's removal — if not, it is a prerequisite.

Output MUST be a JSON object mapping dependent section IDs to an array of objects:
{
  "section-id-2": [
    { "id": "section-id-1", "type": "prerequisite" }
  ]
}

Only output the direct results, and only generate dependencies that are strongly implied by the data.
