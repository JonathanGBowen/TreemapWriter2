import React from 'react';
import { Loader2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store';

/**
 * Global "AI is working" pill. Mounted once at the app shell, so an in-flight call
 * is visible from ANY view — not just the workspace that started it. Reads the
 * `activeOps` registry (which includes streaming + throttle-queued calls); when the
 * latest op names an origin workspace, the pill is a jump-back button that brings
 * that workspace forward (non-destructively). A throttle wait shows as "queued" so
 * a deliberate per-minute pause never reads as a hang.
 */
export const AiActivityIndicator: React.FC = () => {
  const { activeOps, throttleWaiting, focusWorkspace } = useStore(
    useShallow((s) => ({
      activeOps: s.activeOps,
      throttleWaiting: s.throttleWaiting,
      focusWorkspace: s.focusWorkspace,
    })),
  );

  if (activeOps.length === 0) return null;

  const latest = activeOps[activeOps.length - 1];
  const extra = activeOps.length - 1;
  const workspace = latest.workspace;
  const canJump = !!workspace;
  const label = throttleWaiting ? `${latest.label} · queued` : latest.label;

  return (
    <div className="fixed bottom-3 left-3 z-[90] pointer-events-auto animate-in fade-in duration-200">
      <button
        type="button"
        disabled={!canJump}
        onClick={() => workspace && focusWorkspace(workspace)}
        title={canJump ? 'Return to where this started' : undefined}
        aria-live="polite"
        className={`flex items-center gap-2 rounded-full border border-hld-border bg-hld-surface-2/95 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-hld-text shadow-lg backdrop-blur-sm ${
          canJump ? 'cursor-pointer hover:border-hld-cyan' : 'cursor-default'
        }`}
      >
        <Loader2 size={12} className="animate-spin text-hld-cyan" />
        <span className="normal-case tracking-normal">
          {label}
          {extra > 0 ? ` +${extra}` : ''}
        </span>
        {canJump && (
          <span aria-hidden className="text-hld-cyan">
            ↗
          </span>
        )}
      </button>
    </div>
  );
};
