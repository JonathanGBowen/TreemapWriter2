import { useState } from "react";
import type { CSSProperties } from "react";
import { Sparkles } from "lucide-react";

/** No-spec state: one lit GENERATE SPEC, plus a quiet "write it manually" escape
 *  that reveals the legacy goals textarea inline. */
export function EmptyState({
  goals, onGoalsChange, onGenerate,
}: {
  goals: string;
  onGoalsChange: (text: string) => void;
  onGenerate: () => void;
}) {
  const [manual, setManual] = useState(!!goals);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-[16px] p-[24px] text-center">
      <span className="w-[22px] h-[22px] rotate-45 border border-hld-muted" />
      <div className="text-[10px] leading-relaxed font-sans text-hld-muted-text max-w-[230px]">
        No spec yet. Generate one from the document — what this section must claim, and the moves that earn it.
      </div>
      <button
        type="button"
        onClick={onGenerate}
        style={{ '--br-color': 'var(--color-hld-cyan)' } as CSSProperties}
        className="bracketed hld-lit px-[22px] py-[11px] flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase"
      >
        <Sparkles size={11} /> Generate spec
      </button>
      {!manual ? (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text hover:text-hld-cyan border-b border-hld-border pb-[2px] transition-colors"
        >
          write it manually
        </button>
      ) : (
        <textarea
          value={goals}
          onChange={(e) => onGoalsChange(e.target.value)}
          autoFocus
          placeholder="Define what this section should accomplish…"
          className="w-full mt-[4px] p-[10px] text-[10px] border border-hld-border bg-[#080d13] text-hld-text min-h-[6rem] focus:border-hld-cyan outline-none resize-none font-sans leading-relaxed text-left"
        />
      )}
    </div>
  );
}
