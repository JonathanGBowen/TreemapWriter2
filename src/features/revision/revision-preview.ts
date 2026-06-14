// Inline-preview decorations for the Revision Workspace master document.
// Modeled on lib/livePreview.ts: a StateField<DecorationSet> driven by a
// StateEffect. Preview is purely visual — a `Decoration.replace` widget renders
// `proposed_text` over the matched `original_text` range WITHOUT mutating the
// document (the underlying text stays the original until Accept writes through).

import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { StateEffect, StateField, type Range } from '@codemirror/state';

/** One proposal projected to what the decoration layer needs. */
export interface PreviewProposal {
  id: string;
  original_text: string;
  proposed_text: string;
  status: 'pending' | 'accepted' | 'rejected';
  /** pending && (previewAll || previewIds.includes(id)) */
  previewing: boolean;
  active: boolean;
}

export interface PreviewPayload {
  proposals: PreviewProposal[];
  /** Toggle a pending proposal's inline preview (also focuses it). */
  onToggle: (id: string) => void;
}

interface PreviewState {
  deco: DecorationSet;
  payload: PreviewPayload | null;
}

export const setPreviewEffect = StateEffect.define<PreviewPayload>();

class PreviewWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: PreviewWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-prose-preview';
    span.textContent = this.text;
    span.title = 'Proposed — click to revert to the original';
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

const buildPreviewDecorations = (doc: string, payload: PreviewPayload | null): DecorationSet => {
  if (!payload) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  for (const p of payload.proposals) {
    if (p.status === 'accepted') {
      // The doc already contains proposed_text; mark it applied (green).
      const at = doc.indexOf(p.proposed_text);
      if (at >= 0) {
        ranges.push(
          Decoration.mark({ class: 'cm-prose-applied' }).range(at, at + p.proposed_text.length),
        );
      }
      continue;
    }
    if (p.status !== 'pending') continue;
    const at = doc.indexOf(p.original_text);
    if (at < 0) continue;
    const from = at;
    const to = at + p.original_text.length;
    if (p.previewing) {
      ranges.push(Decoration.replace({ widget: new PreviewWidget(p.proposed_text) }).range(from, to));
    } else {
      ranges.push(
        Decoration.mark({
          class: p.active ? 'cm-prose-active' : 'cm-prose-mark',
          attributes: { title: 'Click to preview the proposed edit' },
        }).range(from, to),
      );
    }
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(ranges, true);
};

export const revisionPreviewField = StateField.define<PreviewState>({
  create: () => ({ deco: Decoration.none, payload: null }),
  update(value, tr) {
    let payload = value.payload;
    for (const e of tr.effects) {
      if (e.is(setPreviewEffect)) payload = e.value;
    }
    if (payload === value.payload && !tr.docChanged) {
      return { payload, deco: value.deco.map(tr.changes) };
    }
    return { payload, deco: buildPreviewDecorations(tr.state.doc.toString(), payload) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

/**
 * Click-to-toggle handled at the view level so a plain mark decoration — which
 * can't carry its own handler — still responds. `original_text` is still present
 * in the doc even while previewing (replace only hides it visually), so the same
 * lookup matches both the marked and the previewed state.
 */
export const revisionPreviewClicks = EditorView.domEventHandlers({
  mousedown(event, view) {
    const state = view.state.field(revisionPreviewField, false);
    if (!state?.payload) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos == null) return false;
    const doc = view.state.doc.toString();
    for (const p of state.payload.proposals) {
      if (p.status !== 'pending') continue;
      const at = doc.indexOf(p.original_text);
      if (at < 0) continue;
      if (pos >= at && pos <= at + p.original_text.length) {
        state.payload.onToggle(p.id);
        event.preventDefault();
        return true;
      }
    }
    return false;
  },
});

export const revisionPreviewExtensions = [revisionPreviewField, revisionPreviewClicks];
