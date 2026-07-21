// Phase 5 — pure conflict-marker parsing for the resolution modal.
//
// The Rust side ships, per conflicted text file, both the structured `ours` /
// `theirs` blobs (authoritative — used by the whole-file LOCAL/REMOTE buttons)
// and a `merged` blob with git conflict markers (parsed here for the per-hunk
// picker). This module is the ONLY place that interprets markers, kept pure so
// the parsing rules are unit-tested in isolation.
//
// Safety rules that keep dissertation prose intact:
//   - The separator is matched as an EXACT `=======` line, and only ever
//     INSIDE an open `<<<<<<< … >>>>>>>` envelope. A lone `=======` is a Setext
//     h1 underline in real prose and must never be treated as a separator.
//   - `\r` is stripped first so CRLF inputs can't smuggle markers past the
//     anchored checks.
//   - The "unresolved markers" guard keys on the unambiguous `<<<<<<<` /
//     `>>>>>>>` prefixes only — never `=======` — so it can't false-positive on
//     a Setext underline.

export type MergeSegment =
  | { kind: 'stable'; lines: string[] }
  | { kind: 'conflict'; ours: string[]; theirs: string[] };

const START = '<<<<<<<';
const SEP = '=======';
const END = '>>>>>>>';

/**
 * Parse conflict-markered text into ordered stable/conflict segments. A
 * strict, line-anchored state machine; never throws (an unterminated envelope
 * is closed at end-of-input).
 */
export function parseMergedText(merged: string): MergeSegment[] {
  const lines = merged.replace(/\r/g, '').split('\n');
  const segments: MergeSegment[] = [];
  let stable: string[] = [];
  const flushStable = () => {
    if (stable.length) {
      segments.push({ kind: 'stable', lines: stable });
      stable = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith(START)) {
      flushStable();
      i++;
      const ours: string[] = [];
      while (i < lines.length && lines[i] !== SEP && !lines[i].startsWith(END)) {
        ours.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i] === SEP) i++; // consume separator
      const theirs: string[] = [];
      while (i < lines.length && !lines[i].startsWith(END)) {
        theirs.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].startsWith(END)) i++; // consume end marker
      segments.push({ kind: 'conflict', ours, theirs });
    } else {
      stable.push(lines[i]);
      i++;
    }
  }
  flushStable();
  return segments;
}

/** Number of conflict hunks in parsed segments. */
export function conflictCount(segments: MergeSegment[]): number {
  return segments.filter((s) => s.kind === 'conflict').length;
}

/**
 * Reassemble final content from per-hunk choices. `choices[n]` selects the nth
 * conflict hunk's side; lengths must match `conflictCount`. Stable segments are
 * emitted verbatim. Joined with '\n' (the parser split on '\n' after stripping
 * '\r'), so a clean round-trip reproduces the original text exactly.
 */
export function reassemble(segments: MergeSegment[], choices: Array<'ours' | 'theirs'>): string {
  const out: string[] = [];
  let ci = 0;
  for (const seg of segments) {
    if (seg.kind === 'stable') {
      out.push(...seg.lines);
    } else {
      const side = choices[ci] === 'theirs' ? seg.theirs : seg.ours;
      out.push(...side);
      ci++;
    }
  }
  return out.join('\n');
}

/**
 * True if any line begins with the unambiguous `<<<<<<<` / `>>>>>>>` markers —
 * i.e. an unresolved conflict. Deliberately ignores `=======` (a valid Setext
 * underline in prose). Used to block submit / flag manual-edit text.
 */
export function hasUnresolvedMarkers(text: string): boolean {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .some((line) => line.startsWith(START) || line.startsWith(END));
}
