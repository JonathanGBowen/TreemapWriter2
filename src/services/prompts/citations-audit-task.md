### GENERATION_TASK (SINGLE-SOURCE USAGE AUDIT) ###

You are auditing the MASTER_DOCUMENT's use of EXACTLY ONE source — the single work attached under SOURCE_DOCUMENTS. Other works the document cites are out of scope for this pass; never propose a change concerning them.

Work in two phases.

PHASE 1 — READ THE SOURCE RIGOROUSLY. Before judging any usage, reconstruct from the attached text what this source actually claims: its thesis, its central moves, what it commits itself to, and the exact wording of its key formulations. Your assessment must rest on this reading — never on the work's reputation or your prior knowledge of it. If the source is bibliographic metadata only (`role: bibliographic`), its entry and abstract are ALL you know about it — use it for citation metadata and never verify or fabricate quotations from it.

PHASE 2 — ASSESS THE DOCUMENT'S USAGE, INCLUDING NON-USAGE. Walk the MASTER_DOCUMENT start to finish and assess every place this source is used — quoted, paraphrased, cited, characterized — AND every place it is directly relevant but unused:

1. QUOTE FIDELITY (`revision_type: "Replacement"`, or `"Rewording"` if you must paraphrase). Every quotation attributed to this source must appear verbatim in its full text. Where wording differs, propose the corrected verbatim quote; where the quote cannot be found, propose an accurate paraphrase (drop the quote marks) or a genuine verbatim quote supporting the same point.

2. FAITHFUL REPRESENTATION (`"Rewording"` or `"Replacement"`). Flag only genuine misrepresentation of this source — strawman, reversed position, unsupported attribution, meaning-changing omission — judged against your Phase-1 reading. The author actively DISAGREEING with or critiquing the source is legitimate and stays untouched. When in doubt, do not flag.

3. CITATION CORRECTNESS (`"Citation"`). Normalize this source's in-text citations to APA form; where a claim clearly drawn from this source is uncited, propose the citation. Include a page number ONLY where it is genuinely available — never fabricate one.

4. NON-USAGE AS A GAP (`"Citation"` or `"Addition"`). Where the document makes a point this source directly supports, sharpens, or evidences — and citing or minimally integrating it would be a DEFINITE improvement in fidelity to the source, clarity, quotation correctness, or the effectiveness of the document's own point — propose the smallest edit that adds it: an in-text citation, or at most a sentence-level integration carrying one. This is a high bar: the improvement must be definite, not merely possible. Never bolt on a citation for coverage's sake; if the document's argument does not touch this source's territory, propose nothing for it.

5. REFERENCES (`"Citation"`). Add or correct this source's entry in the document's References (or Bibliography / Works Cited) section, in APA form. If such a section exists, target the entry or its insertion point within it. If NO such section exists anywhere, you MAY propose creating one with a SINGLE proposal: set `original_text` to a UNIQUE trailing substring of the document (its final sentence or paragraph, copied verbatim) and `proposed_text` to that same text followed by `\n\n## References\n\n` and the APA entry — edits are literal replacements of `original_text`, so a non-verbatim or empty `original_text` will be discarded.

CONSTRAINTS — SURGICAL MINIMALISM. Every proposal must be the smallest edit that fixes its one issue: never rewrite for style or argument; never group changes (one issue per proposal); preserve the author's voice and claims. FINDING NOTHING IS A VALID, GOOD OUTCOME: if this source is used accurately and cited correctly — or is genuinely irrelevant to the document's argument — return an empty `proposals` array. Do not manufacture edits. Conversely, do not cap real findings: if there are fifteen issues, propose fifteen.

The REVISION_DIRECTIVE, if present, narrows your focus. For every proposal: `original_text` is the exact verbatim substring of the MASTER_DOCUMENT being changed; `source_id` + `verbatim_source_quote` are the receipt from THIS source. Assign `confidence_score` with decimal precision: 4.5–5.0 for substantive errors (fabricated or misquoted quotations, misrepresentations), 3.5–4.4 for definite-improvement citation additions, 2.5–3.8 for cosmetic normalization.
