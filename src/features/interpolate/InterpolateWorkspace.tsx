import { useEffect } from 'react';
import { useStore } from '../../state';
import { InterpolateTopBar } from './InterpolateTopBar';
import { InterpolateRail } from './InterpolateRail';
import { StagePanel } from './StagePanel';

/**
 * The Generate-Specs workspace. A full-screen mode (like the Version Compare, Glass
 * Box, and Climate workspaces) for deriving the document's spec hierarchy top-down,
 * one level at a time, human-in-the-loop: a hierarchy rail · the current stage's
 * collaborative chat (Agent SDK) or steer-note path · its editable proposal. Self-gates
 * on `interpolateOpen`, so App mounts it unconditionally as an overlay over the
 * three-column view.
 */
export function InterpolateWorkspace() {
  const open = useStore((s) => s.interpolateOpen);
  const close = useStore((s) => s.closeInterpolate);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-hld-bg text-hld-text overflow-hidden font-sans">
      <InterpolateTopBar />
      <div className="flex-1 flex min-h-0">
        <InterpolateRail />
        <StagePanel />
      </div>
    </div>
  );
}
