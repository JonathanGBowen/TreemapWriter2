import { useEffect } from 'react';
import { useStore } from '../../state';
import { parseMarkdown, flattenSectionsForIndex } from '../../lib/utils';
import { repository } from '../../services/repository-registry';
import { isTauri } from '../../services/tauri-environment';
import type { Section } from '../../types';

const findSection = (nodes: Section[], id: string): Section | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findSection(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findSectionByLine = (nodes: Section[], line: number): Section | null => {
  for (const node of nodes) {
    if (line >= node.startLine && line <= node.endLine) {
      return findSectionByLine(node.children, line) || node;
    }
  }
  return null;
};

export function useSectionSync() {
  const localContent = useStore((s) => s.localContent);
  const sections = useStore((s) => s.sections);
  const hasOpenProject = useStore((s) => s.hasOpenProject);
  const setSections = useStore((s) => s.setSections);
  const setSelectedId = useStore((s) => s.setSelectedId);

  useEffect(() => {
    const handler = setTimeout(() => {
      const tree = parseMarkdown(localContent, sections);

      setSelectedId((prev) => {
        if (prev) {
          const exists = findSection(tree, prev);
          if (!exists && prev !== 'root') {
            const caretLine = useStore.getState().activeLineIndex;
            const candidate = caretLine !== null ? findSectionByLine(tree, caretLine) : null;
            return candidate ? candidate.id : tree[0]?.id ?? null;
          }
          return prev;
        } else if (tree.length > 0) {
          return tree[0].id;
        }
        return null;
      });

      setSections(tree);
    }, 300);
    return () => clearTimeout(handler);
  }, [localContent]);

  useEffect(() => {
    if (!isTauri() || !hasOpenProject) return;
    const handler = setTimeout(() => {
      void repository.indexSections(flattenSectionsForIndex(sections));
    }, 600);
    return () => clearTimeout(handler);
  }, [sections, hasOpenProject]);

  useEffect(() => {
    if (sections.length === 0) return;
    const liveIds: string[] = [];
    const traverse = (nodes: Section[]) => {
      nodes.forEach((node) => {
        liveIds.push(node.id);
        traverse(node.children);
      });
    };
    traverse(sections);
    useStore.getState().pruneOrphanEntries(liveIds);
  }, [sections]);
}
