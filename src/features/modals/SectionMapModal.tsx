import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, LayoutTemplate, LayoutGrid, CheckCircle2, Circle, AlignJustify } from 'lucide-react';
import { Section, TestSuite } from '../../types';
import { useStore } from '../../store';

interface SectionMapModalProps {
  sections: Section[];
  testSuite: TestSuite;
  onUpdateGoals: (sectionId: string, goals: string) => void;
}

export const SectionMapModal: React.FC<SectionMapModalProps> = ({
  sections,
  testSuite,
  onUpdateGoals
}) => {
  const isOpen = useStore(s => s.showSectionMapModal);
  const setShow = useStore(s => s.setShowSectionMapModal);
  const onClose = () => setShow(false);
  const [layout, setLayout] = useState<'columns' | 'corkboard' | 'rows'>('rows');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(400);

  const modalRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing.current && modalRef.current) {
      const modalRect = modalRef.current.getBoundingClientRect();
      const newWidth = modalRect.right - e.clientX;
      setPanelWidth(Math.min(Math.max(250, newWidth), 800));
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResizing);
  }, [resize]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
  }, [resize, stopResizing]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);
  
  if (!isOpen) return null;

  const topLevelSections = sections.filter(s => s.level === 1 || !s.parentId);

  const renderSectionCard = (section: Section, overrideCompact: boolean = false) => {
    const isSelected = selectedSectionId === section.id;
    const entry = testSuite[section.id];
    const goals = entry?.goals || '';
    const hasGoals = goals.trim().length > 0;
    const isSuccess = entry?.status === 'success';
    
    const isCompact = overrideCompact || layout === 'rows';

    if (isCompact) {
      return (
        <div 
          key={section.id}
          onClick={() => setSelectedSectionId(section.id)}
          className={`
            cursor-pointer p-0.5 transition-all relative overflow-visible group
            w-[24px] h-[24px] flex justify-center items-center
            ${isSelected ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] z-20 scale-[1.3]' : 'bg-[#eec39a] hover:bg-white hover:scale-110 shadow-[0_0_4px_rgba(238,195,154,0.4)] z-10'}
          `}
          title={section.title || `Section ${section.id.split('-').pop()}`}
        >
          {isSelected && (
             <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-cyan-400 animate-bounce cursor-default pointer-events-none"></div>
          )}
          
          <div className="opacity-0 group-hover:opacity-100 absolute top-[130%] left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#0b0c10]/95 px-2 py-1 rounded text-[10px] font-mono text-cyan-50 border border-cyan-500/30 transition-opacity pointer-events-none z-50 shadow-xl backdrop-blur-sm">
            {section.title || `Sec`}
            {hasGoals && (
               <span className="block text-[#eec39a] text-[8px] mt-0.5">{isSuccess ? 'Goals Met' : 'Goals Pending'}</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div 
        key={section.id}
        onClick={() => setSelectedSectionId(section.id)}
        className={`
          cursor-pointer border p-3 rounded text-left transition-colors mb-2 shadow-xl backdrop-blur-sm
          ${isSelected ? 'border-cyan-400 bg-cyan-900/40 text-cyan-50' : 'border-white/10 bg-[#161820]/90 hover:border-cyan-500/50 text-slate-300'}
        `}
      >
        <div className="flex justify-between items-start mb-1">
          <h4 className={`font-bold text-sm line-clamp-2 ${isSelected ? 'text-cyan-50' : 'text-slate-200'}`}>
            {section.title || `Section ${section.id.split('-').pop()}`}
          </h4>
          {hasGoals ? (
             isSuccess ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0 ml-2" /> : <CheckCircle2 size={14} className="text-amber-500 shrink-0 ml-2" />
          ) : (
             <Circle size={14} className="text-white/20 shrink-0 ml-2" />
          )}
        </div>
        <p className={`text-[10px] font-mono truncate ${isSelected ? 'text-cyan-200/70' : 'text-slate-500'}`}>
          {section.wordCount} words {hasGoals ? '• Spec set' : '• No spec'}
        </p>
      </div>
    );
  };

  const renderTree = (section: Section): React.ReactNode => {
    return (
      <div className="flex flex-col items-center">
        <div className="shrink-0 relative z-10 w-fit">
          {renderSectionCard(section, true)}
          {section.children && section.children.length > 0 && (
            <div className="absolute top-[100%] left-1/2 w-[2px] h-[16px] bg-[#ff007f] shadow-[0_0_6px_rgba(255,0,127,0.7)] -translate-x-1/2 z-0"></div>
          )}
        </div>
        {section.children && section.children.length > 0 && (
           <div className="flex items-start gap-4 relative mt-[16px] pt-[16px]">
              {/* horizontal connecting line across children */}
              {section.children.length > 1 && (
                <div className="absolute top-0 left-[calc(14px)] right-[calc(14px)] h-[2px] bg-[#ff007f] shadow-[0_0_6px_rgba(255,0,127,0.7)] z-0"></div>
              )}
              {section.children.map(child => (
                <div key={child.id} className="relative z-10 flex justify-center">
                   <div className="absolute top-[-16px] left-1/2 w-[2px] h-[16px] bg-[#ff007f] shadow-[0_0_6px_rgba(255,0,127,0.7)] -translate-x-1/2 z-0"></div>
                   {renderTree(child)}
                </div>
              ))}
           </div>
        )}
      </div>
    );
  };

  const findSectionDeep = (nodes: Section[], id: string | null): Section | null => {
    if (!id) return null;
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findSectionDeep(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedSection = findSectionDeep(sections, selectedSectionId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div ref={modalRef} className="bg-white dark:bg-hld-bg rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] border border-slate-200 dark:border-hld-border flex overflow-hidden">
        
        {/* Main Interface */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-hld-border bg-white dark:bg-hld-surface flex justify-between items-center shrink-0">
             <div>
               <h3 className="font-bold text-lg dark:text-hld-text font-sans">Project Map</h3>
               <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono mt-1">Navigate & Plan Sections</p>
             </div>
             <div className="flex bg-slate-100 dark:bg-hld-bg p-1 rounded-lg">
                <button 
                  onClick={() => setLayout('rows')}
                  className={`p-1.5 rounded flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors ${layout === 'rows' ? 'bg-white dark:bg-hld-surface shadow-sm text-indigo-600 dark:text-hld-cyan font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  <AlignJustify size={14} /> Rows
                </button>
                <button 
                  onClick={() => setLayout('columns')}
                  className={`p-1.5 rounded flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors ${layout === 'columns' ? 'bg-white dark:bg-hld-surface shadow-sm text-indigo-600 dark:text-hld-cyan font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  <LayoutTemplate size={14} /> Columns
                </button>
                <button 
                  onClick={() => setLayout('corkboard')}
                  className={`p-1.5 rounded flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors ${layout === 'corkboard' ? 'bg-white dark:bg-hld-surface shadow-sm text-indigo-600 dark:text-hld-cyan font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  <LayoutGrid size={14} /> Corkboard
                </button>
             </div>
          </div>
          
          <div className="flex-1 overflow-auto relative bg-[#0a0c10] select-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center center' }}>
             {/* Tech HUD Decals */}
             <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-white/20 pointer-events-none"></div>
             <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-white/20 pointer-events-none"></div>
             <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-white/20 pointer-events-none"></div>
             <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-white/20 pointer-events-none"></div>
             
             <div className="p-8 h-full w-full">
                {layout === 'rows' && (
                  <div className="flex flex-col gap-16 h-full min-w-min w-max mx-auto items-center pt-12 pb-24">
                     {topLevelSections.map((l1, i) => (
                       <div key={l1.id} className="w-full flex flex-col items-center relative">
                          <div className="absolute -top-[32px] left-1/2 -translate-x-1/2 font-mono text-[10px] text-cyan-400 font-bold uppercase tracking-[0.3em] px-4 py-1 border border-cyan-500/40 rounded bg-cyan-950/40 shadow-[0_0_10px_rgba(34,211,238,0.2)] backdrop-blur-md z-30 pointer-events-none">
                            Chapter {i+1}
                          </div>
                          {renderTree(l1)}
                       </div>
                     ))}
                  </div>
                )}
                
                {layout === 'columns' && (
              <div className="flex gap-6 h-full w-max">
                 {topLevelSections.map((l1, i) => (
                   <React.Fragment key={l1.id}>
                     {/* Column 1: L1 Node */}
                     <div className="w-[300px] shrink-0 flex flex-col">
                        <div className="font-mono text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mb-4 pb-2 border-b border-white/10">
                          H1 Node / Sector {i+1}
                        </div>
                        {renderSectionCard(l1)}
                     </div>
                     {/* Column 2: Its children */}
                     {l1.children && l1.children.length > 0 && (
                        <div className="w-[300px] shrink-0 flex flex-col px-4 border-l-2 border-dashed border-white/10">
                           <div className="font-mono text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mb-4 pb-2 border-b border-white/10">
                              H{l1.children[0].level} Subnodes
                           </div>
                           <div className="flex-1 overflow-y-auto pr-2">
                             {l1.children.map(child => (
                               <div key={child.id} className="relative">
                                  {renderSectionCard(child)}
                                  {child.children && child.children.length > 0 && (
                                     <div className="pl-4 ml-2 border-l-2 border-white/10 mt-2 mb-4">
                                        {child.children.map(grandchild => renderSectionCard(grandchild))}
                                     </div>
                                  )}
                               </div>
                             ))}
                           </div>
                        </div>
                     )}
                   </React.Fragment>
                 ))}
              </div>
            )}
            
            {layout === 'corkboard' && (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {topLevelSections.map(l1 => (
                    <div key={l1.id} className="bg-[#11131a]/80 backdrop-blur-sm p-4 rounded-xl border border-white/5 shadow-inner">
                       <div className="mb-4">
                         {renderSectionCard(l1)}
                       </div>
                       <div className="space-y-2">
                         {l1.children && l1.children.map(child => (
                            <div key={child.id} className="pl-4 relative">
                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#ff007f]/30" />
                              <div className="absolute left-0 top-6 w-3 h-[2px] bg-[#ff007f]/30" />
                              {renderSectionCard(child)}
                              {child.children && child.children.map(grandchild => (
                                 <div key={grandchild.id} className="pl-4 relative mt-2">
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-400/30" />
                                    <div className="absolute left-0 top-6 w-3 h-[2px] bg-cyan-400/30" />
                                    {renderSectionCard(grandchild)}
                                 </div>
                              ))}
                            </div>
                         ))}
                       </div>
                    </div>
                  ))}
               </div>
            )}
            </div>
          </div>
        </div>

        {/* Resizer */}
        <div 
          onMouseDown={startResizing}
          className="w-1 cursor-col-resize flex-shrink-0 bg-slate-200 dark:bg-hld-border hover:bg-indigo-400 dark:hover:bg-hld-cyan transition-colors"
        />

        {/* Side Panel */}
        <div style={{ width: panelWidth }} className="flex flex-col bg-white dark:bg-hld-surface shrink-0 relative">
          <div className="p-4 border-b border-slate-200 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-bold text-sm font-sans dark:text-hld-text uppercase tracking-widest text-slate-700">Goal Editor</h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-hld-border text-slate-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {selectedSection ? (
               <div className="flex flex-col h-full">
                 <div className="mb-4">
                   <h2 className="text-xl font-bold dark:text-hld-text mb-3 font-sans leading-tight">{selectedSection.title || 'Untitled Section'}</h2>
                   <div className="text-[10px] font-mono text-indigo-700 dark:text-hld-cyan uppercase tracking-widest bg-indigo-50 dark:bg-hld-cyan/10 inline-block px-2 py-1 rounded shadow-sm border border-indigo-100 dark:border-hld-cyan/30">
                     H{selectedSection.level} • {selectedSection.wordCount} words
                   </div>
                 </div>
                 
                 <div className="mb-6 bg-slate-50 dark:bg-hld-bg/50 border border-slate-200 dark:border-hld-border rounded p-4 overflow-y-auto max-h-[30vh]">
                   <label className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-500 dark:text-hld-muted mb-2 block border-b border-slate-200 dark:border-hld-border/50 pb-1">Markdown Content</label>
                   <div className="text-xs text-slate-700 dark:text-hld-text font-sans whitespace-pre-wrap font-medium">
                     {selectedSection.content || <span className="italic opacity-50">Empty section content...</span>}
                   </div>
                 </div>
                 
                 <div className="flex-1 flex flex-col relative h-[50%] min-h-[250px]">
                   <label className="text-xs font-bold text-slate-600 dark:text-hld-muted uppercase tracking-widest mb-2 font-mono flex items-center justify-between">
                     <span>Section Goal / Spec</span>
                     <span className="text-[9px] font-normal opacity-50 dark:text-hld-muted">(Auto-saves)</span>
                   </label>
                   <textarea
                     className="w-full flex-1 p-4 bg-slate-50 dark:bg-hld-bg border border-slate-200 dark:border-hld-border rounded-lg text-sm dark:text-hld-text font-sans resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-hld-cyan shadow-inner font-medium text-slate-700"
                     placeholder="What should this section accomplish? E.g., 'Argue that...'"
                     value={testSuite[selectedSection.id]?.goals || ''}
                     onChange={(e) => onUpdateGoals(selectedSection.id, e.target.value)}
                   />
                 </div>
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-hld-muted p-8 text-center border-2 border-dashed border-slate-200 dark:border-hld-border rounded-xl bg-slate-50 dark:bg-hld-bg/50">
                 <LayoutTemplate size={32} className="mb-4 opacity-50 text-indigo-300 dark:text-hld-cyan" />
                 <p className="text-sm font-sans mb-1 font-semibold">No section selected.</p>
                 <p className="text-[10px] font-mono uppercase tracking-widest opacity-70 mt-2">Click a section card to edit its goals.</p>
               </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};
