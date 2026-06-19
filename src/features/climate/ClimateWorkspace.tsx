import { useEffect } from 'react';
import { useStore } from '../../state';
import { ClimateTopBar } from './ClimateTopBar';
import { ClimateReport } from './ClimateReport';

/**
 * The Climate Artist workspace. A full-screen mode (like the Version Compare and
 * Glass Box workspaces) for reading the atmospheric construction of a draft:
 * instrument + target picker top bar · prose "weather report" below. Self-gates
 * on `climateOpen`, so App mounts it unconditionally as an overlay over the
 * three-column view.
 */
export function ClimateWorkspace() {
  const open = useStore((s) => s.climateOpen);
  const close = useStore((s) => s.closeClimate);

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
      <ClimateTopBar />
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col bg-[#080d13]">
          <ClimateReport />
        </div>
      </div>
    </div>
  );
}
