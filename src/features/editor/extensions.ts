// The one CodeMirror extension factory for every prose surface (main editor,
// Gist, Sprint, revision preview). Before this existed, five hand-maintained
// copies of the same stack had already drifted — active-line highlighting and
// the AI-provenance tint each rendered on some surfaces and not others. Keep
// surface-specific behavior OUT of here (focus range, pulse dispatch wiring,
// read-only, Mod-Enter) and pass it through `extra`.
//
// Store-free by design: this module composes lib primitives + @codemirror/*
// only, so any feature may import it (same footing as lib/editorTheme).

import { Compartment, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  drawSelection,
  highlightSpecialChars,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching } from '@codemirror/language';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM, Table } from '@lezer/markdown';
import { foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { hldExtensions } from '../../lib/editorTheme';
import { livePreviewPlugin } from '../../lib/livePreview';
import { provenanceField } from '../../lib/provenanceMarks';
import { pulseField } from '../../lib/editorPulse';
import { formattingKeymap } from './commands/formatting';

/**
 * Language + theme + wrapping only — enough to *display* HLD-styled markdown.
 * The read-only revision preview builds on this tier.
 */
export const baseMarkdownExtensions = (): Extension[] => [
  markdown({
    base: markdownLanguage,
    codeLanguages: languages,
    // Keymaps are registered once, explicitly, in writingSurfaceExtensions —
    // never implicitly by the language.
    addKeymap: false,
    extensions: [Table, GFM],
  }),
  ...hldExtensions,
  EditorView.lineWrapping,
];

/**
 * Undo history lives in a compartment so a surface can RESET it at a hard
 * boundary — project load/switch arrives as a controlled-value reconcile that
 * would otherwise enter history, letting Cmd+Z rewind past the load into an
 * empty buffer. Mid-session external writes (accepted AI edits) stay undoable.
 */
export const historyCompartment = new Compartment();

/** Wipe a view's undo history (dispatch after a project load/switch). */
export const resetEditorHistory = (view: EditorView): void => {
  view.dispatch({ effects: historyCompartment.reconfigure([]) });
  view.dispatch({ effects: historyCompartment.reconfigure(history()) });
};

/**
 * The full writable prose surface: base + editing affordances + the layers
 * every writing surface owes the writer — live preview widgets, the durable
 * AI-provenance tint, the landing pulse, an active-line anchor, and native
 * spellcheck over the prose.
 */
export const writingSurfaceExtensions = (extra: Extension[] = []): Extension[] => [
  ...baseMarkdownExtensions(),
  highlightSpecialChars(),
  historyCompartment.of(history()),
  drawSelection(),
  dropCursor(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  EditorView.contentAttributes.of({
    spellcheck: 'true',
    autocorrect: 'off',
    autocapitalize: 'off',
  }),
  keymap.of([
    ...closeBracketsKeymap,
    ...formattingKeymap, // Mod-b / Mod-i toggle
    ...markdownKeymap, // Enter continues lists / quotes; Backspace outdents
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    indentWithTab,
  ]),
  livePreviewPlugin,
  provenanceField,
  pulseField,
  ...extra,
];
