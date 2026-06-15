import React, { useMemo } from "react";
import { useStore } from "../../state";
import { DEFAULT_PERSONAS } from "../../lib/defaultPersonas";

/**
 * The Evaluator/persona banner. A Spec-tab concern (the persona drives
 * diagnostics), extracted so the panel shell can also show it in the
 * no-section empty state — restoring its pre-tabs visibility — while keeping
 * it off the Analysis/Dialogue tabs, which don't use the persona. Quiet at
 * rest (no brackets/glow); colour appears only on hover (P4).
 */
export const PersonaBanner: React.FC = () => {
  const activePersonaId = useStore((s) => s.activePersonaId);
  const customPersonas = useStore((s) => s.customPersonas);
  const setShowPersonaModal = useStore((s) => s.setShowPersonaModal);

  const activePersona = useMemo(() => {
    const all = [...DEFAULT_PERSONAS, ...customPersonas];
    return all.find((p) => p.id === activePersonaId) || DEFAULT_PERSONAS[0];
  }, [activePersonaId, customPersonas]);

  return (
    <div
      onClick={() => setShowPersonaModal(true)}
      className="px-[11px] py-[9px] bg-[#080d13] border border-hld-border flex items-center gap-[10px] cursor-pointer hover:border-hld-cyan/40 transition-colors group"
    >
      <div className="w-[26px] h-[26px] flex items-center justify-center border border-hld-border text-hld-muted-text-2 shrink-0 text-[12px] font-mono group-hover:text-hld-cyan group-hover:border-hld-cyan/40 transition-colors">
        ⧉
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-hld-muted-text-2 uppercase font-mono tracking-[0.12em] mb-0.5">Evaluator</div>
        <div className="text-[12px] font-semibold text-hld-text truncate font-sans leading-none">
          {activePersona.name}
        </div>
      </div>
    </div>
  );
};
