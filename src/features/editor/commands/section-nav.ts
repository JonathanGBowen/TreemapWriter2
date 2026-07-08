// Keyboard section navigation: Mod-Alt-↑/↓ jump to the previous/next markdown
// heading, landing with the shared pulse. In focus mode a jump past the window
// boundary re-scopes focus via the ordinary caret→selection channel, so this
// doubles as "next/previous section" there.

import type { KeyBinding } from '@codemirror/view';
import { EditorView, type Command } from '@codemirror/view';
import { pulseAt } from '../../../lib/editorPulse';

const HEADING = /^#{1,6}\s/;

const jumpHeading =
  (dir: -1 | 1): Command =>
  (view) => {
    const { state } = view;
    const cur = state.doc.lineAt(state.selection.main.head).number;
    let target = -1;
    if (dir < 0) {
      for (let n = cur - 1; n >= 1; n--) {
        if (HEADING.test(state.doc.line(n).text)) {
          target = n;
          break;
        }
      }
    } else {
      for (let n = cur + 1; n <= state.doc.lines; n++) {
        if (HEADING.test(state.doc.line(n).text)) {
          target = n;
          break;
        }
      }
    }
    if (target < 0) return false;
    const pos = state.doc.line(target).from;
    view.dispatch({
      selection: { anchor: pos, head: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      userEvent: 'move.section',
    });
    pulseAt(view, pos);
    return true;
  };

export const sectionNavKeymap: readonly KeyBinding[] = [
  { key: 'Mod-Alt-ArrowUp', run: jumpHeading(-1), preventDefault: true },
  { key: 'Mod-Alt-ArrowDown', run: jumpHeading(1), preventDefault: true },
];
