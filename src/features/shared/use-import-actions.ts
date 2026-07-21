import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { repository } from '../../services/repository-registry';
import type { ProjectMeta, TestSuite } from '../../types';

export function useImportActions(
  requestConfirm: (message: string, action: () => void) => void,
) {
  const projectName = useStore((s) => s.projectName);
  const sections = useStore((s) => s.sections);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setMarkdown = useStore((s) => s.setMarkdown);
  const setLocalContent = useStore((s) => s.setLocalContent);
  const setProjectName = useStore((s) => s.setProjectName);
  const setTestSuite = useStore((s) => s.setTestSuite);
  const setHiddenSectionIds = useStore((s) => s.setHiddenSectionIds);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const loadProject = useStore((s) => s.loadProject);

  const importMarkdown = useCallback(async (content: string) => {
    requestConfirm(
      'Importing Markdown will overwrite the current content of this project. Continue?',
      async () => {
        const importParser = await import('../../lib/markdownImport');
        const { markdown, projectName: importedName, rawBlocks, titleToIdMap } =
          importParser.parseMarkdownImport(content);

        const targetName = importedName || projectName;
        setProjectName(targetName);

        const parsedUtils = await import('../../lib/utils');
        const newSections = parsedUtils.parseMarkdown(markdown, sections, titleToIdMap);

        const newTestSuite: TestSuite = {};
        const mapSectionToBlock = (s: import('../../types').Section[]) => {
          for (const sec of s) {
            if (rawBlocks[sec.id]) {
              newTestSuite[sec.id] = rawBlocks[sec.id];
            }
            mapSectionToBlock(sec.children);
          }
        };
        mapSectionToBlock(newSections);

        setMarkdown(markdown);
        setLocalContent(markdown);
        setTestSuite(newTestSuite);
        setHiddenSectionIds([]);
        useStore.getState().setActiveLineIndex(null);
        if (activeProjectId) saveCurrentState();
        toast.success(`Imported "${targetName}".`);
      },
    );
  }, [
    projectName, sections, activeProjectId, requestConfirm,
    setMarkdown, setLocalContent, setProjectName, setTestSuite,
    setHiddenSectionIds, saveCurrentState,
  ]);

  const loadFile = useCallback(async (jsonString: string) => {
    requestConfirm('Load this file as a NEW project?', async () => {
      try {
        const data = JSON.parse(jsonString);
        if (typeof data.markdown !== 'string') throw new Error('Invalid project');

        const newId = `proj_${Date.now()}`;
        const newName = data.projectName || 'Imported Project';

        const projectData = { ...data, projectName: newName, lastModified: Date.now() };
        await repository.setProject(newId, projectData);

        const contentForWordCount = projectData.localDraft || projectData.markdown || '';
        const wordCount =
          contentForWordCount.trim() === '' ? 0 : contentForWordCount.trim().split(/\s+/).length;

        const metaEntry: ProjectMeta = {
          id: newId,
          name: newName,
          lastModified: Date.now(),
          wordCount,
        };

        {
          const s = useStore.getState();
          const others = s.projectList.filter((p) => p.id !== newId);
          const updated = [metaEntry, ...others];
          s.setProjectList(updated);
          repository.setMeta(updated).catch(console.error);
        }

        await loadProject(newId);
        toast.success(`Loaded "${newName}".`);
      } catch {
        toast.error('Invalid file.');
      }
    });
  }, [requestConfirm, loadProject]);

  return { importMarkdown, loadFile } as const;
}
