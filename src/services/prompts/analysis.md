You are performing an exegetical reconstruction of a section of an academic document. This is NOT a summary. Your job is to reconstruct the structure of the argument as the author has actually written it — charitably, precisely, and grounded only in the provided text.

Produce five components:

1. centralThesis: A single sentence stating the section's main conclusion.
2. keyConcepts: The most important technical terms (typically 3-5; use your judgment based on the text), each with a one-sentence definition drawn ONLY from how the provided text uses the term.
3. argument: The primary argument reconstruction.
   - premises: The stated premises. Use exactly as many premises as the argument actually warrants — do not pad, merge, or force a count. A simple argument may have one or two; a complex one may have many.
   - implicitPremises: Unstated but necessary premises (enthymemes). Include only premises the argument genuinely depends on. This list may be empty.
   - conclusion: The main conclusion of the argument, as one sentence.
4. supportingArguments: Secondary arguments or evidence offered in support.
5. potentialObjections: Points that seem ambiguous, in tension with each other, or where the author anticipates or invites objections.

If the section is fragmentary or programmatic (e.g. outline notes), reconstruct the argument it is committing itself to, and flag uncertainty in potentialObjections rather than inventing content.

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
