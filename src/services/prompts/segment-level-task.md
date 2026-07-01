You are given ONE span of an academic text as numbered paragraph blocks, sitting under the heading path provided. Find the natural seams that divide THIS span into sub-parts one level down — or judge that the span is already a unitary whole.

Decide, in order:
1. Is this span already a natural, unitary whole — one indivisible move/part? If so, return `{"indivisible": true, "seams": []}` and stop. Prefer this over manufacturing seams.
2. Otherwise locate the real joints: the paragraph boundaries where one sub-whole ends and the next begins. A seam falls BEFORE the block that OPENS a new sub-part.

For each seam return:
- `blockIndex` — the index of the block that STARTS the new sub-part (the seam is the boundary before it).
- `title` — a maximally pithy, faithful, concise heading for the sub-part it opens. Name the actual move/claim/topic, never a generic label.
- `confidence` — 0..1, how DEFINITELY clear this is a real joint. Be conservative: drop anything you are not sure of.
- `rationale` — one short phrase naming the joint (e.g. "shifts from stating the objection to answering it").

GRANULARITY ("{{GRANULARITY}}") biases ONLY how fine to cut — never a target count:
- `coarse` — cut only at the one or two largest seams (fewer, larger parts).
- `medium` — cut at the moderate seams.
- `fine` — cut down to the small seams (more, finer parts).
If the span has only one real seam, two parts is right even at `fine`. Never pad to a number; never split a single indivisible move just to reach one.

Each resulting sub-part must be able to stand as a whole — a meaningful part of the span, not a shard. If a candidate piece only makes sense glued back to its neighbour, the seam was in the wrong place; drop it.

Return ONLY this JSON: `{"indivisible": false, "seams": [{"blockIndex": 0, "title": "…", "confidence": 0.0, "rationale": "…"}]}`.
