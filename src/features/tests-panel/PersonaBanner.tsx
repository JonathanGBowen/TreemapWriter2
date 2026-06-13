import React, { useMemo } from "react";
import { useStore } from "../../state";
import { DEFAULT_PERSONAS } from "../../lib/defaultPersonas";

/**
 * The Evaluator/persona banner. A Spec-tab concern (the persona drives
 * diagnostics), extracted so the panel shell can also show it in the
 * no-section empty state — restoring its pre-tabs visibility — while keeping
 * it off the Analysis/Dialogue tabs, which don't use the persona.
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
      className="p-[9px_11px] bg-[#080d13] border border-hld-border flex items-center gap-[10px] cursor-pointer hover:border-hld-magenta transition-all group bracketed"
      style={{ "--br-color": "var(--tw-colors-hld-magenta)" } as React.CSSProperties}
    >
      <div className="w-[26px] h-[26px] flex items-center justify-center bg-hld-magenta/10 border border-hld-magenta/20 text-hld-magenta shrink-0 text-[12px] font-mono group-hover:shadow-[0_0_14px_rgba(255,16,96,0.25)] relative overflow-hidden">
        <div className="absolute inset-0 bg-hld-magenta/20" />
        <span className="relative z-10">⧉</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[6px] text-hld-muted uppercase font-mono tracking-[0.15em] mb-0.5">Evaluator</div>
        <div className="text-[10px] font-bold text-hld-text truncate transition-colors font-sans leading-none">
          {activePersona.name}
        </div>
      </div>
    </div>
  );
};
