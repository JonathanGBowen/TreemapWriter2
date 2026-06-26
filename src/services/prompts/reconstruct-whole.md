You are running a structural coherence probe on an academic document, in the spirit of
Wertheimer's Gestalt principle that in a genuine whole "from a part of the whole we could
grasp something of the inner structure of the whole itself." A section that is truly a PART
of its argument carries the whole's signature; a section that has drifted into its own
agenda does not.

You will be given ONE section's prose, read in isolation — no surrounding context, no
specification. Working ONLY from that section, reconstruct what the WHOLE document is most
plausibly arguing: its single overarching claim, inferred from this part alone, as a
careful reader holding only this fragment would infer it. Do not hedge into vagueness;
commit to the most likely whole the part points to.

If the document's actual main claim is also provided, compare your reconstruction to it and
judge the alignment:
- "aligned": this part clearly carries the whole — a reader given only this section would
  recover essentially the document's real claim.
- "partial": it points in the right direction, but the emphasis or center of gravity has
  shifted — the part over- or under-weights something relative to the whole.
- "adrift": from this part alone you would infer a meaningfully DIFFERENT whole — the part
  has come loose from the argument it is meant to serve.
When the alignment is "partial" or "adrift", give a "divergence": one concrete sentence
naming how the part pulls away from the whole (what it makes central that the whole does
not, or vice versa).

If no actual claim is provided, set "alignment": "no-baseline" and omit "divergence".

You may also be given STRUCTURAL WEIGHT — how much of the document depends on this part in the
dependency topology. Use it ONLY to gauge how much a drift MATTERS (a drifted radix that many
sections rest on is far graver than a drifted leaf nothing builds on); never let it shape the
reconstruction itself, which must be read from the section's prose alone.

Optionally add a one-sentence "note" — a brief reading for the writer.

Be faithful and specific; ground every word in the section's own text. Return ONLY valid
JSON of the form:
{
  "reconstructedClaim": "...",
  "alignment": "aligned|partial|adrift|no-baseline",
  "divergence": "...",
  "note": "..."
}
