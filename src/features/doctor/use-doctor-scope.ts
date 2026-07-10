// Scope resolution for the Reverse Outline Doctor: whole draft or one section,
// resolved against the LIVE buffer (localContent falls back to markdown) so a
// reading never runs on a stale committed copy. Mirrors use-parallel-scope /
// use-climate-actions' target resolution.

import type { AppState } from '../../state';
import type { Section } from '../../types';
import { segmentParagraphs, type ParagraphBlock } from '../../lib/paragraph-helpers';

export interface DoctorScope {
  /** 'root' for the whole draft, else the section id — the checklist's scopeKey. */
  scopeKey: string;
  /** "Whole draft" or the section title — model framing. */
  title: string;
  /** The scope's live prose, sent whole (guardContextFit pre-flights it). */
  text: string;
  blocks: ParagraphBlock[];
}

/** Depth-first lookup of a section by id (the tree is small; no memo needed). */
export const findById = (nodes: Section[], id: string): Section | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findById(n.children, id);
    if (found) return found;
  }
  return null;
};

/**
 * Resolve the Doctor's current scope from live state, or null when the target
 * section no longer exists / the scope is empty (caller toasts). Reads state at
 * call time (`useStore.getState()` at the call site) so callbacks stay
 * identity-stable.
 */
export const doctorScopeFromState = (s: AppState): DoctorScope | null => {
  const live = s.localContent || s.markdown;
  if (s.doctorTargetId) {
    const section = findById(s.sections, s.doctorTargetId);
    if (!section) return null;
    const text = section.fullContent;
    if (!text.trim()) return null;
    return {
      scopeKey: section.id,
      title: section.title,
      text,
      blocks: segmentParagraphs(text),
    };
  }
  if (!live.trim()) return null;
  return { scopeKey: 'root', title: 'Whole draft', text: live, blocks: segmentParagraphs(live) };
};
