// The editor's empty-state overlay: the desktop no-project gate ("Start a
// Project") and the blank-document invitation ("Ready to Write?"). Extracted
// from EditorPanel so the writing surface stays close to the cognitive-load
// target; owns its file-input plumbing and reads its store actions directly.

import React, { useRef } from 'react';
import { FilePlus, FolderOpen, PenTool, GitBranch } from 'lucide-react';
import { useStore } from '../../store';

interface EditorEmptyStateProps {
  /** Desktop-only: no on-disk project handle yet (the read-only preview). */
  needsProject: boolean;
  onImportMarkdown: (content: string) => void;
  onLoadProject: (content: string) => void;
  /** Seed a blank page and drop the caret into the (now-mounted) editor. */
  onStartBlank: () => void;
}

export const EditorEmptyState: React.FC<EditorEmptyStateProps> = ({
  needsProject,
  onImportMarkdown,
  onLoadProject,
  onStartBlank,
}) => {
  const createNewProject = useStore((s) => s.createNewProject);
  const openExistingProject = useStore((s) => s.openExistingProject);
  const setShowRemoteProjectModal = useStore((s) => s.setShowRemoteProjectModal);
  const isEmptyState = useStore((s) => s.localContent.trim() === '');

  const mdInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const readFile = (
    event: React.ChangeEvent<HTMLInputElement>,
    handle: (content: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') handle(content);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 pointer-events-none opacity-100 animate-in fade-in duration-700">
       <div className="text-center pointer-events-auto bg-hld-surface/80 backdrop-blur-sm p-12 border border-[rgba(0,232,245,0.2)] shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-lg w-full">
         {needsProject ? (
           <>
             <h2 className="text-[14px] uppercase tracking-[0.15em] font-bold text-hld-text mb-2 font-mono">Start a Project</h2>
             <p className="text-[13px] text-hld-muted-text-2 mb-8 leading-[1.65]">{isEmptyState ? 'Your writing lives in a project folder — saved to disk, with version history. Create or open one to begin.' : 'This is a read-only preview — nothing here is saved. Your writing lives in a project folder on disk, with version history. Create or open one to begin.'}</p>
             <div className="space-y-3">
               <button onClick={() => { void createNewProject(); }} className="bracketed w-full flex items-center justify-center gap-3 px-6 py-4 bg-transparent border border-[rgba(0,232,245,0.2)] text-hld-cyan hover:bg-[rgba(0,232,245,0.05)] transition-all group hover:shadow-[0_0_16px_rgba(0,232,245,0.2)] hover:border-[rgba(0,232,245,0.4)]" style={{"--br-color": "var(--tw-colors-hld-cyan)"} as any}>
                 <FilePlus size={16} className="group-hover:scale-110 transition-transform"/>
                 <span className="font-bold font-mono uppercase tracking-[0.14em] text-ui-btn">New Project</span>
               </button>
               <button onClick={() => { void openExistingProject(); }} className="bracketed w-full flex items-center justify-center gap-3 px-6 py-4 bg-transparent border border-[rgba(0,232,245,0.2)] text-hld-cyan hover:bg-[rgba(0,232,245,0.05)] transition-all group hover:shadow-[0_0_16px_rgba(0,232,245,0.2)] hover:border-[rgba(0,232,245,0.4)]" style={{"--br-color": "var(--tw-colors-hld-cyan)"} as any}>
                 <FolderOpen size={16} className="group-hover:scale-110 transition-transform"/>
                 <span className="font-bold font-mono uppercase tracking-[0.14em] text-ui-btn">Open Project</span>
               </button>
               <div className="pt-4 text-center">
                  <button onClick={() => setShowRemoteProjectModal(true)} className="text-hld-muted-text hover:text-hld-text text-ui-btn font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-2 mx-auto transition-colors">
                     <GitBranch size={12} /> Clone from a remote
                  </button>
               </div>
             </div>
           </>
         ) : (
           <>
             <h2 className="text-[14px] uppercase tracking-[0.15em] font-bold text-hld-text mb-2 font-mono">Ready to Write?</h2>
             <p className="text-[13px] text-hld-muted-text-2 mb-8 leading-[1.65]">Import a markdown file to visualize its structure, or just start typing.</p>
             <div className="space-y-3">
               <button onClick={() => mdInputRef.current?.click()} className="bracketed w-full flex items-center justify-center gap-3 px-6 py-4 bg-transparent border border-[rgba(0,232,245,0.2)] text-hld-cyan hover:bg-[rgba(0,232,245,0.05)] transition-all group hover:shadow-[0_0_16px_rgba(0,232,245,0.2)] hover:border-[rgba(0,232,245,0.4)]" style={{"--br-color": "var(--tw-colors-hld-cyan)"} as any}>
                 <FilePlus size={16} className="group-hover:scale-110 transition-transform"/>
                 <span className="font-bold font-mono uppercase tracking-[0.14em] text-ui-btn">Import Markdown</span>
               </button>
               <div className="pt-4 text-center">
                  <button onClick={onStartBlank} className="text-hld-muted-text hover:text-hld-text text-ui-btn font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-2 mx-auto transition-colors">
                     <PenTool size={12} /> Start with a blank page
                  </button>
               </div>
             </div>
           </>
         )}
       </div>
       <input type="file" ref={mdInputRef} className="hidden" accept=".md,.markdown,.txt" onChange={(e) => readFile(e, onImportMarkdown)} />
       <input type="file" ref={projectInputRef} className="hidden" accept=".json,.socratic" onChange={(e) => readFile(e, onLoadProject)} />
    </div>
  );
};
