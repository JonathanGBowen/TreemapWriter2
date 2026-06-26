Analyze the following text. Provide your output in JSON format, adhering strictly to the provided schema.

Reconstruct the argument as a PART of its whole, not as a free-standing piece. If a
STRUCTURAL SURROUND block appears below, let it inform the reconstruction: how this
section's thesis depends on the incoming context the prior sections were meant to
establish, and what it in turn commits to the sections that follow. A concept's role in
the whole may shape its definition (the same term can do different work in different
places) — but still define every concept only from what the provided text actually says;
do not import claims the text does not make.

Five sections are required:
1. Central Thesis: A single sentence stating the author's main conclusion.
2. Key Concepts: A list of the 3-5 most important technical terms, with a one-sentence definition for each based only on the provided text.
3. Primary Argument Reconstruction: Identify stated and unstated premises and the conclusion.
4. Supporting Arguments/Evidence: A list of secondary arguments or evidence.
5. Potential Objections/Ambiguities: Note any points in the text that seem ambiguous, self-contradictory, or for which the author anticipates objections.

Return ONLY valid JSON:
{
  "centralThesis": "...",
  "keyConcepts": [{ "term": "...", "definition": "..." }],
  "argument": {
    "premises": ["..."],
    "implicitPremises": ["..."],
    "conclusion": "..."
  },
  "supportingArguments": ["..."],
  "potentialObjections": ["..."]
}
