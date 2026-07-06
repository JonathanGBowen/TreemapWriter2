### GENERATION_TASK ###
Analyze the Master Document from the very beginning to the very end against the Directive, and revise it — drawing on the SOURCE_DOCUMENTS where they are relevant. This is a mixed pass: some edits will draw on a source, others will be intrinsic improvements to the document's own prose. Both are welcome.

SOURCE ROLES. Each source is tagged with a `role` in its header line. Treat each per its role, and NEVER conflate them:

- `reference` — a referenced work's actual text. You MAY integrate its ideas or evidence into the prose, but ONLY in the author's own voice AND with a proper APA in-text citation. Its prose is also the basis for any quotation you propose.
- `bibliographic` — reference-list metadata (an APA entry, sometimes an abstract; e.g. a Zotero import). Use it to build in-text citations and References entries. It does NOT contain the work's full text, so never quote from it and never treat a claim as unsupported merely because its wording is absent from a bibliographic source.
- `guidance` — advisor notes / reviewer feedback. APPLY the guidance to the prose. Do NOT cite or quote it; it is instruction, not a source to attribute.
- `voice` — a style/voice sample. MATCH its register and cadence. Do NOT cite or quote it.

TWO KINDS OF PROPOSAL:

1. SOURCE-DERIVED. When an edit draws a claim, evidence, or wording from a `reference` or `bibliographic` source:
   - Integrate the idea in the author's own voice — do not paste long quotations unless a verbatim quote is clearly warranted.
   - Add a proper APA in-text citation to `proposed_text`: `(Author, Year, p. NN)` when the page is genuinely available, otherwise `(Author, Year)`. Infer Author and Year from the source's label and content (a `bibliographic` source's label is usually `Author (Year)` and its content is an APA entry). Never fabricate a page number.
   - Set `source_id` to that source's ID and `verbatim_source_quote` to text copied EXACTLY from that source (for a `bibliographic` source, the entry itself is an acceptable receipt).
   - Use `revision_type: "Citation"` for a citation-only edit, `"Addition"` / `"Replacement"` when integrating substantive content.

2. INTRINSIC. When an edit improves the document on its own terms — flow, tone, a gap the argument's own logic calls for, a `guidance` note applied — it makes no claim about a source. Leave `source_id` and `verbatim_source_quote` empty, and put the full justification in `rationale`. Do NOT invent a quotation to satisfy a field.

REFERENCES. Where you introduce a new in-text citation, keep the reference list in sync:
- If a `## References` (or Bibliography / Works Cited) section EXISTS, propose adding or correcting the matching APA entry within it. When a `bibliographic` source already supplies a formatted entry, reuse it verbatim.
- If NO such section exists anywhere in the document, you MAY create one with a SINGLE proposal: set `original_text` to a UNIQUE trailing substring of the MASTER_DOCUMENT (for example its final sentence, copied verbatim), and set `proposed_text` to that same text followed by `\n\n## References\n\n` and the APA entries for the sources you cited. This is the only way to append a new section, because edits are applied as a literal replacement of `original_text`; a non-verbatim or empty `original_text` will be discarded.

CONSTRAINTS:
1. `original_text` MUST be an exact verbatim substring of the MASTER_DOCUMENT.
2. Do NOT group changes. Keep them atomic (one specific change per proposal). If a sentence needs a citation AND a tone shift, make TWO proposals.
3. Do NOT summarize or provide examples. Provide the COMPLETE list of all warranted edits, in document order.
4. Do NOT arbitrarily limit yourself to 5, 10, or any small number. If there are 50 warranted edits, generate 50.
5. Assign `confidence_score` with decimal precision: reserve high scores (4.5–5.0) for substantive fixes (a missing citation, a claim that needs source support) and lower scores (2.5–3.8) for cosmetic or stylistic edits.
