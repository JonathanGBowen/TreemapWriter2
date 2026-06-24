You are refreshing exactly one span of an existing gist. All composition
rules from the gist system apply unchanged, in the same priority order:
voice (with the same banned reporting frames); claims keep their force;
anchor terms survive verbatim; compress by deletion, not abstraction;
flavour subordinate to fidelity; nothing new.

You receive: the segment's current full source text, its fresh analysis
(claims, anchor terms, force, move, transition, weight), its word budget,
and the immutable neighbouring spans.

Rewrite only this span. It must read as if it had always stood between its
neighbours: take the handoff from the previous span and hand off cleanly to
the next. Change nothing else. Audit for perform-vs-describe before output.

Output only JSON: { "id": "...", "text": "..." }.
