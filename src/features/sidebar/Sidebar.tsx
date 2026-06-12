import React from "react";
import { BrainCircuit, Plus, FolderOpen, Sparkles, Network, CircleAlert, HelpCircle, ChevronsRight, Map, FileJson, GitBranch } from "lucide-react";
import { Treemap } from "../treemap/Treemap";
import { FileMenu } from "./FileMenu";
import { Section } from "../../types";
import { useStore } from "../../store";

interface SidebarProps {
  onSelect: (id: string) => void;
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
  onSelect,
  onImportMarkdown,
  onLoadProject,
  onSaveProject,
  onExportMarkdown,
  onExportSpecs,
  onResetProject,
  onLoadDefaultProject,
  onStartTutorial,
}) => {
  // Domain + UI state from store
  const syncStatus = useStore(s => s.syncStatus);
  const syncError = useStore(s => s.syncError);
  const syncAhead = useStore(s => s.syncAhead);
  const syncBehind = useStore(s => s.syncBehind);
  // Unpushed/unpulled commits → amber, so "synced" only ever means synced.
  const syncPending = syncStatus === 'idle' && (syncAhead > 0 || syncBehind > 0);
  const markdown = useStore(s => s.markdown);
  const sections = useStore(s => s.sections);
  const selectedId = useStore(s => s.selectedId);
  const projectName = useStore(s => s.projectName);
  const setProjectName = useStore(s => s.setProjectName);
  const width = useStore(s => s.sidebarWidth);
  const setWidth = useStore(s => s.setSidebarWidth);
  const hiddenSectionIds = useStore(s => s.hiddenSectionIds);
  const testSuite = useStore(s => s.testSuite);
  const isInterpolating = useStore(s => s.isInterpolating);

  // Modal openers — store is the source of truth, no parent prop drilling
  const setShowProjectModal = useStore(s => s.setShowProjectModal);
  const setShowInterpolationModal = useStore(s => s.setShowInterpolationModal);
  const setShowGoalSprintModal = useStore(s => s.setShowGoalSprintModal);
  const setShowContentSprintModal = useStore(s => s.setShowContentSprintModal);
  const setShowGraphModal = useStore(s => s.setShowGraphModal);
  const setShowPromptsGraphModal = useStore(s => s.setShowPromptsGraphModal);
  const setShowSectionMapModal = useStore(s => s.setShowSectionMapModal);
  const setShowProjectFileModal = useStore(s => s.setShowProjectFileModal);
  const setShowCoachModal = useStore(s => s.setShowCoachModal);

  const onOpenProjectManager = () => setShowProjectModal(true);
  const onInterpolateTasks = () => setShowInterpolationModal(true);
  const onSprintGoals = () => setShowGoalSprintModal(true);
  const onSprintContent = () => setShowContentSprintModal(true);
  const onOpenDependencyGraph = () => setShowGraphModal(true);
  const onOpenPromptsGraph = () => setShowPromptsGraphModal(true);
  const onOpenSectionMap = () => setShowSectionMapModal(true);
  const onOpenProjectFileEditor = () => setShowProjectFileModal(true);
  const onOpenCoach = () => setShowCoachModal(true);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX);
      setWidth(Math.max(200, Math.min(newWidth, 800))); // Min 200px, Max 800px
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      window.dispatchEvent(new Event('resize'));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const renderSectionTreeItem = (sec: Section) => {
    const isSelected = selectedId === sec.id;
    const paddingLeft = sec.level * 16;
    const status = testSuite[sec.id]?.status || 'idle';
    
    let sqColor = 'bg-hld-dim'; // Default idle
    let sqShadow = '';
    
    switch (status) {
      case 'success':
        sqColor = 'bg-hld-green';
        sqShadow = 'shadow-[0_0_5px_var(--tw-colors-hld-green)]';
        break;
      case 'fail':
        sqColor = 'bg-hld-magenta';
        sqShadow = 'shadow-[0_0_5px_var(--tw-colors-hld-magenta)]';
        break;
      case 'stale':
        sqColor = 'bg-hld-yellow';
        sqShadow = 'shadow-[0_0_5px_var(--tw-colors-hld-yellow)]';
        break;
      case 'running':
        sqColor = 'bg-hld-cyan';
        sqShadow = 'animate-pulse';
        break;
    }

    return (
      <div 
        key={sec.id}
        onClick={() => onSelect(sec.id)}
        className={`flex items-center gap-0 p-[4px_12px] cursor-pointer transition-all relative select-none hover:bg-hld-surface2 ${isSelected ? 'bg-[rgba(0,232,245,0.05)]' : ''}`}
      >
        {isSelected && (
           <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-hld-cyan shadow-[0_0_6px_var(--tw-colors-hld-cyan)]" />
        )}
        <div className="shrink-0" style={{ width: `${paddingLeft}px` }}></div>
        <div className={`w-[6px] h-[6px] shrink-0 mr-2 transition-shadow ${sqColor} ${sqShadow}`}></div>
        <div className={`flex-1 text-ui-row whitespace-nowrap overflow-hidden text-ellipsis ${isSelected ? 'text-hld-cyan opacity-100 font-bold' : 'text-hld-text opacity-65'}`}>
          {sec.title}
        </div>
        <div className="text-ui-meta text-hld-muted-text">{sec.wordCount}w</div>
      </div>
    );
  };

  return (
    <div 
      style={{ width }} 
      className="h-full flex-none relative border-r border-hld-border bg-hld-surface flex flex-col shadow-sm z-10 transition-colors duration-200"
    >
      {/* App Header */}
      <div className="p-3 border-b border-hld-border flex items-center justify-between bg-hld-surface2 relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-hld-cyan shadow-[0_0_12px_var(--tw-colors-hld-cyan)]" />
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-[18px] h-[18px] bg-hld-cyan rotate-45 shrink-0 shadow-[0_0_14px_rgba(0,232,245,0.25)] relative mr-1">
             <div className="absolute inset-[3px] bg-hld-surface2" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
             <input 
               value={projectName}
               onChange={(e) => setProjectName(e.target.value)}
               className="font-bold text-[10px] uppercase font-mono tracking-[0.12em] text-hld-text bg-transparent outline-none border-b border-transparent hover:border-hld-border focus:border-hld-cyan truncate transition-colors"
               placeholder="Project Name"
               title="Rename Project"
             />
             <div className="flex items-center gap-1.5 mt-0.5 text-ui-meta text-hld-cyan font-mono uppercase tracking-[0.14em]">
               <span className="w-1 h-1 rounded-full bg-hld-green animate-pulse shadow-[0_0_6px_var(--tw-colors-hld-green)]"></span>
               autosaved
               {syncStatus !== 'no-remote' && (
                 <span
                   className={`ml-2 w-1.5 h-1.5 rounded-full ${
                     syncStatus === 'error'
                       ? 'bg-hld-magenta shadow-[0_0_6px_var(--tw-colors-hld-magenta)]'
                       : syncPending
                         ? 'bg-hld-yellow shadow-[0_0_6px_var(--tw-colors-hld-yellow)]'
                         : 'bg-hld-cyan shadow-[0_0_6px_var(--tw-colors-hld-cyan)]'
                   } ${syncStatus === 'pulling' || syncStatus === 'pushing' ? 'animate-pulse' : ''}`}
                   title={
                     syncStatus === 'error'
                       ? (syncError || 'sync error')
                       : syncStatus === 'pulling'
                         ? 'pulling from remote'
                         : syncStatus === 'pushing'
                           ? 'pushing to remote'
                           : syncPending
                             ? [
                                 syncAhead > 0 ? `${syncAhead} unpushed` : null,
                                 syncBehind > 0 ? `${syncBehind} to pull` : null,
                               ].filter(Boolean).join(' · ')
                             : 'synced'
                   }
                 />
               )}
             </div>
          </div>
        </div>
        <div className="flex items-center shrink-0 ml-2">
          <button
            onClick={onStartTutorial}
            className="w-[26px] h-[26px] flex items-center justify-center border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:bg-hld-cyan/10 transition-all"
            title="Start Tutorial"
          >
            <HelpCircle size={12} />
          </button>
        </div>
      </div>

      {/* Project Toolbar — 4 labeled controls (NEW / PROJECTS / FILE / SYNC) */}
      <div className="flex items-center gap-1.5 p-2 border-b border-hld-border bg-[#080d13]">
        <button
          onClick={onResetProject}
          className="flex items-center gap-1.5 px-2.5 h-7 border border-hld-border text-ui-btn font-mono uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-all"
          title="New Blank Project"
        >
          <Plus size={12} /> New
        </button>
        <button
          onClick={onOpenProjectManager}
          className="project-manager-step flex items-center gap-1.5 px-2.5 h-7 border border-[rgba(0,232,245,0.25)] text-ui-btn font-mono uppercase tracking-[0.1em] text-hld-cyan hover:bg-hld-cyan/10 transition-all"
          title="Open Saved Projects"
        >
          <FolderOpen size={12} /> Projects
        </button>
        <FileMenu
          onImportMarkdown={onImportMarkdown}
          onImportProject={onLoadProject}
          onExportMarkdown={onExportMarkdown}
          onExportProject={onSaveProject}
          onExportSpecs={onExportSpecs}
          onLoadDemo={onLoadDefaultProject}
        />
        <button
          onClick={() => useStore.getState().setShowSyncConfigModal(true)}
          className="flex items-center gap-1.5 px-2.5 h-7 border border-hld-border text-ui-btn font-mono uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-all"
          title="Configure git sync (push to private GitHub)"
        >
          <GitBranch size={12} /> Sync
        </button>
      </div>
      
      {/* Treemap & Section Tree Area */}
      <div className="treemap-step flex-1 overflow-hidden p-2.5 flex flex-col gap-2">
         <div className="flex items-center gap-[6px] w-full mt-1">
            <span className="text-ui-label font-mono font-[700] uppercase text-hld-cyan tracking-[0.16em] shrink-0">Structure Map</span>
            <div className="h-[1px] flex-1 bg-hld-border"></div>
         </div>

         <div className="flex-1 w-full border border-hld-border bg-[#080d13] relative overflow-hidden min-h-0">
           <Treemap
             sections={sections}
             selectedId={selectedId || ''}
             onSelect={onSelect}
             hiddenSectionIds={hiddenSectionIds}
             testSuite={testSuite}
           />
         </div>

         <div className="flex items-center gap-[6px] w-full mt-1" style={{marginTop: '4px'}}>
            <span className="text-ui-label font-mono font-[700] uppercase text-hld-cyan tracking-[0.16em] shrink-0">Sections</span>
            <div className="h-[1px] flex-1 bg-hld-border"></div>
         </div>

         <div className="max-h-[140px] overflow-y-auto section-tree">
            {sections.map((sec) => renderSectionTreeItem(sec))}
         </div>
      </div>

      {/* AI Tools & Sprints */}
      <div className="flex flex-col gap-[4px] px-2 pb-2">
        <label className="text-ui-label font-mono font-bold uppercase text-hld-cyan tracking-[0.16em] mb-1 pl-1">Sprints</label>
        <div className="grid grid-cols-2 gap-[4px]">
          <button
             onClick={onSprintGoals}
             className="ai-btn bracketed p-[6px] bg-transparent border border-hld-green/20 text-hld-green text-ui-btn font-mono uppercase tracking-[0.12em] flex items-center justify-center gap-1 transition-all hover:bg-hld-green/10 hover:shadow-[0_0_16px_rgba(0,255,128,0.3)]"
             style={{"--br-color": "var(--tw-colors-hld-green)", marginTop: 0} as any}
             title="Goal Sprint"
          >
             <ChevronsRight size={10} /> Goals
          </button>  
          <button 
             onClick={onSprintContent}
             className="ai-btn bracketed p-[6px] bg-transparent border border-amber-500/20 text-amber-500 text-ui-btn font-mono uppercase tracking-[0.12em] flex items-center justify-center gap-1 transition-all hover:bg-amber-500/10 hover:shadow-[0_0_16px_rgba(245,158,11,0.3)]"
             style={{"--br-color": "var(--tw-colors-amber-500)", marginTop: 0} as any}
             title="Content Sprint"
          >
             <ChevronsRight size={10} /> Draft
          </button>  
        </div>

        <label className="text-ui-label font-mono font-bold uppercase text-hld-cyan tracking-[0.16em] mb-1 pl-1 mt-2">AI Tools</label>
        <button
           onClick={onInterpolateTasks}
           disabled={isInterpolating}
           className="ai-btn bracketed w-full p-[6px] bg-transparent border border-[rgba(0,232,245,0.2)] text-hld-cyan text-ui-btn font-mono uppercase tracking-[0.12em] flex items-center justify-center gap-1 transition-all disabled:opacity-50 hover:bg-[rgba(0,232,245,0.1)] hover:shadow-[0_0_16px_rgba(0,232,245,0.3)]"
           style={{"--br-color": "var(--tw-colors-hld-cyan)", marginTop: 0} as any}
        >
           {isInterpolating ? (
              <><Sparkles size={10} className="animate-spin" /> Analyzing...</>
           ) : (
              <><BrainCircuit size={10} /> Generate Specs</>
           )}
        </button>
        <div className="grid grid-cols-5 gap-[4px] mt-1">
          <button
             onClick={onOpenSectionMap}
             className="map-btn p-[6px] bg-transparent border border-hld-cyan/20 text-hld-cyan text-ui-btn font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-hld-cyan/10 rounded"
             title="Section Goal Editor"
          >
             <Map size={12} /> <span className="opacity-80">Goal Map</span>
          </button>
          <button
             onClick={onOpenDependencyGraph}
             className="topo-btn p-[6px] bg-transparent border border-hld-purple/20 text-hld-purple text-ui-btn font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-hld-purple/10 rounded"
             title="View Dependencies"
          >
             <Network size={12} /> <span className="opacity-80">Dependencies</span>
          </button>
          <button
             onClick={onOpenPromptsGraph}
             className="prompts-btn p-[6px] bg-transparent border border-hld-magenta/20 text-hld-magenta text-ui-btn font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-hld-magenta/10 rounded"
             title="Manage AI Prompts & Routing"
          >
             <BrainCircuit size={12} /> <span className="opacity-80">Prompts</span>
          </button>
          <button
             onClick={onOpenProjectFileEditor}
             className="json-btn p-[6px] bg-transparent border border-emerald-500/20 text-emerald-500 text-ui-btn font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-emerald-500/10 rounded"
             title="Direct JSON Object Editor"
          >
             <FileJson size={12} /> <span className="opacity-80">Raw Data</span>
          </button>
          <button
             onClick={onOpenCoach}
             className="coach-btn p-[6px] bg-transparent border border-hld-yellow/20 text-hld-yellow text-ui-btn font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-hld-yellow/10 rounded"
             title="ADHD Writing Coach"
          >
             <CircleAlert size={12} /> <span className="opacity-80">Coach</span>
          </button>
        </div>
      </div>

      <div className="p-[10px_14px] bg-[#080d13] border-t border-hld-border transition-colors duration-200 shrink-0">
         <div className="flex justify-between items-center">
            <div className="flex flex-col gap-[1px]">
               <div className="text-ui-meta tracking-[0.15em] uppercase text-hld-muted-text font-mono">Words</div>
               <div className="text-ui-stat font-bold text-hld-cyan leading-none font-sans">{markdown.trim().length ? markdown.trim().split(/\s+/).length : 0}</div>
            </div>
            <div className="flex flex-col gap-[1px]">
               <div className="text-ui-meta tracking-[0.15em] uppercase text-hld-muted-text font-mono">Sections</div>
               <div className="text-ui-stat font-bold text-hld-yellow leading-none font-sans">{sections.length}</div>
            </div>
         </div>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-hld-cyan/50 hover:w-2 transition-all duration-150 z-50 translate-x-1/2"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};