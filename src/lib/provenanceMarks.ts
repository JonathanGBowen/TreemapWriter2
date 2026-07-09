import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { StateEffect, StateField, type Range } from '@codemirror/state';
import type { ProvenanceMark } from '../types';

/**
 * Push the current provenance marks into the editor. Dispatched from the
 * per-surface `useProvenanceSync` hook, which owns the store coupling — this
 * module stays store-free (the lib/ rule).
 */
export const setProvenanceMarks = StateEffect.define<ProvenanceMark[]>();

const aiMark = Decoration.mark({ class: 'cm-ai-prose' });

/**
 * Where a mark's span begins in `doc`, or -1. Prefers a position `hint` when the
 * anchor still matches there (the accept-time offset, or the mapped live offset)
 * — pinning the tint to the occurrence that was actually written even when the
 * inserted phrase has an earlier duplicate. Falls back to literal `indexOf`
 * (the legacy contract): a mark whose anchor is gone simply doesn't render —
 * the prose is now the writer's own.
 */
export const locateMark = (doc: string, mark: ProvenanceMark, hint?: number | null): number => {
  const anchor = mark.anchor;
  if (!anchor) return -1;
  if (anchorMatchesAt(doc, anchor, hint)) return hint as number;
  return doc.indexOf(anchor);
};

const anchorMatchesAt = (doc: string, anchor: string, pos?: number | null): boolean =>
  pos != null &&
  pos >= 0 &&
  pos + anchor.length <= doc.length &&
  doc.slice(pos, pos + anchor.length) === anchor;

/** Build the decoration set for marks located at the given offsets. */
const buildDeco = (docLength: number, marks: ProvenanceMark[], offsets: number[]): DecorationSet => {
  const ranges: Range<Decoration>[] = [];
  marks.forEach((m, i) => {
    const from = offsets[i];
    if (from < 0) return;
    const to = Math.min(from + Math.max(m.length, m.anchor.length), docLength);
    if (to > from) ranges.push(aiMark.range(from, to));
  });
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(ranges);
};

/** Test seam: resolve marks against a plain document string (no editor state). */
export const buildProvenanceDeco = (doc: string, marks: ProvenanceMark[]): DecorationSet => {
  if (!marks.length) return Decoration.none;
  return buildDeco(
    doc.length,
    marks,
    marks.map((m) => locateMark(doc, m, m.offset)),
  );
};

interface ProvenanceState {
  marks: ProvenanceMark[];
  /** Live position of each mark (-1 = unresolved), mapped through edits. */
  offsets: number[];
  deco: DecorationSet;
}

/**
 * Editor decorations for the provenance layer (F2). On `setProvenanceMarks` each
 * mark resolves at its recorded accept-time offset (validated against the live
 * text, `indexOf` fallback); on document changes the live offsets MAP through the
 * change set and re-validate — so the tint follows its exact span across edits
 * and can never jump to an earlier duplicate of the same opening.
 */
export const provenanceField = StateField.define<ProvenanceState>({
  create() {
    return { marks: [], offsets: [], deco: Decoration.none };
  },
  update(value, tr) {
    let { marks, offsets } = value;
    let changed = false;
    for (const e of tr.effects) {
      if (e.is(setProvenanceMarks)) {
        marks = e.value;
        const doc = tr.state.doc.toString();
        offsets = marks.map((m) => locateMark(doc, m, m.offset));
        changed = true;
      }
    }
    if (!changed && tr.docChanged) {
      const doc = tr.state.doc.toString();
      offsets = marks.map((m, i) => {
        const prev = offsets[i];
        if (prev >= 0) {
          // A TRACKED span maps through the change and must still validate at
          // its mapped position. If it doesn't, the writer rewrote the span's
          // opening — the mark FALLS OFF (the prose is theirs now). No indexOf
          // fallback here: that would jump the tint onto an earlier duplicate
          // of the same opening, mis-attributing the writer's own prose.
          const mapped = tr.changes.mapPos(prev, 1);
          return anchorMatchesAt(doc, m.anchor, mapped) ? mapped : -1;
        }
        // An UNRESOLVED mark keeps trying a fresh resolve (offset hint, then
        // indexOf) so an undo that restores the span re-lights its tint.
        return locateMark(doc, m, m.offset);
      });
      changed = true;
    }
    if (!changed) return value;
    return { marks, offsets, deco: buildDeco(tr.state.doc.length, marks, offsets) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});
