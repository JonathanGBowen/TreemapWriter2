import React, { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportAllProjects } from "../../lib/exportBackup";

interface FileMenuProps {
  onImportMarkdown: (content: string) => void;
  onImportProject: (content: string) => void;
  onExportMarkdown: () => void;
  onExportProject: () => void;
  onExportSpecs: () => void;
  onLoadDemo: () => void;
}

/**
 * Consolidated FILE menu. Absorbs the old icon-only import/export toolbar
 * into a single labeled dropdown so every action is visible text, not a
 * hover-only tooltip. Owns its own hidden file inputs + open state.
 */
export const FileMenu: React.FC<FileMenuProps> = ({
  onImportMarkdown,
  onImportProject,
  onExportMarkdown,
  onExportProject,
  onExportSpecs,
  onLoadDemo,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const readFile = (event: React.ChangeEvent<HTMLInputElement>, cb: (content: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') cb(content);
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

  const run = (fn: () => void) => { fn(); setOpen(false); };

  const rowCls =
    "w-full text-left px-3 py-[6px] text-ui-btn font-mono uppercase tracking-[0.1em] text-hld-text hover:bg-[rgba(0,232,245,0.08)] hover:text-hld-cyan transition-colors";

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 h-7 border border-hld-border text-ui-btn font-mono uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan hover:border-hld-cyan/40 transition-all"
        title="Import / Export files"
      >
        <FileDown size={12} /> File ▾
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[180px] bg-hld-surface2 border border-[rgba(0,232,245,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.6)] py-1">
          <button className={rowCls} onClick={() => run(() => mdInputRef.current?.click())}>Import Markdown</button>
          <button className={rowCls} onClick={() => run(() => projectInputRef.current?.click())}>Import Project</button>
          <div className="h-[1px] my-1 bg-hld-border" />
          <button className={rowCls} onClick={() => run(onExportMarkdown)}>Export Markdown</button>
          <button className={rowCls} onClick={() => run(onExportProject)}>Export Project (.socratic)</button>
          <button className={rowCls} onClick={() => run(onExportSpecs)}>Export Specs JSON</button>
          <div className="h-[1px] my-1 bg-hld-border" />
          <button className={rowCls} onClick={() => run(onLoadDemo)}>Load Demo Project</button>
          <button className={rowCls} onClick={() => run(handleBackupAll)}>Backup All Projects</button>
        </div>
      )}

      <input type="file" ref={mdInputRef} className="hidden" accept=".md,.markdown,.txt" onChange={(e) => readFile(e, onImportMarkdown)} />
      <input type="file" ref={projectInputRef} className="hidden" accept=".socratic,.json" onChange={(e) => readFile(e, onImportProject)} />
    </div>
  );
};
