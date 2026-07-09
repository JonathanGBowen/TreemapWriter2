// The one-shot "you arrived here" line pulse — the moment-of-consequence cue
// for landing somewhere by navigation (section select, gist-span click,
// accepted-edit reveal). Promoted from GistEditorSurface so every prose
// surface shares one primitive. Styling: `.gist-pulse-line` (src/index.css),
// which already carries the reduced-motion fallback.

import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';

/** Pulse the line containing the given offset; null clears the pulse. */
export const pulseEffect = StateEffect.define<number | null>();

export const pulseField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(pulseEffect)) {
        if (e.value == null) {
          deco = Decoration.none;
        } else {
          const line = tr.state.doc.lineAt(Math.max(0, Math.min(e.value, tr.state.doc.length)));
          deco = Decoration.set([Decoration.line({ class: 'gist-pulse-line' }).range(line.from)]);
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Flash the landing line at `pos`, auto-clearing after the keyframe finishes.
 * Safe against a view that unmounts mid-pulse (the timeout re-checks).
 */
export const pulseAt = (view: EditorView, pos: number): void => {
  view.dispatch({ effects: pulseEffect.of(pos) });
  window.setTimeout(() => {
    try {
      view.dispatch({ effects: pulseEffect.of(null) });
    } catch {
      /* view was destroyed; nothing to clear */
    }
  }, 650);
};
