import React, { useState } from "react";
import { Treemap } from "../treemap/Treemap";
import { useStore } from "../../store";
import { Pip } from "../shared/Pip";
import { ProjectMenu } from "./ProjectMenu";
import { SectionRow } from "./SectionRow";
import { buildRootSection } from "../../lib/utils";
import { Dock } from "./Dock";
import { summarizeSync } from "./sync-status";

/** Map + sections zone — hairline-delimited, absorbing the space freed below. */
function MapZone({ onSelect }: { onSelect: (id: string) => void }) {
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const hiddenSectionIds = useStore((s) => s.hiddenSectionIds);
  const testSuite = useStore((s) => s.testSuite);
  const markdown = useStore((s) => s.markdown);
  // Synthetic top row: selecting it operates on the whole document (id 'root').
  const documentRow = sections.length > 0 ? buildRootSection(markdown, sections, 'Whole Document') : null;
  return (
    <div className="treemap-step flex-1 overflow-hidden p-2.5 flex flex-col gap-2 min-h-0">
      <div className="h-px bg-hld-border" />
      <div className="flex-1 w-full border border-hld-border bg-[#080d13] relative overflow-hidden min-h-0">
        <Treemap sections={sections} selectedId={selectedId || ''} onSelect={onSelect} hiddenSectionIds={hiddenSectionIds} testSuite={testSuite} />
      </div>
      <div className="h-px bg-hld-border" />
      <div className="max-h-[160px] overflow-y-auto section-tree">
        {documentRow && (
          <SectionRow
            key="root"
            section={documentRow}
            selected={selectedId === 'root'}
            status={testSuite['root']?.status || 'idle'}
            onSelect={onSelect}
          />
        )}
        {sections.map((sec) => (
          <SectionRow key={sec.id} section={sec} selected={selectedId === sec.id} status={testSuite[sec.id]?.status || 'idle'} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

interface SidebarProps {
  onSelect: (id: string) => void;
  onContinue: () => void;
  onImportMarkdown: (content: string) => void;
  onLoadProject: (content: string) => void;
  onSaveProject: () => void;
  onExportMarkdown: () => void;
  onExportSpecs: () => void;
  onResetProject: () => void;
  onLoadDefaultProject: () => void;
  onStartTutorial: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelect, onContinue, onImportMarkdown, onLoadProject, onSaveProject,
  onExportMarkdown, onExportSpecs, onResetProject, onLoadDefaultProject, onStartTutorial,
}) => {
  const projectName = useStore((s) => s.projectName);
  const setProjectName = useStore((s) => s.setProjectName);
  const width = useStore((s) => s.sidebarWidth);
  const setWidth = useStore((s) => s.setSidebarWidth);
  const setShowConflictModal = useStore((s) => s.setShowConflictModal);
  const sync = summarizeSync(
    useStore((s) => s.syncStatus),
    useStore((s) => s.syncError),
    useStore((s) => s.syncAhead),
    useStore((s) => s.syncBehind),
  );
  const isConflict = useStore((s) => s.syncStatus) === 'conflict';

  const [caption, setCaption] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: MouseEvent) => setWidth(Math.max(200, Math.min(startWidth + (ev.clientX - startX), 800)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = 'default';
      window.dispatchEvent(new Event('resize'));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
  };

  const pipCaption = `Sync · ${sync.text}`;

  return (
    <div style={{ width }} className="h-full flex-none relative border-r border-hld-border bg-hld-surface flex flex-col shadow-sm z-10 hld-scanline">
      {/* Header — ◇ menu · name · composite status pip */}
      <div className="px-[10px] py-[9px] border-b border-hld-border bg-hld-surface2 relative flex items-center gap-[9px]">
        <div className="absolute top-0 left-0 right-0 h-px bg-hld-cyan shadow-[0_0_12px_var(--color-hld-cyan)]" />
        <ProjectMenu
          onResetProject={onResetProject}
          onLoadDefaultProject={onLoadDefaultProject}
          onStartTutorial={onStartTutorial}
          onImportMarkdown={onImportMarkdown}
          onImportProject={onLoadProject}
          onExportMarkdown={onExportMarkdown}
          onExportProject={onSaveProject}
          onExportSpecs={onExportSpecs}
        />
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="flex-1 min-w-0 font-bold text-[10px] uppercase font-mono tracking-[0.12em] text-hld-text bg-transparent outline-none border-b border-transparent hover:border-hld-border focus:border-hld-cyan truncate transition-colors"
          placeholder="Project Name"
          title="Click to rename"
        />
        {isConflict ? (
          <button type="button" onClick={() => setShowConflictModal(true)} title={sync.text} aria-label={`Sync: ${sync.text}`}
            onMouseEnter={() => setCaption(pipCaption)} onMouseLeave={() => setCaption(null)}>
            <Pip status={sync.pip} pulse={sync.pulse} />
          </button>
        ) : (
          <span onMouseEnter={() => setCaption(pipCaption)} onMouseLeave={() => setCaption(null)}>
            <Pip status={sync.pip} pulse={sync.pulse} title={sync.text} />
          </span>
        )}
      </div>

      <MapZone onSelect={onSelect} />

      <Dock onContinue={onContinue} caption={caption} setCaption={setCaption} />

      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-hld-cyan/50 hover:w-2 transition-all duration-150 z-50 translate-x-1/2"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};
