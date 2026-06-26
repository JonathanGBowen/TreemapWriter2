import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Treemap } from "../treemap/Treemap";
import { StrainRegister } from "../strain/StrainRegister";
import { useStore } from "../../store";
import { isTauri } from "../../services/tauri-environment";
import { Pip } from "../shared/Pip";
import { ProjectMenu } from "./ProjectMenu";
import { SectionRow } from "./SectionRow";
import { buildRootSection } from "../../lib/utils";
import { Dock } from "./Dock";
import { summarizeSync } from "./sync-status";
import { retrySync } from "../../services/sync-policy";
import { useColumnResize } from "../shared/useColumnResize";
import { ResizeHandle } from "../shared/ResizeHandle";

/**
 * Full-text search box (desktop only — FTS5 lives in the Rust cache). Updates
 * the treemap highlight via `runSectionSearch`; debounced so typing doesn't
 * spam IPC. The match count doubles as a clear button.
 */
function SearchBox() {
  // Query text lives in the store (not local state) so a project switch —
  // which calls clearSearch() — actually empties the box; a local mirror would
  // keep showing the previous project's query with zero matches.
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const runSectionSearch = useStore((s) => s.runSectionSearch);
  const clearSearch = useStore((s) => s.clearSearch);
  const matchCount = useStore((s) => s.searchMatchedIds.length);
  const timer = useRef<number | null>(null);

  const schedule = (next: string) => {
    setSearchQuery(next); // reflect typing immediately; debounce the search
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void runSectionSearch(next), 160);
  };

  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current);
    clearSearch();
  };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <div className="relative flex items-center">
      <Search size={12} className="absolute left-2 text-hld-muted-text pointer-events-none" />
      <input
        value={searchQuery}
        onChange={(e) => schedule(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") reset(); }}
        placeholder="Search sections…"
        aria-label="Search sections"
        className="w-full pl-7 pr-12 py-1 bg-[#080d13] border border-hld-border text-[10px] font-mono text-hld-text placeholder:text-hld-muted-text outline-none focus:border-hld-cyan transition-colors"
      />
      {searchQuery.trim() !== "" && (
        <button
          type="button"
          onClick={reset}
          title="Clear search"
          className="absolute right-1.5 text-[9px] font-mono text-hld-muted-text hover:text-hld-text uppercase tracking-wider"
        >
          {matchCount}×
        </button>
      )}
    </div>
  );
}

/** Map + sections zone — hairline-delimited, absorbing the space freed below. */
function MapZone({ onSelect }: { onSelect: (id: string) => void }) {
  const sections = useStore((s) => s.sections);
  const selectedId = useStore((s) => s.selectedId);
  const hiddenSectionIds = useStore((s) => s.hiddenSectionIds);
  const testSuite = useStore((s) => s.testSuite);
  const markdown = useStore((s) => s.markdown);
  const searchMatchedIds = useStore((s) => s.searchMatchedIds);
  const matchedIds = useMemo(() => new Set(searchMatchedIds), [searchMatchedIds]);
  // Synthetic top row: selecting it operates on the whole document (id 'root').
  const documentRow = sections.length > 0 ? buildRootSection(markdown, sections, 'Whole Document') : null;
  return (
    <div className="treemap-step flex-1 overflow-hidden p-2.5 flex flex-col gap-2 min-h-0">
      <div className="h-px bg-hld-border" />
      <div className="flex-1 w-full border border-hld-border bg-[#080d13] relative overflow-hidden min-h-0">
        <Treemap sections={sections} selectedId={selectedId || ''} onSelect={onSelect} hiddenSectionIds={hiddenSectionIds} testSuite={testSuite} matchedIds={matchedIds} />
      </div>
      {isTauri() && <SearchBox />}
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
      <StrainRegister onSelect={onSelect} />
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
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const width = useStore((s) => s.sidebarWidth);
  const setWidth = useStore((s) => s.setSidebarWidth);
  const setShowConflictModal = useStore((s) => s.setShowConflictModal);
  const setShowSyncConfigModal = useStore((s) => s.setShowSyncConfigModal);
  const syncStatus = useStore((s) => s.syncStatus);
  const syncError = useStore((s) => s.syncError);
  const sync = summarizeSync(
    syncStatus,
    syncError,
    useStore((s) => s.syncAhead),
    useStore((s) => s.syncBehind),
  );
  const isConflict = syncStatus === 'conflict';
  const isError = syncStatus === 'error';
  // The "no PAT configured" failure is the one error a retry can't fix — it
  // needs the user to (re)enter a token, so route that click into setup instead.
  const needsPat = isError && /\bpat\b/i.test(sync.text);

  const [caption, setCaption] = useState<string | null>(null);

  const handleMouseDown = useColumnResize({ width, setWidth, edge: 'right', min: 200, max: 800 });

  const pipCaption = isError
    ? `Sync · ${sync.text} · ${needsPat ? 'click to configure' : 'click to retry'}`
    : `Sync · ${sync.text}`;

  const handleErrorPipClick = () => {
    if (needsPat) {
      setShowSyncConfigModal(true);
      return;
    }
    toast('Retrying sync…');
    void retrySync();
  };

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
          onBlur={() => {
            // Persist the rename on blur rather than waiting up to 60s for the
            // next autosave, so it survives an immediate project switch/close.
            if (!projectName.trim()) setProjectName('Untitled Project');
            if (activeProjectId) void saveCurrentState();
          }}
          className="flex-1 min-w-0 font-bold text-[10px] uppercase font-mono tracking-[0.12em] text-hld-text bg-transparent outline-none border-b border-transparent hover:border-hld-border focus:border-hld-cyan truncate transition-colors"
          placeholder="Project Name"
          title="Click to rename"
        />
        {isConflict ? (
          <button type="button" onClick={() => setShowConflictModal(true)} title={sync.text} aria-label={`Sync: ${sync.text}`}
            onMouseEnter={() => setCaption(pipCaption)} onMouseLeave={() => setCaption(null)}>
            <Pip status={sync.pip} pulse={sync.pulse} />
          </button>
        ) : isError ? (
          <button type="button" onClick={handleErrorPipClick} title={pipCaption} aria-label={`Sync error: ${sync.text}`}
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

      <ResizeHandle side="right" onMouseDown={handleMouseDown} />
    </div>
  );
};
