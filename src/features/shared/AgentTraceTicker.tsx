import React from 'react';
import { useStore } from '../../store';
import type { TraceRun } from '../../state/trace-state';

/**
 * A small, muted one-liner showing the live thinking/activity of the most recent
 * in-flight Agent SDK run whose call kind matches `kinds` (so each surface shows
 * only its own run, even if others overlap). Renders nothing when no matching run
 * is active — so it's invisible unless Agent mode is actually working here.
 *
 * Drop it beside a surface's existing "analyzing…" marker, scoped to the kinds
 * that surface triggers, e.g. <AgentTraceTicker kinds={['analyzeSection','runDiagnostic']} />.
 */
export const AgentTraceTicker: React.FC<{ kinds?: string[]; className?: string }> = ({
  kinds,
  className,
}) => {
  // traceRuns is newest-first, so the first running match is the most recent.
  const run = useStore((s) =>
    s.traceRuns.find(
      (r) => r.status === 'running' && (!kinds || (r.callKind != null && kinds.includes(r.callKind))),
    ),
  );
  if (!run) return null;
  return (
    <div
      className={
        className ?? 'flex items-center gap-1.5 text-[10px] font-mono text-hld-muted min-w-0'
      }
      aria-live="polite"
      title={run.label}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-hld-cyan animate-pulse shrink-0" />
      <span className="truncate">{latestLine(run)}</span>
    </div>
  );
};

/** The tail of the run's latest event — the line it's currently producing. */
function latestLine(run: TraceRun): string {
  const ev = run.events[run.events.length - 1];
  if (!ev) return 'thinking…';
  const text = ev.text.trim();
  const nl = text.lastIndexOf('\n');
  const line = (nl >= 0 ? text.slice(nl + 1) : text).trim();
  return (line || 'thinking…').slice(-160);
}
