// The Gist Editor's right pane: the app's CodeMirror editor, bound to the same
// document buffer as the main editor and wired to the shared `selectedId` channel
// for bidirectional anchoring — a gist-span click scrolls here (+ a one-line pulse),
// and moving the cursor here lights the matching gist span. Mirrors EditorPanel's
// CodeMirror config + section channel without dragging in the full editor chrome.

import { useCallback, useEffect, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef, type ViewUpdate } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { writingSurfaceExtensions } from '../editor/extensions';
import { useProvenanceSync } from '../editor/useProvenanceSync';
import { pulseEffect } from '../../lib/editorPulse';
import { useStore } from '../../state';
import type { Section } from '../../types';

// The shared writing stack (markdown + HLD theme + live preview + provenance
// tint + the landing-pulse field, promoted to lib/editorPulse). Module-level so
// the extension instances stay stable across renders.
const gistEditorExtensions = writingSurfaceExtensions();

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

  // Durable AI-provenance tint — the same buffer as the main editor, so the
  // marks resolve identically here. The returned seed runs at view creation
  // (the change-driven effect can fire before the view exists).
  const seedProvenance = useProvenanceSync(cmRef);

  // Cursor → selectedId. Flag the change as editor-originated so the scroll effect
  // below doesn't yank the viewport while the writer is typing. STABLE identity
  // (live state via getState): the uiw wrapper reconfigures the whole editor
  // when onUpdate changes identity, which an inline handler would trigger on
  // every keystroke's re-render.
  const onUpdate = useCallback((vu: ViewUpdate) => {
    if (!vu.selectionSet) return;
    const st = useStore.getState();
    const pos = vu.state.selection.main.head;
    const match = sectionAtOffset(st.sections, pos);
    if (match && match.id !== st.selectedId) {
      skipNextScroll.current = true;
      st.setSelectedId(match.id);
    }
  }, []);

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
      onCreateEditor={seedProvenance}
      theme="none"
      height="100%"
      className="h-full"
      basicSetup={false}
      extensions={gistEditorExtensions}
    />
  );
}
