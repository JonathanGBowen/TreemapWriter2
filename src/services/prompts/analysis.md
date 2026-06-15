Analyze the following text. Provide your output in JSON format, adhering strictly to the provided schema.

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
