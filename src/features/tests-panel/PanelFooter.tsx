import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Play } from "lucide-react";
import { useStore } from "../../state";
import { DEFAULT_PERSONAS } from "../../lib/defaultPersonas";
import { AgentTraceTicker } from "../shared/AgentTraceTicker";
import { DisabledHint } from "../shared/DisabledHint";

/** Pinned footer: the single lit RUN DIAGNOSTIC action (P1), with a quiet caption
 *  below naming the evaluator persona and the content-suggestions escape — both
 *  still open their modals but carry no colour or weight of their own (P4). */
export function PanelFooter({ runDisabled }: { runDisabled: boolean }) {
  const activePersonaId = useStore((s) => s.activePersonaId);
  const customPersonas = useStore((s) => s.customPersonas);
  const isProcessing = useStore((s) => s.isProcessing);
  const setShowPersonaModal = useStore((s) => s.setShowPersonaModal);
  const setShowRunModal = useStore((s) => s.setShowRunModal);

  const persona = useMemo(
    () => [...DEFAULT_PERSONAS, ...customPersonas].find((p) => p.id === activePersonaId) ?? DEFAULT_PERSONAS[0],
    [activePersonaId, customPersonas],
  );

  return (
    <div className="px-[16px] py-[16px] border-t border-hld-border shrink-0">
      <DisabledHint
        when={runDisabled}
        hint="Generate a spec (or add goals) for this section before running a diagnostic."
        className="block w-full"
      >
        <button
          type="button"
          onClick={() => setShowRunModal(true)}
          disabled={runDisabled}
          style={{ '--br-color': 'var(--color-hld-magenta)' } as CSSProperties}
          className="bracketed hld-lit-magenta w-full py-[14px] flex items-center justify-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] uppercase disabled:opacity-35 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Evaluating…' : <><Play size={11} fill="currentColor" /> Run Diagnostic</>}
        </button>
      </DisabledHint>
      <AgentTraceTicker
        kinds={['analyzeSection', 'runDiagnostic', 'refactorAnalysis']}
        className="mt-[8px] flex items-center gap-1.5 text-[10px] font-mono text-hld-muted min-w-0"
      />
      <div className="mt-[11px] flex items-center gap-[6px] text-[11px] text-hld-muted-text-2">
        <span className="shrink-0">Evaluated as</span>
        <button
          type="button"
          onClick={() => setShowPersonaModal(true)}
          title="Change evaluator persona"
          className="truncate border-b border-hld-border hover:text-hld-cyan hover:border-hld-cyan/40 transition-colors"
        >
          {persona.name}
        </button>
      </div>
    </div>
  );
}
