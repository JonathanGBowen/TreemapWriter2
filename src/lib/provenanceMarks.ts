import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { StateEffect, StateField, type Range } from '@codemirror/state';
import type { ProvenanceMark } from '../types';

/**
 * Push the current provenance marks into the editor. Dispatched from EditorPanel,
 * which owns the store coupling — this module stays store-free (the lib/ rule).
 */
export const setProvenanceMarks = StateEffect.define<ProvenanceMark[]>();

const aiMark = Decoration.mark({ class: 'cm-ai-prose' });

/**
 * Resolve each mark against the live document by literal anchor `indexOf` and
 * decorate its span. A mark whose anchor is gone (the writer rewrote the opening)
 * simply doesn't render — the prose is now theirs. No store, no React: unit-testable.
 */
export const buildProvenanceDeco = (doc: string, marks: ProvenanceMark[]): DecorationSet => {
  if (!marks.length) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  for (const m of marks) {
    if (!m.anchor) continue;
    const from = doc.indexOf(m.anchor);
    if (from < 0) continue;
    const to = Math.min(from + Math.max(m.length, m.anchor.length), doc.length);
    if (to > from) ranges.push(aiMark.range(from, to));
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(ranges);
};

interface ProvenanceState {
  marks: ProvenanceMark[];
  deco: DecorationSet;
}

/**
 * Editor decorations for the provenance layer (F2). Rebuilds when the marks change
 * (via `setProvenanceMarks`) or the document changes (anchors re-resolve against the
 * new text, so a mark tracks its span across edits and falls off when overwritten).
 */
export const provenanceField = StateField.define<ProvenanceState>({
  create() {
    return { marks: [], deco: Decoration.none };
  },
  update(value, tr) {
    let marks = value.marks;
    let changed = false;
    for (const e of tr.effects) {
      if (e.is(setProvenanceMarks)) {
        marks = e.value;
        changed = true;
      }
    }
    if (changed || tr.docChanged) {
      return { marks, deco: buildProvenanceDeco(tr.state.doc.toString(), marks) };
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});
