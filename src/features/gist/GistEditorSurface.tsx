// The Gist Editor's right pane: the app's CodeMirror editor, bound to the same
// document buffer as the main editor and wired to the shared `selectedId` channel
// for bidirectional anchoring — a gist-span click scrolls here (+ a one-line pulse),
// and moving the cursor here lights the matching gist span. Mirrors EditorPanel's
// CodeMirror config + section channel without dragging in the full editor chrome.

import { useEffect, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef, type ViewUpdate } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM, Table } from '@lezer/markdown';
import {
  EditorView, Decoration, type DecorationSet, keymap, drawSelection, highlightSpecialChars,
  dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine,
} from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { hldExtensions, hldTheme } from '../../lib/editorTheme';
import { livePreviewPlugin } from '../../lib/livePreview';
import { useStore } from '../../state';
import type { Section } from '../../types';

// A one-shot "you arrived here" line pulse on navigation (the moment-of-consequence
// the prototype draws as a paragraph fade; in a source editor it's the landing line).
const pulseEffect = StateEffect.define<number | null>();
const pulseField = StateField.define<DecorationSet>({
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

const setup = [
  highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorView.lineWrapping,
  indentOnInput(), bracketMatching(), closeBrackets(), autocompletion(), rectangularSelection(),
  crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap,
    ...foldKeymap, ...completionKeymap, indentWithTab,
  ]),
];

/** The deepest section whose start offset is at or before `pos` (cursor → section). */
const sectionAtOffset = (nodes: Section[], pos: number): Section | null => {
  let match: Section | null = null;
  const walk = (list: Section[]) => {
    for (const n of list) {
      if (pos >= n.startOffset) {
        match = n;
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return match;
};

const sectionById = (nodes: Section[], id: string): Section | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = sectionById(n.children, id);
    if (child) return child;
  }
  return null;
};

export function GistEditorSurface() {
  const localContent = useStore((s) => s.localContent);
  const setLocalContent = useStore((s) => s.setLocalContent);
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);

  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const skipNextScroll = useRef(false);
  const prevSelected = useRef<string | null>(selectedId);

  // Cursor → selectedId. Flag the change as editor-originated so the scroll effect
  // below doesn't yank the viewport while the writer is typing.
  const onUpdate = (vu: ViewUpdate) => {
    if (!vu.selectionSet) return;
    const pos = vu.state.selection.main.head;
    const match = sectionAtOffset(sections, pos);
    if (match && match.id !== useStore.getState().selectedId) {
      skipNextScroll.current = true;
      setSelectedId(match.id);
    }
  };

  // selectedId → scroll here + pulse the landing line (gist-span click / external select).
  useEffect(() => {
    if (selectedId === prevSelected.current) return;
    prevSelected.current = selectedId;
    if (skipNextScroll.current) {
      skipNextScroll.current = false;
      return;
    }
    const view = cmRef.current?.view;
    if (!view || !selectedId) return;
    const sec = sectionById(sections, selectedId);
    if (!sec) return;
    const pos = Math.max(0, Math.min(sec.startOffset, view.state.doc.length));
    try {
      view.dispatch({
        selection: { anchor: pos, head: pos },
        effects: [EditorView.scrollIntoView(pos, { y: 'start', yMargin: 80 }), pulseEffect.of(pos)],
      });
      view.focus();
      window.setTimeout(() => {
        const v = cmRef.current?.view;
        if (v) v.dispatch({ effects: pulseEffect.of(null) });
      }, 650);
    } catch {
      /* scrollIntoView can throw on an out-of-range pos mid-edit; ignore */
    }
  }, [selectedId, sections]);

  return (
    <CodeMirror
      ref={cmRef}
      value={localContent}
      onChange={setLocalContent}
      onUpdate={onUpdate}
      theme={hldTheme}
      height="100%"
      className="h-full"
      basicSetup={false}
      extensions={[
        markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false, extensions: [Table, GFM] }),
        ...hldExtensions,
        ...setup,
        pulseField,
        livePreviewPlugin,
      ]}
    />
  );
}
