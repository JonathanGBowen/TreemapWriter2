import { useEffect } from 'react';
import { useStore } from '../../state';
import { SegmentTopBar } from './SegmentTopBar';
import { SegmentRail } from './SegmentRail';
import { SegmentPanel } from './SegmentPanel';

/**
 * The Articulation workspace — a full-screen mode (like the Generate-Specs, Glass
 * Box, and Climate workspaces) for dividing a text into its natural parts top-down,
 * one level at a time, human-in-the-loop: a hierarchy rail · the current level's
 * proposed heading edits · accept/reject. Self-gates on `segmentOpen`, so App mounts
 * it unconditionally as an overlay over the three-column view.
 */
export function SegmentWorkspace() {
  const open = useStore((s) => s.segmentOpen);
  const close = useStore((s) => s.closeSegment);

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
      <SegmentTopBar />
      <div className="flex-1 flex min-h-0">
        <SegmentRail />
        <SegmentPanel />
      </div>
    </div>
  );
}
