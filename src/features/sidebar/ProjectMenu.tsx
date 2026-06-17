import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { exportAllProjects } from "../../lib/exportBackup";
import { useStore } from "../../store";
import { isTauri } from "../../services/tauri-environment";
import { Pip } from "../shared/Pip";
import { summarizeSync } from "./sync-status";

/**
 * The ◇ project menu. Absorbs the old NEW / PROJECTS / FILE ▾ / SYNC toolbar and
 * the former FileMenu (its hidden file inputs + backup handling fold in here).
 * Owns the trigger button, the popover, outside-click close, and the file inputs.
 */
interface ProjectMenuProps {
  onResetProject: () => void;
  onLoadDefaultProject: () => void;
  onStartTutorial: () => void;
  onImportMarkdown: (content: string) => void;
  onImportProject: (content: string) => void;
  onExportMarkdown: () => void;
  onExportProject: () => void;
  onExportSpecs: () => void;
}

function MenuRow({ label, meta, onClick }: { label: string; meta?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 text-left px-3 py-[7px] text-[10px] font-mono uppercase tracking-[0.1em] text-hld-text hover:bg-[rgba(0,232,245,0.08)] hover:text-hld-cyan transition-colors"
    >
      <span className="flex-1">{label}</span>
      {meta != null && <span className="text-[8px] tracking-[0.08em] text-hld-muted-text">{meta}</span>}
    </button>
  );
}

const Divider = () => <div className="h-px my-1 bg-hld-border" />;

/** Read a picked file as text and hand the content to `cb`; resets the input. */
function readFileInto(event: React.ChangeEvent<HTMLInputElement>, cb: (content: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { if (typeof e.target?.result === 'string') cb(e.target.result); };
  reader.readAsText(file);
  event.target.value = '';
}

async function backupAll() {
  try {
    await exportAllProjects();
    toast.success('Backup downloaded. Keep it somewhere safe.');
  } catch (err) {
    toast.error('Backup failed. See console.');
    console.error(err);
  }
}

export function ProjectMenu({
  onResetProject, onLoadDefaultProject, onStartTutorial,
  onImportMarkdown, onImportProject, onExportMarkdown, onExportProject, onExportSpecs,
}: ProjectMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const projectCount = useStore((s) => s.projectList.length);
  const setShowProjectModal = useStore((s) => s.setShowProjectModal);
  const setShowSyncConfigModal = useStore((s) => s.setShowSyncConfigModal);
  const setShowRemoteProjectModal = useStore((s) => s.setShowRemoteProjectModal);
  const openCompare = useStore((s) => s.openCompare);
  const sync = summarizeSync(
    useStore((s) => s.syncStatus),
    useStore((s) => s.syncError),
    useStore((s) => s.syncAhead),
    useStore((s) => s.syncBehind),
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const run = (fn: () => void) => { fn(); setOpen(false); };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Project menu"
        aria-expanded={open}
        title="Project menu"
        className="project-manager-step flex items-center gap-1 px-[5px] py-[3px] border border-transparent hover:border-hld-cyan/40 transition-colors"
      >
        <span className="w-[12px] h-[12px] bg-hld-cyan rotate-45 shadow-[0_0_10px_rgba(0,232,245,0.3)] relative inline-block">
          <span className="absolute inset-[2.5px] bg-hld-surface2" />
        </span>
        <span className="text-[7px] text-hld-muted-text">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[220px] bg-hld-surface2 border border-[rgba(0,232,245,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.6)] py-1">
          <MenuRow label="New project" onClick={() => run(onResetProject)} />
          {isTauri() && (
            <MenuRow label="New from remote…" onClick={() => run(() => setShowRemoteProjectModal(true))} />
          )}
          <MenuRow label="Open projects…" meta={projectCount || undefined} onClick={() => run(() => setShowProjectModal(true))} />
          <Divider />
          <MenuRow label="Compare versions" meta="≈" onClick={() => run(openCompare)} />
          <Divider />
          <MenuRow label="Import markdown" onClick={() => run(() => mdInputRef.current?.click())} />
          <MenuRow label="Import project" onClick={() => run(() => projectInputRef.current?.click())} />
          <MenuRow label="Export markdown" onClick={() => run(onExportMarkdown)} />
          <MenuRow label="Export project" meta=".socratic" onClick={() => run(onExportProject)} />
          <MenuRow label="Export specs" meta=".json" onClick={() => run(onExportSpecs)} />
          <MenuRow label="Back up everything" onClick={() => run(backupAll)} />
          <Divider />
          <button
            type="button"
            onClick={() => run(() => setShowSyncConfigModal(true))}
            className="w-full flex items-center gap-2 text-left px-3 py-[7px] text-[10px] font-mono uppercase tracking-[0.1em] text-hld-text hover:bg-[rgba(0,232,245,0.08)] hover:text-hld-cyan transition-colors"
          >
            <span className="flex-1">Sync</span>
            <Pip status={sync.pip} pulse={sync.pulse} size="sm" />
            <span className="text-[8px] tracking-[0.08em] text-hld-muted-text">{sync.text}</span>
          </button>
          <Divider />
          <MenuRow label="Load demo" onClick={() => run(onLoadDefaultProject)} />
          <MenuRow label="Tutorial" onClick={() => run(onStartTutorial)} />
        </div>
      )}

      <input type="file" ref={mdInputRef} className="hidden" accept=".md,.markdown,.txt" onChange={(e) => readFileInto(e, onImportMarkdown)} />
      <input type="file" ref={projectInputRef} className="hidden" accept=".socratic,.json" onChange={(e) => readFileInto(e, onImportProject)} />
    </div>
  );
}
