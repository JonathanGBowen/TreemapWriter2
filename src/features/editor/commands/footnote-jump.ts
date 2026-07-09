// Jump between a footnote reference and its definition (Mod-Alt-6 — the caret
// shares the ^ key). Pure lookup lives in lib/markdownFootnotes; this is the
// editor-command wrapper with scroll + pulse.

import type { KeyBinding } from '@codemirror/view';
import { EditorView, type Command } from '@codemirror/view';
import { footnoteJumpTarget } from '../../../lib/markdownFootnotes';
import { pulseAt } from '../../../lib/editorPulse';

const jumpFootnote: Command = (view) => {
  const { state } = view;
  const target = footnoteJumpTarget(state.doc.toString(), state.selection.main.head);
  if (target === null) return false;
  view.dispatch({
    selection: { anchor: target, head: target },
    effects: EditorView.scrollIntoView(target, { y: 'center' }),
    userEvent: 'move.footnote',
  });
  pulseAt(view, target);
  return true;
};

export const footnoteKeymap: readonly KeyBinding[] = [
  { key: 'Mod-Alt-6', run: jumpFootnote, preventDefault: true },
];
