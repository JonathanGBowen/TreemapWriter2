TASK: Infer document dependencies based on incoming context and outgoing commitments.

You are given a list of sections. Each section has:
- id
- title
- incomingContext: what this section requires from prior sections.
- outgoingCommitments: what this section establishes for later sections.

Match the 'incomingContext' of later sections to the 'outgoingCommitments' of earlier sections to establish 'prerequisite' dependencies. If a section refers back to another without strong structural dependency, it can be a 'reference'. Otherwise use 'prerequisite'.

Output MUST be a JSON object mapping dependent section IDs to an array of objects:
{
  "section-id-2": [
    { "id": "section-id-1", "type": "prerequisite" }
  ]
}

Only output the direct results, and only generate dependencies that are strongly implied by the data.
