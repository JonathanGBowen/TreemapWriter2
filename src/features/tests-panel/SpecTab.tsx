import React, { useMemo, useState } from "react";
import {
  CheckCircle, AlertCircle, Play, Sparkles, X, ChevronRight,
  Lightbulb, ArrowRight, ArrowDown,
} from "lucide-react";
import { Section } from "../../types";
import { DEFAULT_PERSONAS } from "../../lib/defaultPersonas";
import { useStore } from "../../state";
import { useCurrentSection } from "./use-current-section";
import { SpecDiagnostics, STATUS_CONFIG } from "./SpecDiagnostics";
import { SpecDependencies } from "./SpecDependencies";

/**
 * The original Spec & Diagnostic surface, moved verbatim out of TestsPanel
 * when the panel became tabbed. Rendered only when a section is selected.
 */
export const SpecTab: React.FC = () => {
  const sections = useStore(s => s.sections);
  const testSuite = useStore(s => s.testSuite);
  const updateSectionGoals = useStore(s => s.updateSectionGoals);
  const updateDependencies = useStore(s => s.updateDependencies);
  const updateMainClaim = useStore(s => s.updateMainClaim);
  const updateSpec = useStore(s => s.updateSpec);
  const isProcessing = useStore(s => s.isProcessing);
  const activePersonaId = useStore(s => s.activePersonaId);
  const customPersonas = useStore(s => s.customPersonas);
  const setShowRunModal = useStore(s => s.setShowRunModal);
  const setShowPersonaModal = useStore(s => s.setShowPersonaModal);
  const setShowSpecModal = useStore(s => s.setShowSpecModal);
  const setShowSuggestionsModal = useStore(s => s.setShowSuggestionsModal);

  const currentSection = useCurrentSection();

  // Derive active persona
  const activePersona = useMemo(() => {
    const all = [...DEFAULT_PERSONAS, ...customPersonas];
    return all.find(p => p.id === activePersonaId) || DEFAULT_PERSONAS[0];
  }, [activePersonaId, customPersonas]);

  const [showContext, setShowContext] = useState(false);

  // Flatten sections for dropdown
  const flatSections = useMemo(() => {
    const flat: { id: string; title: string; level: number }[] = [];
    const traverse = (nodes: Section[]) => {
      nodes.forEach(n => {
        flat.push({ id: n.id, title: n.title, level: n.level });
        traverse(n.children);
      });
    };
    traverse(sections);
    return flat;
  }, [sections]);

  if (!currentSection) return null;

  const updateGoals = (text: string) => updateSectionGoals(currentSection.id, text, 'manual');
  const onRunTests = () => setShowRunModal(true);
  const onOpenSettings = () => setShowPersonaModal(true);
  const onOpenSpecRefinement = () => setShowSpecModal(true);
  const onOpenSuggestions = () => setShowSuggestionsModal(true);

  const entry = testSuite[currentSection.id];
  const spec = entry?.spec;
  const diagnostic = entry?.lastDiagnostic;
  const status = entry?.status || 'idle';
  const currentDependencies = entry?.dependencies || [];

  // Handle manual spec edits
  const handleMoveEdit = (moveIndex: number, newDescription: string) => {
    if (!spec) return;
    const newMoves = [...spec.requiredMoves];
    newMoves[moveIndex] = { ...newMoves[moveIndex], description: newDescription };
    updateSpec(currentSection.id, { ...spec, requiredMoves: newMoves });
  };

  const handleAddMove = () => {
    if (!spec) return;
    const newMove = { id: `move-${spec.requiredMoves.length}`, description: '' };
    updateSpec(currentSection.id, { ...spec, requiredMoves: [...spec.requiredMoves, newMove] });
  };

  const handleRemoveMove = (moveIndex: number) => {
    if (!spec) return;
    updateSpec(currentSection.id, { ...spec, requiredMoves: spec.requiredMoves.filter((_, i) => i !== moveIndex) });
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-[10px] bg-[#080d13]">

      {/* Persona Banner */}
      <div
        onClick={onOpenSettings}
        className="p-[9px_11px] bg-[#080d13] border border-hld-border flex items-center gap-[10px] cursor-pointer hover:border-hld-magenta transition-all group bracketed"
        style={{"--br-color": "var(--tw-colors-hld-magenta)"} as React.CSSProperties}
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

      {/* === STRUCTURED SPEC DISPLAY === */}
      {spec ? (
        <div className="space-y-[14px]">
          {/* Function + Claim header */}
          <div className="bg-[#080d13] border border-hld-border p-[8px]">
            <div className="flex items-center gap-[6px] mb-[6px] border-b border-hld-border/50 pb-[6px]">
              <div className="text-[7px] font-mono font-bold tracking-[0.14em] uppercase text-hld-magenta flex items-center gap-[4px] shrink-0">
                <div className="w-[4px] h-[4px] bg-hld-magenta rotate-45 shadow-[0_0_6px_var(--tw-colors-hld-magenta)]" />
                {spec.function}
              </div>
              <div className="w-[1px] h-[8px] bg-slate-300 border-[#1e2f42]" />
              <div className="text-[7px] font-mono tracking-[0.14em] text-hld-muted uppercase">The Core Claim</div>
            </div>

            <textarea
              className="w-full text-[10px] bg-transparent text-hld-text font-sans leading-[1.6] outline-none resize-none placeholder-hld-muted/50"
              placeholder="The core proposition — what makes this section necessary?"
              value={spec.mainClaim}
              style={{minHeight: "3.5em"}}
              onChange={(e) => {
                updateSpec(currentSection.id, { ...spec, mainClaim: e.target.value });
                updateMainClaim(currentSection.id, e.target.value);
              }}
            />
          </div>

          {/* Required Moves */}
          <div className="space-y-[14px]">
            {spec.requiredMoves.map((move, i) => {
              // Find matching diagnostic result if available
              const diagResult = diagnostic?.moveResults.find(mr => mr.moveId === move.id);

              return (
                <div key={move.id} className="bg-[#080d13] border border-hld-border p-[8px]">
                  <div className="flex justify-between items-center mb-[6px] border-b border-hld-border/50 pb-[6px]">
                     <div className="text-[7px] font-mono font-bold tracking-[0.14em] uppercase text-hld-cyan flex items-center gap-[4px]">
                       <div className="w-[4px] h-[4px] bg-hld-cyan shadow-[0_0_6px_var(--tw-colors-hld-cyan)]" />
                       Move {i + 1}
                     </div>
                     <button
                       onClick={onOpenSpecRefinement}
                       className="text-[6px] font-mono uppercase tracking-[0.15em] text-hld-cyan/70 hover:text-hld-cyan flex items-center gap-[4px] transition-colors"
                     >
                       <Sparkles size={8} /> refine
                     </button>
                  </div>

                  <div className="flex items-start gap-2">
                     {diagResult && (
                       // After evaluation: show status icon
                       <div className={`shrink-0 mt-1 ${STATUS_CONFIG[diagResult.status].color}`}>
                         {React.createElement(STATUS_CONFIG[diagResult.status].icon, { size: 12 })}
                       </div>
                     )}
                     <textarea
                       value={move.description}
                       onChange={(e) => handleMoveEdit(i, e.target.value)}
                       rows={1}
                       className="w-full text-[10px] bg-transparent text-hld-text font-sans leading-[1.6] outline-none resize-none placeholder-hld-muted/50"
                       style={{minHeight: "2.5em"}}
                       placeholder="Describe what this section must do..."
                     />
                     <button
                       onClick={() => handleRemoveMove(i)}
                       className="text-hld-muted/50 hover:text-hld-magenta transition-colors shrink-0 mt-0.5"
                     >
                       <X size={10} />
                     </button>
                  </div>
                </div>
              );
            })}
            <button
              onClick={handleAddMove}
              className="w-full p-[6px] bg-transparent border border-dashed border-hld-border text-[7px] font-mono uppercase tracking-[0.14em] text-hld-muted hover:text-hld-cyan hover:border-hld-cyan transition-all"
            >
              + Add move
            </button>
          </div>

          {/* Incoming/Outgoing Context (collapsible) */}
          {(spec.incomingContext.length > 0 || spec.outgoingCommitments.length > 0) && (
            <div className="border-t border-hld-border pt-3">
              <button
                onClick={() => setShowContext(!showContext)}
                className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted flex items-center gap-1 hover:text-hld-cyan transition-colors"
              >
                <ChevronRight size={12} className={`transition-transform ${showContext ? 'rotate-90' : ''}`} />
                Context & Commitments
              </button>
              {showContext && (
                <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 p-[8px]">
                  {spec.incomingContext.length > 0 && (
                    <div>
                      <div className="text-[7px] font-mono uppercase tracking-[0.15em] font-bold text-hld-muted mb-1 flex items-center gap-1">
                        <ArrowDown size={10} /> Receives from prior sections
                      </div>
                      <div className="space-y-1">
                        {spec.incomingContext.map((ctx, i) => (
                          <div key={i} className="text-[10px] text-hld-muted bg-transparent border border-hld-border px-2 py-1 font-sans">
                            {ctx}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {spec.outgoingCommitments.length > 0 && (
                    <div>
                      <div className="text-[7px] font-mono uppercase tracking-[0.15em] font-bold text-hld-muted mb-1 flex items-center gap-1">
                        <ArrowRight size={10} /> Must establish for later
                      </div>
                      <div className="space-y-1">
                        {spec.outgoingCommitments.map((com, i) => (
                          <div key={i} className="text-[10px] text-hld-muted bg-transparent border border-hld-border px-2 py-1 font-sans">
                            {com}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* No spec yet — show legacy goals or prompt to generate */
        <div className="space-y-2 mt-[12px]">
          <label className="text-[7px] font-mono font-bold uppercase tracking-[0.15em] text-hld-muted">
            Goals (run Interpolate Tasks to generate structured specs)
          </label>
          <textarea
            className="w-full p-[10px] text-[10px] border border-hld-border bg-[#080d13] text-hld-text min-h-[6rem] focus:ring-1 focus:ring-hld-cyan/50 focus:border-hld-cyan outline-none resize-none font-sans leading-[1.6]"
            placeholder="Define what this section should accomplish..."
            value={entry?.goals || ''}
            onChange={(e) => updateGoals(e.target.value)}
          />
        </div>
      )}

      <SpecDependencies
        sectionId={currentSection.id}
        dependencies={currentDependencies}
        flatSections={flatSections}
        testSuite={testSuite}
        onUpdate={(deps) => updateDependencies(currentSection.id, deps)}
      />

      {/* Action Buttons */}
      <div className="space-y-[6px] mt-4">
        <button
          onClick={onRunTests}
          disabled={isProcessing || (!spec && !entry?.goals)}
          className="w-full p-[11px] bg-transparent border border-[rgba(255,16,96,0.3)] text-hld-magenta font-mono uppercase tracking-[0.14em] text-[8px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[rgba(255,16,96,0.06)] hover:shadow-[0_0_20px_rgba(255,16,96,0.3)] bracketed"
          style={{"--br-color": "var(--tw-colors-hld-magenta)"} as React.CSSProperties}
        >
          {isProcessing ? <>Evaluating...</> : <><Play size={10} fill="currentColor" /> Run Diagnostic</>}
        </button>
        <button
          onClick={onOpenSuggestions}
          disabled={isProcessing}
          className="w-full p-[9px] bg-transparent border border-hld-border text-hld-muted font-mono uppercase tracking-[0.14em] text-[7px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-hld-surface2 hover:text-hld-text bracketed"
          style={{"--br-color": "var(--tw-colors-hld-muted)"} as React.CSSProperties}
        >
          <Lightbulb size={10} className="text-hld-yellow" /> Content Suggestions
        </button>
      </div>

      {/* === DIAGNOSTIC RESULTS === */}
      {diagnostic && <SpecDiagnostics diagnostic={diagnostic} />}

      {/* Legacy Results (backward compat) */}
      {!diagnostic && entry?.lastResult && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`p-[10px] border ${
            status === 'success'
              ? 'bg-[rgba(0,232,112,0.05)] border-hld-green'
              : 'bg-[#1a050f] border-hld-magenta'
          }`}>
            <div className="flex items-start gap-3 mb-2">
              {status === 'success' ? (
                <CheckCircle className="text-hld-green shrink-0 mt-1" size={16} />
              ) : (
                <AlertCircle className="text-hld-magenta shrink-0 mt-1" size={16} />
              )}
              <div>
                <h4 className="font-bold font-mono uppercase tracking-[0.14em] text-[10px] mt-1 relative top-[-1px]">
                  {status === 'success' ? 'Pass' : 'Needs Revision'}
                </h4>
                <p className="text-[10px] mt-1 text-hld-text font-sans leading-[1.6]">
                  {entry.lastResult?.critique}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
