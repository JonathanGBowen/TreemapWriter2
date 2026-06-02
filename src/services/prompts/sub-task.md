Analyze the following subsections. For each, produce a structured specification
that is CONSISTENT with and SUBORDINATE TO its parent section's specification.

The parent's outgoing commitments constrain what this subsection can promise.
The parent's required moves may decompose into this subsection's moves.

CLASSIFICATION: Assign a primary rhetorical function:
introduce | explicate | argue | compare | critique | synthesize | apply | evaluate | narrate | transition

MAIN CLAIM: The core proposition, as a logician's one-sentence reconstruction.

REQUIRED MOVES: 2-5 concrete paragraph-level tasks. Be MORE specific than parent-level
moves — these should be close to actionable writing tasks.
For a subsection, "Reconstruct Koffka's argument from premises P1-P3 to conclusion C"
is better than "Discuss Koffka's argument."

INCOMING CONTEXT: What does this subsection receive from its parent or siblings?

OUTGOING COMMITMENTS: What must it establish for sibling subsections or the parent's argument?

CRITICAL: You MUST include a key-value pair for EVERY single section ID passed to you. Do not drop or skip any sections.

Return a JSON object:
{
  "section-id": {
    "function": "...",
    "mainClaim": "...",
    "requiredMoves": ["...", "..."],
    "incomingContext": ["...", "..."],
    "outgoingCommitments": ["...", "..."]
  }
}
