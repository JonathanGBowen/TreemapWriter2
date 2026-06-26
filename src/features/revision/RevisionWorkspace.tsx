import { useStore } from '../../state';
import { useColumnResize } from '../shared/useColumnResize';
import { ResizeHandle } from '../shared/ResizeHandle';
import { RevisionTopBar } from './RevisionTopBar';
import { RevisionRail } from './RevisionRail';
import { MasterDocument } from './MasterDocument';
import { ProposalsColumn } from './ProposalsColumn';

/**
 * Concept B — the Revision Workspace. A distinct, full-screen mode (like Focus
 * Mode, but for revising) summoned by the ⟐ glyph: slim section rail · master
 * document · proposals column. Self-gates on `revisionWorkspaceOpen`, so App
 * mounts it unconditionally as an overlay over the normal three-column view.
 */
export function RevisionWorkspace() {
  const open = useStore((s) => s.revisionWorkspaceOpen);
  const proposalsWidth = useStore((s) => s.revisionProposalsWidth);
  const setProposalsWidth = useStore((s) => s.setRevisionProposalsWidth);
  const onResizeProposals = useColumnResize({
    width: proposalsWidth,
    setWidth: setProposalsWidth,
    edge: 'left',
    min: 320,
    max: 720,
  });
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-hld-bg text-hld-text overflow-hidden font-sans">
      <RevisionTopBar />
      <div className="flex-1 flex min-h-0">
        <RevisionRail />
        <MasterDocument />
        <div
          style={{ width: proposalsWidth }}
          className="relative shrink-0 border-l border-hld-border bg-hld-surface-3 flex flex-col"
        >
          <ResizeHandle side="left" onMouseDown={onResizeProposals} />
          <div className="relative px-4 py-3 border-b border-hld-border">
            <div className="absolute top-0 left-0 right-0 h-px bg-hld-magenta shadow-[0_0_12px_var(--color-hld-magenta)]" />
            <div className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
              Proposals
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ProposalsColumn large />
          </div>
        </div>
      </div>
    </div>
  );
}
