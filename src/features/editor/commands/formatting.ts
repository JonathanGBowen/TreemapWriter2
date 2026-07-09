// Markdown formatting commands for the writing surface (the editor-command
// home AGENTS.md names). Quiet by design: two chords the hand already knows,
// no toolbar. Each toggles — wrapping the selection (or the word around an
// empty cursor) and unwrapping when already wrapped.

import type { Command } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';

const wordAround = (text: string, from: number, to: number): { from: number; to: number } => {
  if (from !== to) return { from, to };
  let a = from;
  let b = to;
  while (a > 0 && /\w/.test(text[a - 1])) a--;
  while (b < text.length && /\w/.test(text[b])) b++;
  return { from: a, to: b };
};

const toggleWrap =
  (marker: string): Command =>
  (view) => {
    const { state } = view;
    const changes = state.changeByRange((range) => {
      const doc = state.doc.toString();
      const { from, to } = wordAround(doc, range.from, range.to);
      const len = marker.length;
      const before = doc.slice(Math.max(0, from - len), from);
      const after = doc.slice(to, to + len);
      const inner = doc.slice(from, to);

      // Unwrap: markers just outside the span, or just inside it.
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: from - len, to: from },
            { from: to, to: to + len },
          ],
          range: EditorSelection.range(range.from - len, range.to - len),
        };
      }
      if (inner.startsWith(marker) && inner.endsWith(marker) && inner.length >= 2 * len) {
        return {
          changes: [
            { from, to: from + len },
            { from: to - len, to },
          ],
          range: EditorSelection.range(Math.max(from, range.from - len), Math.max(from, range.to - len)),
        };
      }

      // Wrap. An empty cursor with no word lands between the markers.
      return {
        changes: [
          { from, insert: marker },
          { from: to, insert: marker },
        ],
        range:
          from === to
            ? EditorSelection.cursor(from + len)
            : EditorSelection.range(range.from + len, range.to + len),
      };
    });
    view.dispatch(state.update(changes, { userEvent: 'input.format', scrollIntoView: true }));
    return true;
  };

export const toggleBold = toggleWrap('**');
export const toggleItalic = toggleWrap('*');

export const formattingKeymap: readonly KeyBinding[] = [
  { key: 'Mod-b', run: toggleBold, preventDefault: true },
  { key: 'Mod-i', run: toggleItalic, preventDefault: true },
];
