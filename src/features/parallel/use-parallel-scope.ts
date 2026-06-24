import { useMemo } from 'react';
import { useStore } from '../../state';
import type { AppState } from '../../state';
import { findSectionById } from '../tests-panel/use-current-section';

/** The prose the Parallel Editor currently operates on. */
export interface ParallelScope {
  /** Persistence/identity key: a section id, or 'root' for the whole document. */
  scopeKey: string;
  title: string;
  /** The source prose (a section's fullContent, or the whole markdown). */
  text: string;
}

/**
 * Derive the working scope from the whole-doc toggle + the shared `selectedId`.
 * Whole-doc (or the synthetic 'root' selection) → the entire markdown; otherwise
 * the selected section. Returns null when section mode has no section selected.
 * Pure so the action callbacks can recompute it live from getState() (no stale closure).
 */
export const scopeFromState = (s: AppState): ParallelScope | null => {
  if (s.parallelWholeDoc || s.selectedId === 'root') {
    return { scopeKey: 'root', title: s.projectName?.trim() || 'Whole Document', text: s.markdown };
  }
  if (!s.selectedId) return null;
  const sec = findSectionById(s.sections, s.selectedId);
  return sec ? { scopeKey: sec.id, title: sec.title, text: sec.fullContent } : null;
};

/** Reactive scope for rendering. */
export const useParallelScope = (): ParallelScope | null => {
  const wholeDoc = useStore((s) => s.parallelWholeDoc);
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const markdown = useStore((s) => s.markdown);
  const projectName = useStore((s) => s.projectName);
  return useMemo(
    () => scopeFromState(useStore.getState()),
    // Recompute when any scope input changes (values listed so the memo is honest).
    [wholeDoc, sections, selectedId, markdown, projectName],
  );
};
