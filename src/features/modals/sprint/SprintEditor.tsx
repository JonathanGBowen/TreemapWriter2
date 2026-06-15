// Living Sprints — the writing surface inside the runner. The same CodeMirror
// stack the original sprint modal used (markdown + HLD theme + live preview),
// wrapped so the writer drafts *inside* the current move. Cmd/Ctrl+Enter advances
// (routed to the engine). The buffer persists across moves within a section, so
// prose accumulates while the instructions above it change.

import { useEffect, useRef } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM, Table } from '@lezer/markdown';
import { hldExtensions, hldTheme } from '../../../lib/editorTheme';
import { livePreviewPlugin } from '../../../lib/livePreview';
import {
  EditorView,
  keymap,
  drawSelection,
  highlightSpecialChars,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';

const baseSetup = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorView.lineWrapping,
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    indentWithTab,
  ]),
];

interface SprintEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Cmd/Ctrl+Enter — advance to the next move. */
  onSubmit: () => void;
}

export function SprintEditor({ value, onChange, onSubmit }: SprintEditorProps) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    const t = setTimeout(() => cmRef.current?.view?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex-1 min-h-0 border border-hld-border bg-hld-bgDeep focus-within:border-hld-cyan/30 transition-colors overflow-hidden">
      <CodeMirror
        ref={cmRef}
        value={value}
        onChange={onChange}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false, extensions: [Table, GFM] }),
          ...hldExtensions,
          ...baseSetup,
          livePreviewPlugin,
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                submitRef.current();
                return true;
              },
            },
          ]),
        ]}
        theme={hldTheme}
        height="100%"
        className="h-full w-full [&>div]:h-full font-mono text-base"
        basicSetup={false}
      />
    </div>
  );
}
