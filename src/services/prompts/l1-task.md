Analyze the following top-level sections of a document. For EACH section, produce a structured specification.

CLASSIFICATION: Assign each section a primary rhetorical function from this list:
introduce | explicate | argue | compare | critique | synthesize | apply | evaluate | narrate | transition

MAIN CLAIM: Reconstruct the core proposition as a single sentence a logician would recognize.
This is the claim that, if removed, would make the section pointless.

REQUIRED MOVES: List 3-7 concrete things the section must DO to succeed.
These should be at paragraph-level granularity. Examples of good moves:
- "Define [concept X] using [author Y]'s formulation, distinguishing it from [common misreading Z]"
- "Present the experimental paradigm of [study] in enough detail to evaluate the inference drawn from it"
- "Articulate the tension between [position A] and [position B] that motivates the chapter"
- "Establish that [claim] follows from [premises] laid out in the prior section"

Bad moves (too vague to act on):
- "Discuss the topic clearly"
- "Make a strong argument"
- "Be rigorous"

INCOMING CONTEXT: What concepts, claims, or distinctions from earlier in the document
does this section depend on? Specify these so they INTERLOCK with the preceding section's outgoing commitments — name what this section needs an earlier one to have established, not a free-standing wish. (For the first section, this may be empty or refer to the reader's assumed background.)

OUTGOING COMMITMENTS: What must this section establish that later sections will build on? Make each one something a later section's incoming context can actually receive — the commitments a section makes and the needs the next one brings are two halves of ONE mesh, not independent lists.

CRITICAL: You MUST include a key-value pair for EVERY single section ID passed to you. Do not drop or skip any sections, even if they are short.

Return a JSON object:
{
  "section-id": {
    "function": "introduce|explicate|argue|...",
    "mainClaim": "...",
    "requiredMoves": ["...", "..."],
    "incomingContext": ["...", "..."],
    "outgoingCommitments": ["...", "..."]
  }
}
