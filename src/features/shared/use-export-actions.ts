import { useCallback } from 'react';
import { useStore } from '../../state';
import { triggerDownload } from '../../lib/triggerDownload';
import { buildProjectExport } from '../../lib/projectExport';
import { createMarkdownExport } from '../../lib/markdownExport';
import type { SectionSpec } from '../../types';

function dateSuffix(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function useExportActions() {
  const projectName = useStore((s) => s.projectName);

  const exportProject = useCallback(() => {
    const data = buildProjectExport(useStore.getState());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${slugify(projectName)}-${dateSuffix()}.socratic`);
  }, [projectName]);

  const exportMarkdown = useCallback(() => {
    const s = useStore.getState();
    const md = createMarkdownExport(projectName, s.localContent, s.sections, s.testSuite);
    const blob = new Blob([md], { type: 'text/markdown' });
    triggerDownload(blob, `${slugify(projectName)}-${dateSuffix()}.md`);
  }, [projectName]);

  const exportCleanMarkdown = useCallback(() => {
    const blob = new Blob([useStore.getState().localContent], { type: 'text/markdown' });
    triggerDownload(blob, `${slugify(projectName)}-${dateSuffix()}.md`);
  }, [projectName]);

  const exportSpecs = useCallback(() => {
    const { testSuite } = useStore.getState();
    const specsData: Record<string, SectionSpec> = {};
    for (const [id, entry] of Object.entries(testSuite)) {
      if (entry.spec) specsData[id] = entry.spec;
    }
    const blob = new Blob([JSON.stringify(specsData, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${slugify(projectName)}-specs.json`);
  }, [projectName]);

  return { exportProject, exportMarkdown, exportCleanMarkdown, exportSpecs } as const;
}
