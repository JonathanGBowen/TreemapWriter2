import { useMemo } from 'react';
import type { Section } from '../../types';
import { useStore } from '../../state';

export const findSectionById = (nodes: Section[], id: string): Section | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findSectionById(node.children, id);
    if (found) return found;
  }
  return null;
};

/** The section the panel operates on, derived from the editor selection. */
export const useCurrentSection = (): Section | null => {
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  return useMemo(
    () => (selectedId ? findSectionById(sections, selectedId) : null),
    [selectedId, sections],
  );
};
