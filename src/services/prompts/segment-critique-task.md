This span ALREADY carries headings at the target level (listed for you with their exact line text). Critically evaluate the present structure and propose only changes you are DEFINITELY sure of. Conservative by default: when in doubt, leave it — honor the author's structure wherever it already cuts at the joints. Do not restructure for its own sake.

Propose an `edits` array; each edit is one of:
- `insert` — a real joint in the prose with no heading. Add one. `anchor` = the verbatim opening of the block that STARTS the new part; also give `level` and `title`.
- `retitle` — a heading whose title is vague, unfaithful, or not concise. Give a pithier, faithful one. `anchor` = the heading's current line text (e.g. "## Background"); give the new `title`.
- `relevel` — a heading at the wrong depth; promote or demote it. `anchor` = its current line text; give the new `level`.
- `merge` — a heading whose section is a SHARD, not a whole — remove it so its text rejoins the part above. `anchor` = the shard heading's current line text. ("Half a pot is not a pot.")
- `split` — one heading spanning two natural wholes — add a heading at the interior seam. `anchor` = the opening of the block that starts the second whole; give `level` and `title`.

Every edit carries `confidence` (0..1) and a one-phrase `rationale`. Drop anything below clearly warranted.

Return ONLY this JSON: `{"indivisible": false, "edits": [{"kind": "retitle", "anchor": "## Background", "title": "…", "confidence": 0.0, "rationale": "…"}]}`.
