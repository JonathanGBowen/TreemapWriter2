import React, { useState } from "react";
import { FolderOpen, Plus, Trash2, Clock, FileText, CheckCircle2, Search } from "lucide-react";
import { ProjectMeta } from "../../types";
import { useStore } from "../../store";

interface ProjectManagerModalProps {
  projects: ProjectMeta[];
  activeProjectId: string;
  onLoadProject: (id: string) => void;
  onCreateProject: () => void;
  onLoadDefaultProject: () => void;
  onDeleteProject: (id: string) => void;
  /** Desktop only: open an existing project folder. Undefined hides the button. */
  onOpenProject?: () => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  projects,
  activeProjectId,
  onLoadProject,
  onCreateProject,
  onLoadDefaultProject,
  onDeleteProject,
  onOpenProject
}) => {
  const isOpen = useStore(s => s.showProjectModal);
  const setShow = useStore(s => s.setShowProjectModal);
  const onClose = () => setShow(false);
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filteredProjects = projects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.lastModified - a.lastModified);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-hld-surface rounded-xl shadow-2xl w-full max-w-2xl border border-hld-border flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-hld-border flex justify-between items-center bg-hld-surface2">
          <div>
            <h3 className="text-xl font-bold text-hld-text flex items-center gap-2 font-sans">
              <FolderOpen className="text-hld-cyan" />
              My Projects
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-widest text-hld-muted mt-1">
              Manage your saved Socratic sessions
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-hld-muted hover:text-hld-text p-2 rounded-full hover:bg-hld-border transition-colors text-[10px] font-mono uppercase tracking-widest font-semibold"
          >
            Close
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-hld-border flex gap-3 bg-hld-surface">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hld-muted" size={16} />
             <input 
               type="text" 
               placeholder="Search projects..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-4 py-2 rounded-lg bg-hld-bg border border-hld-border text-sm outline-none focus:ring-2 focus:ring-hld-cyan/30 focus:border-hld-cyan text-hld-text font-sans"
             />
           </div>
           <button
             onClick={() => { onLoadDefaultProject(); onClose(); }}
             className="px-4 py-2 bg-hld-surface2 text-hld-text rounded-lg text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-border flex items-center gap-2 transition-transform active:scale-95 border border-hld-border"
           >
             Load Demo
           </button>
           {onOpenProject && (
             <button
               onClick={() => { onOpenProject(); onClose(); }}
               className="px-4 py-2 bg-hld-surface2 text-hld-text rounded-lg text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-border flex items-center gap-2 transition-transform active:scale-95 border border-hld-border"
             >
               <FolderOpen size={16} /> Open Folder
             </button>
           )}
           <button
             onClick={() => { onCreateProject(); onClose(); }}
             className="px-4 py-2 bg-hld-cyan text-hld-bg rounded-lg text-[10px] font-mono uppercase tracking-widest font-bold shadow-md hover:bg-hld-cyan/80 flex items-center gap-2 transition-transform active:scale-95 hld-glow-cyan"
           >
             <Plus size={16} /> New Project
           </button>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-hld-bg">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-hld-muted">
               <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
               <p className="text-[10px] font-mono uppercase tracking-widest">No projects found.</p>
            </div>
          ) : (
            filteredProjects.map(project => {
              const isActive = project.id === activeProjectId;
              return (
                <div 
                  key={project.id}
                  onClick={() => { onLoadProject(project.id); onClose(); }}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-hld-surface border-hld-cyan ring-1 ring-hld-cyan shadow-md' 
                      : 'bg-hld-surface2 border-hld-border hover:border-hld-cyan/50 hover:shadow-sm'
                  }`}
                >
                   <div className="flex justify-between items-start">
                     <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-lg ${isActive ? 'bg-hld-cyan/20 text-hld-cyan' : 'bg-hld-surface text-hld-muted group-hover:bg-hld-cyan/10 group-hover:text-hld-cyan transition-colors'}`}>
                          {isActive ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                          <h4 className={`font-bold text-base font-sans ${isActive ? 'text-hld-cyan' : 'text-hld-text'}`}>
                            {project.name}
                          </h4>
                          <div className="flex items-center gap-4 mt-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-hld-muted flex items-center gap-1">
                               <Clock size={12} /> {formatDate(project.lastModified)}
                            </span>
                            <span className="text-[10px] text-hld-muted font-mono bg-hld-bg px-1.5 py-0.5 rounded border border-hld-border">
                               {project.wordCount} words
                            </span>
                          </div>
                        </div>
                     </div>

                     <button 
                       onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                       className="p-2 text-hld-muted hover:text-hld-magenta hover:bg-hld-magenta/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                       title="Delete Project"
                     >
                       <Trash2 size={18} />
                     </button>
                   </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};