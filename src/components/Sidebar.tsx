import React, { useRef } from "react";
import { BrainCircuit, Sun, Moon, Upload, FolderOpen, Save, FilePlus, Sparkles, RefreshCw, Trash2, Download, Network, CircleAlert, CheckCircle, Clock, HelpCircle, ChevronsRight, FileDown, Map, FileJson, Archive } from "lucide-react";
import { toast } from "sonner";
import { Treemap } from "./Treemap";
import { Section } from "../types";
import { useStore } from "../store";
import { exportAllProjects } from "../lib/exportBackup";

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
  const isDarkMode = useStore(s => s.isDarkMode);
  const setIsDarkMode = useStore(s => s.setIsDarkMode);
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

  const mdInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleMdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') onImportMarkdown(content);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleProjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') onLoadProject(content);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleBackupAll = async () => {
    try {
      await exportAllProjects();
      toast.success('Backup downloaded. Keep it somewhere safe.');
    } catch (err) {
      toast.error('Backup failed. See console.');
      console.error(err);
    }
  };

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
    
    let sqColor = 'bg-slate-300 dark:bg-hld-dim'; // Default idle
    let sqShadow = '';
    
    switch (status) {
      case 'success':
        sqColor = 'bg-emerald-500 dark:bg-hld-green';
        sqShadow = 'dark:shadow-[0_0_5px_var(--tw-colors-hld-green)]';
        break;
      case 'fail':
        sqColor = 'bg-rose-500 dark:bg-hld-magenta';
        sqShadow = 'dark:shadow-[0_0_5px_var(--tw-colors-hld-magenta)]';
        break;
      case 'stale':
        sqColor = 'bg-amber-400 dark:bg-hld-yellow';
        sqShadow = 'dark:shadow-[0_0_5px_var(--tw-colors-hld-yellow)]';
        break;
      case 'running':
        sqColor = 'bg-indigo-500 dark:bg-hld-cyan';
        sqShadow = 'animate-pulse';
        break;
    }

    return (
      <div 
        key={sec.id}
        onClick={() => onSelect(sec.id)}
        className={`flex items-center gap-0 p-[4px_12px] cursor-pointer transition-all relative select-none hover:bg-slate-100 dark:hover:bg-hld-surface2 ${isSelected ? 'dark:bg-[rgba(0,232,245,0.05)] bg-indigo-50' : ''}`}
      >
        {isSelected && (
           <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500 dark:bg-hld-cyan dark:shadow-[0_0_6px_var(--tw-colors-hld-cyan)]" />
        )}
        <div className="shrink-0" style={{ width: `${paddingLeft}px` }}></div>
        <div className={`w-[6px] h-[6px] shrink-0 mr-2 transition-shadow ${sqColor} ${sqShadow}`}></div>
        <div className={`flex-1 text-[9px] whitespace-nowrap overflow-hidden text-ellipsis ${isSelected ? 'text-indigo-600 dark:text-hld-cyan opacity-100 font-bold' : 'text-slate-600 dark:text-hld-text opacity-65'}`}>
          {sec.title}
        </div>
        <div className="text-[7px] text-slate-400 dark:text-hld-muted">{sec.wordCount}w</div>
      </div>
    );
  };

  return (
    <div 
      style={{ width }} 
      className="h-full flex-none relative border-r border-slate-200 dark:border-hld-border bg-white dark:bg-hld-surface flex flex-col shadow-sm z-10 transition-colors duration-200"
    >
      {/* App Header */}
      <div className="p-3 border-b border-slate-100 dark:border-hld-border flex items-center justify-between bg-slate-50 dark:bg-hld-surface2 relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-indigo-500 dark:bg-hld-cyan dark:shadow-[0_0_12px_var(--tw-colors-hld-cyan)]" />
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-[18px] h-[18px] bg-indigo-600 dark:bg-hld-cyan rotate-45 shrink-0 shadow-[0_0_14px_rgba(0,232,245,0.25)] relative mr-1">
             <div className="absolute inset-[3px] bg-white dark:bg-hld-surface2" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
             <input 
               value={projectName}
               onChange={(e) => setProjectName(e.target.value)}
               className="font-bold text-[10px] uppercase font-mono tracking-[0.12em] text-slate-700 dark:text-hld-text bg-transparent outline-none border-b border-transparent hover:border-slate-300 dark:hover:border-hld-border focus:border-indigo-500 dark:focus:border-hld-cyan truncate transition-colors"
               placeholder="Project Name"
               title="Rename Project"
             />
             <div className="flex items-center gap-1.5 mt-0.5 text-[7px] text-slate-400 dark:text-hld-cyan font-mono uppercase tracking-[0.14em]">
               <span className="w-1 h-1 rounded-full bg-emerald-500 dark:bg-hld-green animate-pulse shadow-[0_0_6px_var(--tw-colors-hld-green)]"></span>
               autosaved
             </div>
          </div>
        </div>
        <div className="flex items-center shrink-0 ml-2">
          <button 
            onClick={onStartTutorial}
            className="w-[26px] h-[26px] flex items-center justify-center border-l border-y border-slate-200 dark:border-hld-border text-slate-500 dark:text-hld-muted hover:text-indigo-600 dark:hover:text-hld-cyan hover:bg-slate-100 dark:hover:bg-hld-cyan/10 transition-all"
            title="Start Tutorial"
          >
            <HelpCircle size={12} />
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-[26px] h-[26px] flex items-center justify-center border border-slate-200 dark:border-hld-border text-slate-500 dark:text-hld-muted hover:text-indigo-600 dark:hover:text-hld-cyan hover:bg-slate-100 dark:hover:bg-hld-cyan/10 transition-all"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun size={12} className="dark:text-hld-text" /> : <Moon size={12} />}
          </button>
        </div>
      </div>

      {/* Project Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-hld-border bg-slate-50/50 dark:bg-[#080d13]">
        <div className="flex gap-1">
          <button 
            onClick={onResetProject}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="New Blank Project"
          >
            <FilePlus size={14} />
          </button>
          <button 
            onClick={onLoadDefaultProject}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="Load Default Demo"
          >
            <RefreshCw size={14} />
          </button>
          <button 
            onClick={onOpenProjectManager}
            className="project-manager-step w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="Open Saved Projects"
          >
            <FolderOpen size={14} />
          </button>
        </div>
        <div className="flex gap-1 border-l border-slate-200 dark:border-hld-border pl-1">
          <button 
            onClick={onSaveProject}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="Export Project File (.socratic)"
          >
            <Download size={14} />
          </button>
          <button 
            onClick={() => projectInputRef.current?.click()}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="Import Project (.socratic)"
          >
            <Upload size={14} />
          </button>
          <button 
            onClick={onExportMarkdown}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="Export Markdown File (.md)"
          >
            <FileDown size={14} />
          </button>
          <button 
            onClick={onExportSpecs}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="Export Specs JSON"
          >
            <FileJson size={14} />
          </button>
          <button
            onClick={() => mdInputRef.current?.click()}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-indigo-500 dark:hover:text-hld-cyan transition-colors"
            title="Import Markdown"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={handleBackupAll}
            className="w-7 h-7 flex items-center justify-center rounded bg-transparent hover:bg-slate-200 dark:hover:bg-hld-surface2 text-slate-500 dark:text-hld-muted hover:text-amber-500 dark:hover:text-hld-yellow transition-colors"
            title="Backup ALL projects (one-time migration insurance)"
          >
            <Archive size={14} />
          </button>
        </div>

        {/* Hidden Inputs */}
        <input 
          type="file" 
          ref={mdInputRef} 
          className="hidden" 
          accept=".md,.markdown,.txt" 
          onChange={handleMdChange}
        />
        <input 
          type="file" 
          ref={projectInputRef} 
          className="hidden" 
          accept=".socratic,.json" 
          onChange={handleProjectChange}
        />
      </div>
      
      {/* Treemap & Section Tree Area */}
      <div className="treemap-step flex-1 overflow-hidden p-2.5 flex flex-col gap-2">
         <div className="flex items-center gap-[6px] w-full mt-1">
            <span className="text-[7px] font-mono font-[700] uppercase text-indigo-500 dark:text-hld-cyan tracking-[0.16em] shrink-0">Structure Map</span>
            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-hld-border"></div>
         </div>

         <div className="flex-1 w-full border border-slate-100 dark:border-hld-border bg-white dark:bg-[#080d13] relative overflow-hidden min-h-0">
           <Treemap 
             sections={sections} 
             selectedId={selectedId || ''} 
             onSelect={onSelect} 
             isDarkMode={isDarkMode}
             hiddenSectionIds={hiddenSectionIds}
             testSuite={testSuite}
           />
         </div>

         <div className="flex items-center gap-[6px] w-full mt-1" style={{marginTop: '4px'}}>
            <span className="text-[7px] font-mono font-[700] uppercase text-indigo-500 dark:text-hld-cyan tracking-[0.16em] shrink-0">Sections</span>
            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-hld-border"></div>
         </div>

         <div className="max-h-[140px] overflow-y-auto section-tree">
            {sections.map((sec) => renderSectionTreeItem(sec))}
         </div>
      </div>

      {/* AI Tools & Sprints */}
      <div className="flex flex-col gap-[4px] px-2 pb-2">
        <label className="text-[7px] font-mono font-bold uppercase text-indigo-500 dark:text-hld-cyan tracking-[0.16em] mb-1 pl-1">Sprints</label>
        <div className="grid grid-cols-2 gap-[4px]">
          <button 
             onClick={onSprintGoals}
             className="ai-btn bracketed p-[6px] bg-transparent border border-emerald-200 dark:border-hld-green/20 text-emerald-700 dark:text-hld-green text-[8px] font-mono uppercase tracking-[0.12em] flex items-center justify-center gap-1 transition-all hover:bg-emerald-50 dark:hover:bg-hld-green/10 hover:shadow-[0_0_16px_rgba(0,255,128,0.3)]"
             style={{"--br-color": "var(--tw-colors-hld-green)", marginTop: 0} as any}
             title="Goal Sprint"
          >
             <ChevronsRight size={10} /> Goals
          </button>  
          <button 
             onClick={onSprintContent}
             className="ai-btn bracketed p-[6px] bg-transparent border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-500 text-[8px] font-mono uppercase tracking-[0.12em] flex items-center justify-center gap-1 transition-all hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:shadow-[0_0_16px_rgba(245,158,11,0.3)]"
             style={{"--br-color": "var(--tw-colors-amber-500)", marginTop: 0} as any}
             title="Content Sprint"
          >
             <ChevronsRight size={10} /> Draft
          </button>  
        </div>

        <label className="text-[7px] font-mono font-bold uppercase text-indigo-500 dark:text-hld-cyan tracking-[0.16em] mb-1 pl-1 mt-2">AI Tools</label>
        <button 
           onClick={onInterpolateTasks}
           disabled={isInterpolating}
           className="ai-btn bracketed w-full p-[6px] bg-transparent border border-indigo-200 dark:border-[rgba(0,232,245,0.2)] text-indigo-700 dark:text-hld-cyan text-[8px] font-mono uppercase tracking-[0.12em] flex items-center justify-center gap-1 transition-all disabled:opacity-50 hover:bg-indigo-50 dark:hover:bg-[rgba(0,232,245,0.1)] hover:shadow-[0_0_16px_rgba(0,232,245,0.3)]"
           style={{"--br-color": "var(--tw-colors-hld-cyan)", marginTop: 0} as any}
        >
           {isInterpolating ? (
              <><Sparkles size={10} className="animate-spin" /> Analyzing...</>
           ) : (
              <><BrainCircuit size={10} /> Interpolate Mode</>
           )}
        </button>
        <div className="grid grid-cols-5 gap-[4px] mt-1">
          <button 
             onClick={onOpenSectionMap}
             className="map-btn p-[6px] bg-transparent border border-indigo-200 dark:border-hld-cyan/20 text-indigo-700 dark:text-hld-cyan text-[8px] font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-indigo-50 dark:hover:bg-hld-cyan/10 rounded"
             title="Project Map & Goal Editor"
          >
             <Map size={12} /> <span className="opacity-80">Proj Map</span>
          </button>
          <button 
             onClick={onOpenDependencyGraph}
             className="topo-btn p-[6px] bg-transparent border border-fuchsia-200 dark:border-hld-purple/20 text-fuchsia-700 dark:text-hld-purple text-[8px] font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-fuchsia-50 dark:hover:bg-hld-purple/10 rounded"
             title="View Dependency Graph"
          >
             <Network size={12} /> <span className="opacity-80">Topology</span>
          </button>
          <button 
             onClick={onOpenPromptsGraph}
             className="prompts-btn p-[6px] bg-transparent border border-rose-200 dark:border-hld-magenta/20 text-rose-700 dark:text-hld-magenta text-[8px] font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-rose-50 dark:hover:bg-hld-magenta/10 rounded"
             title="Manage AI Prompts & Routing"
          >
             <BrainCircuit size={12} /> <span className="opacity-80">Prompts</span>
          </button>
          <button 
             onClick={onOpenProjectFileEditor}
             className="json-btn p-[6px] bg-transparent border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-500 text-[8px] font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded"
             title="Direct JSON Object Editor"
          >
             <FileJson size={12} /> <span className="opacity-80">JSON Root</span>
          </button>
          <button 
             onClick={onOpenCoach}
             className="coach-btn p-[6px] bg-transparent border border-amber-200 dark:border-hld-yellow/20 text-amber-700 dark:text-hld-yellow text-[8px] font-mono uppercase tracking-[0.1em] flex flex-col items-center justify-center gap-1 transition-all hover:bg-amber-50 dark:hover:bg-hld-yellow/10 rounded"
             title="ADHD Writing Coach"
          >
             <CircleAlert size={12} /> <span className="opacity-80">Coach</span>
          </button>
        </div>
      </div>

      <div className="p-[10px_14px] bg-slate-50 dark:bg-[#080d13] border-t border-slate-200 dark:border-hld-border transition-colors duration-200 shrink-0">
         <div className="flex justify-between items-center">
            <div className="flex flex-col gap-[1px]">
               <div className="text-[6px] tracking-[0.15em] uppercase text-slate-500 dark:text-hld-muted font-mono">Words</div>
               <div className="text-[16px] font-bold dark:text-hld-cyan leading-none font-sans">{markdown.trim().length ? markdown.trim().split(/\s+/).length : 0}</div>
            </div>
            <div className="flex flex-col gap-[1px]">
               <div className="text-[6px] tracking-[0.15em] uppercase text-slate-500 dark:text-hld-muted font-mono">Sections</div>
               <div className="text-[16px] font-bold dark:text-hld-yellow leading-none font-sans">{sections.length}</div>
            </div>
         </div>
      </div>

      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 dark:hover:bg-hld-cyan/50 hover:w-2 transition-all duration-150 z-50 translate-x-1/2"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};