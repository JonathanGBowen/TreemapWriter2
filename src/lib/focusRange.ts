// Focus mode as a pure CodeMirror extension: ONE document buffer, with the
// surround outside the focused section hidden and edits confined to it. This
// replaces the old two-editor design (a sliced copy written back by string
// concat), whose frozen slices were the root of the section-scoped paste
// corruption — see migration-log 2026-07-08. No React, no store (the lib rule);
// EditorPanel owns computing the range (from a fresh parse of the live doc)
// and dispatching it here.

import { Decoration, type DecorationSet, EditorView, keymap } from '@codemirror/view';
import {
  EditorSelection,
  EditorState,
  Prec,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
} from '@codemirror/state';

export interface FocusRange {
  from: number;
  to: number;
}

/**
 * Set (or clear, with null) the focused span. The range covers the section's
 * fullContent — heading line through its last line, newline-exclusive at both
 * ends, matching lib/section-edit's `sectionRangeInDoc`.
 */
export const setFocusRange = StateEffect.define<FocusRange | null>({
  map: (value, mapping) =>
    value === null
      ? null
      : { from: mapping.mapPos(value.from, -1), to: mapping.mapPos(value.to, 1) },
});

/**
 * The live focused span. Maps itself through every document change —
 * `assoc -1` at the start and `+1` at the end so text typed at the section's
 * edges grows the section rather than leaking into the hidden surround.
 */
export const focusRangeField = StateField.define<FocusRange | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setFocusRange)) value = e.value;
    }
    if (value && tr.docChanged) {
      value = {
        from: tr.changes.mapPos(value.from, -1),
        to: tr.changes.mapPos(value.to, 1),
      };
    }
    return value;
  },
});

/**
 * HIDE everything outside the focused range: at most two widget-less block
 * replace decorations, snapped to line boundaries, rendering NOTHING. This is
 * the blinders behavior the feature exists for (user-tested, essential): the
 * editor shows only the section — no text before or after, and nothing to
 * scroll into, so it is mechanically impossible to wander. The document stays
 * whole underneath (this is pure view), so undo/paste/confinement are
 * untouched. Recomputed from the field, so it follows the mapped range with
 * no state of its own.
 */
const hideBlock = Decoration.replace({ block: true });

const buildSurroundDeco = (state: EditorState): DecorationSet => {
  const range = state.field(focusRangeField);
  if (!range) return Decoration.none;
  const doc = state.doc;
  const from = Math.max(0, Math.min(range.from, doc.length));
  const to = Math.max(from, Math.min(range.to, doc.length));

  const deco = [];
  const firstLine = doc.lineAt(from);
  if (firstLine.number > 1) {
    // Hide from the doc start through the end of the line above the section.
    deco.push(hideBlock.range(0, firstLine.from - 1));
  }
  const lastLine = doc.lineAt(to);
  if (lastLine.number < doc.lines) {
    // Hide from the start of the line below the section through the doc end.
    deco.push(hideBlock.range(lastLine.to + 1, doc.length));
  }
  if (!deco.length) return Decoration.none;
  return Decoration.set(deco);
};

const surroundDecoField = StateField.define<DecorationSet>({
  create: buildSurroundDeco,
  update(_deco, tr) {
    return buildSurroundDeco(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Arrow/Home/End navigation skips over the hidden surround. */
const atomicSurround = EditorView.atomicRanges.of((view) => view.state.field(surroundDecoField));

/** User-driven events that must stay inside the focus range. */
const isConfinedUserEvent = (tr: Transaction): boolean => {
  const evt = tr.annotation(Transaction.userEvent);
  if (!evt) return false; // programmatic (uiw value reconcile, effects) — never block
  return evt.startsWith('input') || evt.startsWith('delete') || evt.startsWith('move');
};

/**
 * Confine the writer's edits to the focused span. Only direct user events are
 * filtered — programmatic transactions (the controlled-value reconcile from
 * the store, undo/redo, our own effects) must pass or external writes and
 * history would deadlock against the filter. Boundary inserts (typing at the
 * very start/end of the section) are allowed; anything reaching past either
 * edge blocks the whole transaction.
 */
const confineToFocus = EditorState.transactionFilter.of((tr) => {
  const range = tr.startState.field(focusRangeField);
  if (!range || !tr.docChanged || !isConfinedUserEvent(tr)) return tr;
  let inside = true;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (fromA < range.from || toA > range.to) inside = false;
  });
  return inside ? tr : [];
});

/**
 * Select-all inside focus selects the SECTION, not the hidden whole document —
 * so Mod-a + Delete clears exactly what's on screen (and passes the confinement
 * filter) instead of silently no-oping against it. High precedence to shadow
 * defaultKeymap's selectAll; falls through when no range is active.
 */
const selectFocusedSection = (view: EditorView): boolean => {
  const range = view.state.field(focusRangeField);
  if (!range) return false;
  view.dispatch({
    selection: EditorSelection.range(range.from, range.to),
    userEvent: 'select',
  });
  return true;
};

const focusKeymap = Prec.high(keymap.of([{ key: 'Mod-a', run: selectFocusedSection }]));

/**
 * The complete focus-mode bundle. Always installed; dormant (zero decorations,
 * filter pass-through) until a range is dispatched via `setFocusRange`.
 */
export const focusModeExtension: Extension = [
  focusRangeField,
  surroundDecoField,
  confineToFocus,
  atomicSurround,
  focusKeymap,
];
