import { useStore } from '../../state';
import { ProposalsColumn } from '../revision/ProposalsColumn';

/**
 * Concept A — the Revise tab. Hosts the shared Glass Box flow (config → proposals)
 * densely in the right panel, for quick in-flow passes without leaving the writing
 * view. Shares the revision slice with the full-screen Workspace (⟐), so a pass
 * started here shows there and vice-versa; inline preview renders in the center
 * editor (wired in EditorPanel).
 */
export function RevisePanel() {
  const openWorkspace = useStore((s) => s.openRevisionWorkspace);
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#080d13]">
      <div className="flex items-center justify-between px-[14px] py-[8px] border-b border-hld-border shrink-0">
        <span className="font-mono uppercase tracking-[0.14em] text-[9px] text-hld-muted-text">
          Glass Box · revise
        </span>
        <button
          type="button"
          onClick={openWorkspace}
          title="Open the full-screen Revision Workspace"
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-hld-muted-text hover:text-hld-cyan transition-colors"
        >
          <span className="text-[12px] leading-none">⟐</span> Workspace
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-[14px] py-[12px]">
        <ProposalsColumn />
      </div>
    </div>
  );
}
