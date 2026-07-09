// Paste hygiene for the writing surface: strip the invisible junk that rides
// along with text copied from browsers and word processors (zero-width
// characters, BOMs, non-breaking spaces) before it enters the manuscript.
// Deliberately conservative — visible characters (curly quotes, dashes) are
// the writer's own business; CodeMirror already normalizes line endings.

import { EditorView } from '@codemirror/view';

const INVISIBLES = /[\u200B\u200C\u200D\uFEFF]/g;
const NBSP = /\u00A0/g;

export const cleanPastedText = (text: string): string =>
  text.replace(INVISIBLES, '').replace(NBSP, ' ');

export const pasteHygiene = EditorView.domEventHandlers({
  paste(event, view) {
    const text = event.clipboardData?.getData('text/plain');
    if (!text) return false;
    const cleaned = cleanPastedText(text);
    if (cleaned === text) return false; // nothing to fix — let CodeMirror handle it
    event.preventDefault();
    view.dispatch({
      ...view.state.replaceSelection(cleaned),
      userEvent: 'input.paste',
      scrollIntoView: true,
    });
    return true;
  },
});
