// Keyboard vocabulary for the W₁ Canvas (Arpeggio Phase 4, §6.1). Two pure,
// dependency-free pieces the workspace's `window` keydown leans on: a guard so
// single-key authoring is inert while the writer is typing (in any editor,
// including CodeMirror), and the edge-kind letter map.

import type { StructuralEdgeKind } from '../../types';

/**
 * True when the event target is a live text-entry context, so a bare key like
 * `N`/`E`/`C` must NOT be swallowed as a canvas command. Covers form controls,
 * anything `contentEditable`, and a CodeMirror surface (which is a `div`, not an
 * `<input>`, so the `.cm-editor` ancestor check is what catches it).
 */
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return !!el.closest('.cm-editor');
}

/**
 * The kind letter → edge kind map (the mnemonics Arpeggio §6.1 uses). After `E`
 * arms an edge from the selected node, one of these letters chooses the relation
 * the next click will draw; the default is `grounds` (the load-bearing support).
 */
export const KIND_BY_LETTER: Readonly<Record<string, StructuralEdgeKind>> = {
  g: 'grounds',
  r: 'requires',
  q: 'qualifies',
  o: 'opposes',
  x: 'exemplifies',
  d: 'defines',
  a: 'answers',
};
