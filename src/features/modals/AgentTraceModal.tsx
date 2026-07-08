import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { ModalShell } from './ModalShell';
import type { TraceRun } from '../../state/trace-state';

/**
 * Optional audit viewer for saved Agent SDK runs — the thinking/activity trace
 * each call produced. Opened from the Experimental — Claude Agent SDK settings
 * (not front-and-center). Self-mounts on `showAgentTraceModal`.
 */
export const AgentTraceModal: React.FC = () => {
  const open = useStore((s) => s.showAgentTraceModal);
  const setOpen = useStore((s) => s.setShowAgentTraceModal);
  const runs = useStore((s) => s.traceRuns);
  const clearTraces = useStore((s) => s.clearTraces);

  if (!open) return null;

  return (
    <ModalShell
      accent="magenta"
      eyebrow="Experimental · Claude Agent SDK"
      title="Activity traces"
      sub={`${runs.length} run${runs.length === 1 ? '' : 's'} · most recent first`}
      onClose={() => setOpen(false)}
      widthClass="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={clearTraces}
            disabled={runs.length === 0}
            className="flex items-center gap-1.5 bg-transparent border border-hld-border px-3 py-2 text-hld-muted hover:text-hld-yellow hover:border-hld-yellow/40 font-mono text-[9px] tracking-[0.12em] uppercase transition-colors disabled:opacity-40"
          >
            <Trash2 size={12} /> Clear all
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto bg-transparent border-none text-hld-muted-text hover:text-hld-text font-mono text-[9px] tracking-[0.12em] uppercase cursor-pointer transition-colors"
          >
            Close
          </button>
        </>
      }
    >
      {runs.length === 0 ? (
        <p className="text-[12px] text-hld-muted font-sans">
          No agent runs recorded yet. With Agent mode on, run an AI action and its
          thinking/activity trace will appear here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </ModalShell>
  );
};

const STATUS_GLYPH: Record<TraceRun['status'], { g: string; cls: string }> = {
  running: { g: '◌', cls: 'text-hld-cyan animate-pulse' },
  success: { g: '✓', cls: 'text-hld-green' },
  error: { g: '✕', cls: 'text-hld-yellow' },
};

const RunRow: React.FC<{ run: TraceRun }> = ({ run }) => {
  const [open, setOpen] = useState(false);
  const status = STATUS_GLYPH[run.status];
  const when = new Date(run.startedAt).toLocaleTimeString();
  const dur =
    run.finishedAt != null ? `${((run.finishedAt - run.startedAt) / 1000).toFixed(1)}s` : '…';

  return (
    <div className="border border-hld-border rounded bg-hld-bg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
      >
        {open ? <ChevronDown size={13} className="shrink-0 text-hld-muted" /> : <ChevronRight size={13} className="shrink-0 text-hld-muted" />}
        <span className={`font-mono text-[12px] shrink-0 ${status.cls}`}>{status.g}</span>
        <span className="font-mono text-[11px] text-hld-text truncate flex-1">{run.label}</span>
        <span className="font-mono text-[10px] text-hld-muted shrink-0">{run.model}</span>
        <span className="font-mono text-[10px] text-hld-muted shrink-0">{when} · {dur}</span>
      </button>
      {open && (
        <div className="border-t border-hld-border px-3 py-2 space-y-2 max-h-72 overflow-y-auto">
          {run.errorMessage && (
            <p className="text-[11px] font-mono text-hld-yellow">{run.errorMessage}</p>
          )}
          {run.events.length === 0 && !run.errorMessage && (
            <p className="text-[11px] font-mono text-hld-muted">(no trace captured)</p>
          )}
          {run.events.map((ev, i) => (
            <div key={i}>
              <div className="text-[8px] font-mono uppercase tracking-widest text-hld-muted mb-0.5">
                {ev.t === 'think' ? 'thinking' : ev.t}
              </div>
              <pre
                className={`whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed ${
                  ev.t === 'text' ? 'text-hld-text' : 'text-hld-muted'
                }`}
              >
                {ev.text}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
