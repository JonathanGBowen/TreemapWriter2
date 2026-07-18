import React, { useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import { ProjectMeta } from "../../../types";
import { useStore } from "../../../store";
import { ModalShell } from "../shared/ModalShell";
import { Pip } from "../../shared/Pip";

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

const formatDay = (ts: number) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** A project row in section-list grammar: pip · name · quiet meta · hover-revealed ✕. */
function ProjRow({ project, active, onOpen, onDelete }: { project: ProjectMeta; active: boolean; onOpen: () => void; onDelete: () => void }) {
  const meta = active ? `open now · ${project.wordCount.toLocaleString()}w` : `${formatDay(project.lastModified)} · ${project.wordCount.toLocaleString()}w`;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={`group relative flex items-center gap-[11px] px-[12px] py-[10px] cursor-pointer border-b border-hld-border/60 last:border-b-0 ${active ? 'bg-hld-cyan/5' : 'hover:bg-hld-cyan/[0.03]'}`}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-hld-cyan shadow-[0_0_6px_var(--color-hld-cyan)]" />}
      <Pip status={active ? 'cyan' : 'idle'} />
      <span className={`flex-1 min-w-0 truncate text-[11px] tracking-[0.04em] ${active ? 'text-hld-cyan font-bold' : 'text-hld-text'}`}>{project.name}</span>
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-hld-muted-text shrink-0">{meta}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete project"
        aria-label={`Delete ${project.name}`}
        className="w-[18px] text-center text-[11px] leading-none text-transparent group-hover:text-hld-muted-text hover:!text-hld-yellow focus:text-hld-yellow transition-colors shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  projects, activeProjectId, onLoadProject, onCreateProject, onLoadDefaultProject, onDeleteProject, onOpenProject,
}) => {
  const isOpen = useStore((s) => s.showProjectModal);
  const setShow = useStore((s) => s.setShowProjectModal);
  const onClose = () => setShow(false);
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.lastModified - a.lastModified);

  const quietBtn = "font-mono text-[9px] tracking-[0.12em] uppercase px-[12px] py-[8px] border border-hld-border text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-colors";

  const footer = (
    <>
      <button type="button" onClick={() => { onLoadDefaultProject(); onClose(); }} className={quietBtn}>Load demo</button>
      {onOpenProject && (
        <button type="button" onClick={() => { onOpenProject(); onClose(); }} className={`${quietBtn} flex items-center gap-2`}>
          <FolderOpen size={13} /> Open folder
        </button>
      )}
      <button
        type="button"
        onClick={() => { onCreateProject(); onClose(); }}
        style={{ '--br-color': 'var(--color-hld-cyan)' } as React.CSSProperties}
        className="bracketed hld-lit ml-auto font-mono text-[10px] font-bold tracking-[0.14em] uppercase px-[18px] py-[9px]"
      >
        + New project
      </button>
    </>
  );

  return (
    <ModalShell
      eyebrow="Projects"
      title="Open a project"
      sub={`${projects.length} on this machine`}
      onClose={onClose}
      onPrimary={() => { onCreateProject(); onClose(); }}
      footer={footer}
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-[12px]">
        <div className="flex items-center gap-[8px] border-b border-hld-border pb-[7px]">
          <Search size={12} className="text-hld-muted-text shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to filter…"
            aria-label="Filter projects"
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-hld-text placeholder:text-hld-muted-text/70 placeholder:uppercase placeholder:tracking-[0.1em] placeholder:font-mono"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-hld-muted-text font-mono text-[10px] uppercase tracking-[0.14em]">No projects found.</div>
        ) : (
          <div className="border border-hld-border">
            {filtered.map((project) => (
              <ProjRow
                key={project.id}
                project={project}
                active={project.id === activeProjectId}
                onOpen={() => { onLoadProject(project.id); onClose(); }}
                onDelete={() => onDeleteProject(project.id)}
              />
            ))}
          </div>
        )}

        <div className="text-right font-mono text-[8px] tracking-[0.1em] uppercase text-hld-muted-text">
          delete asks once — it is the only thing here that does
        </div>
      </div>
    </ModalShell>
  );
};
