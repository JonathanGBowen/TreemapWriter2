import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Play, Lightbulb } from "lucide-react";
import { useStore } from "../../state";
import { DEFAULT_PERSONAS } from "../../lib/defaultPersonas";

/** Pinned footer: persona chip (it modifies the run, so it lives with the run) +
 *  content-suggestions glyph + the lit RUN DIAGNOSTIC action. */
export function PanelFooter({ runDisabled }: { runDisabled: boolean }) {
  const activePersonaId = useStore((s) => s.activePersonaId);
  const customPersonas = useStore((s) => s.customPersonas);
  const isProcessing = useStore((s) => s.isProcessing);
  const setShowPersonaModal = useStore((s) => s.setShowPersonaModal);
  const setShowSuggestionsModal = useStore((s) => s.setShowSuggestionsModal);
  const setShowRunModal = useStore((s) => s.setShowRunModal);

  const persona = useMemo(
    () => [...DEFAULT_PERSONAS, ...customPersonas].find((p) => p.id === activePersonaId) ?? DEFAULT_PERSONAS[0],
    [activePersonaId, customPersonas],
  );

  return (
    <div className="px-[14px] py-[12px] border-t border-hld-border flex flex-col gap-[8px] shrink-0">
      <div className="flex items-center gap-[8px]">
        <button
          type="button"
          onClick={() => setShowPersonaModal(true)}
          title="Change evaluator persona"
          className="flex-1 flex items-center gap-[8px] px-[9px] py-[5px] border border-hld-border hover:border-hld-magenta/40 text-[9px] tracking-[0.08em] text-hld-text transition-colors"
        >
          <span className="text-hld-magenta text-[11px]">⧉</span>
          <span className="truncate">{persona.name}</span>
          <span className="ml-auto text-[7px] text-hld-muted-text">▾</span>
        </button>
        <button
          type="button"
          onClick={() => setShowSuggestionsModal(true)}
          disabled={isProcessing}
          title="Content suggestions"
          aria-label="Content suggestions"
          className="w-[30px] h-[27px] flex items-center justify-center border border-hld-yellow/25 text-hld-yellow hover:bg-hld-yellow/10 disabled:opacity-40 transition-colors shrink-0"
        >
          <Lightbulb size={12} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setShowRunModal(true)}
        disabled={runDisabled}
        style={{ '--br-color': 'var(--color-hld-magenta)' } as CSSProperties}
        className="bracketed hld-lit-magenta w-full py-[11px] flex items-center justify-center gap-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase disabled:opacity-35 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Evaluating…' : <><Play size={11} fill="currentColor" /> Run Diagnostic</>}
      </button>
    </div>
  );
}
