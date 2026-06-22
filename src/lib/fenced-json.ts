// Pull a JSON proposal out of a model's prose+JSON turn.
//
// The collaborative spec-development path asks the agent to converse and then emit
// its proposal as one fenced ```json``` block. The model may show intermediate
// drafts, so we take the LAST fenced block (the final proposal). Falls back to null
// when there is no fence — the caller then hands the whole text to the tolerant
// `safeJsonParse`, matching how the rest of the app extracts JSON from prose.

/** The last fenced code block's body (``` or ```json), trimmed; null if none. */
export function extractFencedJson(text: string): string | null {
  const fenceRe = /```(?:json)?\s*\r?\n?([\s\S]*?)```/gi;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) last = m[1];
  return last !== null ? last.trim() : null;
}
