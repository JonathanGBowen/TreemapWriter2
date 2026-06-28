import { useMemo } from 'react';
import type { Section } from '../../types';
import { useStore } from '../../state';
import { buildRootSection, findSectionById } from '../../lib/utils';

// Re-exported for back-compat: the canonical definition now lives in lib/utils
// (the home of the other section-tree helpers). Existing importers of
// `findSectionById` from this module keep working.
export { findSectionById };

/**
 * The section the panel operates on, derived from the editor selection.
 *
 * The special id 'root' resolves to the synthetic whole-document node (whose
 * `fullContent` is the entire markdown), so the Spec/Analysis/Diagnostic panels
 * operate on the document as a whole without any per-panel changes.
 */
export const useCurrentSection = (): Section | null => {
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const markdown = useStore((s) => s.markdown);
  const projectName = useStore((s) => s.projectName);
  return useMemo(() => {
    if (!selectedId) return null;
    if (selectedId === 'root') {
      return buildRootSection(markdown, sections, projectName?.trim() || 'Whole Document');
    }
    return findSectionById(sections, selectedId);
  }, [selectedId, sections, markdown, projectName]);
};
