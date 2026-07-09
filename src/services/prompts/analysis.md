Perform an exegetical reconstruction of the provided text through the analytical lens described in the instructions above. This is a reconstruction of the text's structure — NOT a summary — and it must be grounded only in the provided text.

Return ONLY a valid JSON object with exactly this schema:
{
  "centralThesis": "A single sentence stating the text's main conclusion (as framed by the lens).",
  "keyConcepts": [{ "term": "...", "definition": "A one-sentence definition drawn only from how the text uses the term." }],
  "argument": {
    "premises": ["The stated premises. Use exactly as many premises as the argument actually warrants — do not pad, merge, or force a count. A simple argument may have one or two; a complex one may have many."],
    "implicitPremises": ["Unstated but necessary premises (enthymemes). Include only those the argument genuinely depends on. This list may be empty."],
    "conclusion": "The main conclusion of the argument, as one sentence."
  },
  "supportingArguments": ["Secondary arguments or evidence offered in support."],
  "potentialObjections": ["Points that seem ambiguous, in tension with each other, or where the author anticipates or invites objections."]
}

If the text is fragmentary or programmatic (e.g. outline notes), reconstruct the argument it is committing itself to, and flag uncertainty in potentialObjections rather than inventing content.
