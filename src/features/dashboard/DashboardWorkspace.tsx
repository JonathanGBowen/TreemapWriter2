import { useEffect } from 'react';
import { useStore } from '../../state';
import { DashboardReport } from './DashboardReport';

/**
 * The Progress Dashboard — a read-only full-screen workspace (like Compare,
 * Climate, Glass Box) that surfaces session history as accumulated evidence.
 * Self-gates on `dashboardOpen`; App mounts it unconditionally as an overlay.
 * `openDashboard` (re)loads the session log, so opening always shows fresh data.
 */
export function DashboardWorkspace() {
  const open = useStore((s) => s.dashboardOpen);
  const close = useStore((s) => s.closeDashboard);

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
      <div className="h-[54px] shrink-0 flex items-center gap-4 px-[18px] border-b border-hld-cyan/25 bg-gradient-to-b from-hld-cyan/5 to-transparent">
        <button
          type="button"
          onClick={close}
          className="px-2.5 py-1.5 border border-hld-cyan/30 text-hld-cyan hover:bg-hld-cyan/10 font-mono text-[10px] uppercase tracking-[0.12em] transition-all"
        >
          ‹ Done — back to writing
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-hld-cyan text-[14px]">▤</span>
          <span className="font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-hld-text">
            Progress
          </span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text">
          Accumulated evidence — not a score
        </span>
      </div>
      <div className="flex-1 flex min-h-0 bg-hld-surface-3">
        <DashboardReport />
      </div>
    </div>
  );
}
