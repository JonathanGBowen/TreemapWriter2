import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAmbientCue } from './use-ambient-cue';

/**
 * The quiet companion. Surfaces the next move without being asked — on re-entry
 * and on a mid-section stall. Dismiss is soft (a small ×), never a confirm, and
 * never a persisted off: the cue re-arms on the next section or the next stall.
 * HLD-quiet: it sits below the editor, low-contrast, and yields to the prose.
 */
export const AmbientCue: React.FC = () => {
  const cue = useAmbientCue();
  if (!cue.visible) return null;

  // Static class strings (no dynamic interpolation — Tailwind JIT must see them).
  const tone = cue.stalled
    ? { border: 'border-hld-yellow/30', dot: 'bg-hld-yellow', text: 'text-hld-yellow' }
    : { border: 'border-hld-cyan/30', dot: 'bg-hld-cyan', text: 'text-hld-cyan' };
  const lead = cue.stalled ? 'Still here?' : 'You were here';

  return (
    <div
      className={`pointer-events-auto absolute bottom-[14px] left-1/2 -translate-x-1/2 z-20 w-[min(720px,calc(100%-48px))] ${
        cue.reducedMotion ? '' : 'animate-in fade-in slide-in-from-bottom-2 duration-500'
      }`}
    >
      <div className={`flex items-start gap-[10px] bg-[#0a121b]/95 backdrop-blur-sm border ${tone.border} shadow-[0_0_22px_rgba(0,0,0,0.5)] px-[14px] py-[10px]`}>
        <div className={`mt-[2px] w-[6px] h-[6px] rotate-45 ${tone.dot} shadow-[0_0_8px_currentColor] shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className={`text-[9px] font-mono uppercase tracking-[0.16em] ${tone.text} mb-[3px]`}>
            {lead}
          </div>
          {cue.nextPriority ? (
            <div className="text-[12px] font-sans text-hld-text leading-[1.5]">
              <span className="text-hld-muted-text">Next — </span>
              {cue.nextPriority}
            </div>
          ) : cue.goal ? (
            <div className="text-[12px] font-sans text-hld-text leading-[1.5]">
              <span className="text-hld-muted-text">Goal — </span>
              {cue.goal}
            </div>
          ) : null}
          {cue.lastSentence && (
            <div className="text-[11px] font-sans italic text-hld-muted-text mt-[4px] truncate" title={cue.lastSentence}>
              …{cue.lastSentence}
            </div>
          )}
        </div>
        <button
          onClick={cue.goDeeper}
          className="shrink-0 flex items-center gap-[4px] text-hld-muted-text hover:text-hld-cyan text-[9px] font-mono uppercase tracking-[0.12em] transition-colors"
          title="Open the coach for a fuller plan"
        >
          <Sparkles size={11} /> Go deeper
        </button>
        <button
          onClick={cue.dismiss}
          className="shrink-0 text-hld-muted hover:text-hld-magenta transition-colors"
          title="Dismiss (returns on the next section or stall)"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
