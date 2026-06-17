import { useEffect } from 'react';
import { useStore } from '../../state';
import { CompareTopBar } from './CompareTopBar';
import { CompareDiff } from './CompareDiff';
import { CompareReport } from './CompareReport';

/**
 * The Version Compare workspace. A full-screen mode (like the Revision
 * Workspace) for evaluating two saved versions: A/B picker top bar · textual
 * diff (center) · AI evaluation report (right). Self-gates on `comparisonOpen`,
 * so App mounts it unconditionally as an overlay over the three-column view.
 */
export function CompareWorkspace() {
  const open = useStore((s) => s.comparisonOpen);
  const close = useStore((s) => s.closeCompare);

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
      <CompareTopBar />
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col border-r border-hld-border bg-hld-bg">
          <CompareDiff />
        </div>
        <div className="w-[440px] shrink-0 bg-[#080d13] flex flex-col">
          <CompareReport />
        </div>
      </div>
    </div>
  );
}
