import React, { useMemo, useState } from "react";
import {
  CheckCircle, AlertCircle, Settings, Play, Layout, Bot, Sparkles,
  History, X, ChevronDown, ChevronRight, Link as LinkIcon,
  MessageSquareQuote, Lightbulb, Target, ArrowRight, ArrowDown,
  Zap, Circle, AlertTriangle, HelpCircle, Crosshair
} from "lucide-react";
import {
  Section, SectionFunction, MoveResult, MoveStatus, ReadinessLevel
} from "../../types";
import { SECTION_FUNCTIONS } from "../../lib/constants";
import { DEFAULT_PERSONAS } from "../../lib/defaultPersonas";
import { useStore } from "../../store";

const findSectionById = (nodes: Section[], id: string): Section | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findSectionById(node.children, id);
    if (found) return found;
  }
  return null;
};

// --- Status UI Helpers ---

const STATUS_CONFIG: Record<MoveStatus, { icon: any; color: string; bg: string; label: string }> = {
  present: { 
    icon: CheckCircle, 
    color: 'text-hld-green', 
    bg: 'bg-hld-green/10 border-hld-green/30',
    label: 'Done' 
  },
  partial: { 
    icon: AlertTriangle, 
    color: 'text-hld-yellow', 
    bg: 'bg-hld-yellow/10 border-hld-yellow/30',
    label: 'Partial' 
  },
  missing: { 
    icon: Circle, 
    color: 'text-hld-magenta', 
    bg: 'bg-hld-magenta/10 border-hld-magenta/30',
    label: 'Missing' 
  },
  unclear: { 
    icon: HelpCircle, 
    color: 'text-hld-purple', 
    bg: 'bg-hld-purple/10 border-hld-purple/30',
    label: 'Unclear' 
  },
};

const READINESS_CONFIG: Record<ReadinessLevel, { color: string; bg: string; label: string }> = {
  'draft': { color: 'text-hld-magenta', bg: 'bg-[#1a050f] border-hld-magenta', label: 'Draft' },
  'developing': { color: 'text-hld-yellow', bg: 'bg-[rgba(255,230,0,0.05)] border-hld-yellow', label: 'Developing' },
  'nearly-there': { color: 'text-hld-cyan', bg: 'bg-[rgba(0,232,245,0.05)] border-hld-cyan', label: 'Nearly There' },
  'solid': { color: 'text-hld-green', bg: 'bg-[rgba(0,232,112,0.05)] border-hld-green', label: 'Solid' },
};

const FunctionBadge: React.FC<{ fn: SectionFunction }> = ({ fn }) => {
  const info = SECTION_FUNCTIONS.find(f => f.id === fn);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-widest bg-hld-cyan/15 text-hld-cyan border border-hld-cyan/30" title={info?.desc}>
      <Target size={10} />
      {info?.label || fn}
    </span>
  );
};

const MoveResultCard: React.FC<{ result: MoveResult; index: number }> = ({ result, index }) => {
  const [expanded, setExpanded] = useState(result.status !== 'present');
  const config = STATUS_CONFIG[result.status];
  const Icon = config.icon;

  return (
    <div className="border bg-hld-surface2 border-hld-border p-[8px]">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer mb-[4px] border-b border-transparent hover:border-hld-border transition-colors pb-1"
      >
        <span className={`text-[9px] font-mono font-bold tracking-[0.14em] uppercase flex items-center gap-[4px] ${config.color}`}>
          <div className="w-[4px] h-[4px] bg-current rotate-45 shadow-[0_0_6px_currentColor]"></div>
          {config.label}
        </span>
        <span className="text-[7px] font-mono tracking-[0.14em] text-hld-muted uppercase">MOVE {index + 1}</span>
      </div>
      
      <div className="text-[10px] text-hld-text font-sans leading-[1.6]">
        {result.moveDescription}
      </div>

      {expanded && result.status !== 'present' && (
        <div className="mt-[6px] pt-[6px] border-t border-hld-border/50 animate-in fade-in duration-200 space-y-[6px]">
          {result.location && (
            <div className={`text-[10px] font-sans leading-[1.6] opacity-80 ${config.color}`}>
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] mr-1">Where:</span>
              {result.location}
            </div>
          )}
          {result.diagnosis && (
            <div className={`text-[10px] font-sans leading-[1.6] opacity-80 ${config.color}`}>
               {result.diagnosis}
            </div>
          )}
          {result.suggestedAction && (
            <div className="mt-[8px] bg-[#121c2e] p-[8px] border border-hld-cyan/20">
              <span className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-cyan block mb-[2px]">ACTION</span>
              <div className="text-[10px] font-sans leading-[1.6] text-hld-cyan/90">
                 {result.suggestedAction}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const TestsPanel: React.FC = () => {
  // Subscribe to all needed state from the store
  const sections = useStore(s => s.sections);
  const selectedId = useStore(s => s.selectedId);
  const testSuite = useStore(s => s.testSuite);
  const updateSectionGoals = useStore(s => s.updateSectionGoals);
  const updateDependencies = useStore(s => s.updateDependencies);
  const updateMainClaim = useStore(s => s.updateMainClaim);
  const updateSpec = useStore(s => s.updateSpec);
  const isProcessing = useStore(s => s.isProcessing);
  const width = useStore(s => s.testsPanelWidth);
  const setWidth = useStore(s => s.setTestsPanelWidth);
  const activePersonaId = useStore(s => s.activePersonaId);
  const customPersonas = useStore(s => s.customPersonas);
  const setShowRunModal = useStore(s => s.setShowRunModal);
  const setShowPersonaModal = useStore(s => s.setShowPersonaModal);
  const setShowSpecModal = useStore(s => s.setShowSpecModal);
  const setShowSuggestionsModal = useStore(s => s.setShowSuggestionsModal);

  // Derive currentSection from selectedId + sections
  const currentSection = useMemo(
    () => (selectedId ? findSectionById(sections, selectedId) : null),
    [selectedId, sections],
  );

  // Derive active persona
  const activePersona = useMemo(() => {
    const all = [...DEFAULT_PERSONAS, ...customPersonas];
    return all.find(p => p.id === activePersonaId) || DEFAULT_PERSONAS[0];
  }, [activePersonaId, customPersonas]);

  // Local aliases that match the original prop names used in the JSX body
  const allSections = sections;
  const updateGoals = (text: string) => {
    if (!currentSection) return;
    updateSectionGoals(currentSection.id, text, 'manual');
  };
  const onRunTests = () => setShowRunModal(true);
  const onOpenSettings = () => setShowPersonaModal(true);
  const onOpenSpecRefinement = () => setShowSpecModal(true);
  const onOpenSuggestions = () => setShowSuggestionsModal(true);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = startWidth + delta;
      setWidth(Math.max(280, Math.min(newWidth, 800)));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const entry = currentSection ? testSuite[currentSection.id] : undefined;
  const spec = entry?.spec;
  const diagnostic = entry?.lastDiagnostic;
  const status = entry?.status || 'idle';
  const hasHistory = entry?.history && entry.history.length > 0;

  const currentDependencies = currentSection ? (entry?.dependencies || []) : [];
  const [dependencyType, setDependencyType] = useState<'prerequisite' | 'reference'>('prerequisite');
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
    traverse(allSections);
    return flat;
  }, [allSections]);

  const handleAddDependency = (depId: string) => {
    if (!currentSection) return;
    const newDeps = [...currentDependencies, { id: depId, type: dependencyType }];
    updateDependencies(currentSection.id, newDeps);
  };

  const handleRemoveDependency = (depId: string) => {
    if (!currentSection) return;
    const newDeps = currentDependencies.filter(d => d.id !== depId);
    updateDependencies(currentSection.id, newDeps);
  };

  // Handle manual spec edits
  const handleFunctionChange = (fn: SectionFunction) => {
    if (!currentSection || !spec) return;
    updateSpec(currentSection.id, { ...spec, function: fn });
  };

  const handleMoveEdit = (moveIndex: number, newDescription: string) => {
    if (!currentSection || !spec) return;
    const newMoves = [...spec.requiredMoves];
    newMoves[moveIndex] = { ...newMoves[moveIndex], description: newDescription };
    updateSpec(currentSection.id, { ...spec, requiredMoves: newMoves });
  };

  const handleAddMove = () => {
    if (!currentSection || !spec) return;
    const newMove = { id: `move-${spec.requiredMoves.length}`, description: '' };
    updateSpec(currentSection.id, { ...spec, requiredMoves: [...spec.requiredMoves, newMove] });
  };

  const handleRemoveMove = (moveIndex: number) => {
    if (!currentSection || !spec) return;
    const newMoves = spec.requiredMoves.filter((_, i) => i !== moveIndex);
    updateSpec(currentSection.id, { ...spec, requiredMoves: newMoves });
  };

  return (
    <div
      style={{ width }}
      className="tests-panel-step h-full flex-none relative border-l border-hld-border bg-[#080d13] flex flex-col shadow-sm z-10 transition-colors duration-200"
    >
      {/* Resize Handle */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-hld-cyan/50 hover:w-2 transition-all duration-150 z-50 -translate-x-1/2"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="p-[10px_14px] border-b border-hld-border bg-[#080d13] flex justify-between items-center relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-hld-magenta shadow-[0_0_12px_var(--tw-colors-hld-magenta)]" />
        <h2 className="font-mono uppercase tracking-[0.15em] text-[8px] font-bold text-hld-text flex items-center gap-2">
          <CheckCircle size={13} className="text-hld-cyan" />
          <span>Spec <span className="text-hld-cyan">&</span> Diagnostic</span>
        </h2>
        <button
          onClick={onOpenSettings}
          className="w-[26px] h-[26px] flex items-center justify-center border border-hld-border text-hld-muted hover:text-hld-cyan hover:bg-hld-cyan/10 hover:border-hld-cyan transition-all shrink-0"
          title="Configure Persona"
        >
          <Settings size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-[10px] bg-[#080d13]">

        {/* Persona Banner */}
        <div
          onClick={onOpenSettings}
          className="p-[9px_11px] bg-[#080d13] border border-hld-border flex items-center gap-[10px] cursor-pointer hover:border-hld-magenta transition-all group bracketed"
          style={{"--br-color": "var(--tw-colors-hld-magenta)"} as any}
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

        {currentSection ? (
          <>
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

            {/* Dependencies */}
            <div className="space-y-2 pt-3 border-t border-[#1e2f42]">
              <label className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-hld-muted flex items-center gap-2">
                <LinkIcon size={12} /> Dependencies
              </label>
              <div className="space-y-1">
                {currentDependencies.map(dep => {
                  const depSection = flatSections.find(s => s.id === dep.id);
                  const depStatus = testSuite[dep.id]?.status || 'idle';
                  const isMet = depStatus === 'success';
                  return (
                    <div key={dep.id} className={`flex items-center justify-between p-[6px] border transition-colors ${
                      isMet
                        ? 'bg-[rgba(0,245,150,0.05)] border-[rgba(0,245,150,0.2)]'
                        : 'bg-hld-surface2 border-hld-border'
                    }`}>
                      <div className="flex items-center gap-[6px] min-w-0 flex-1">
                        <div className={`w-[4px] h-[4px] shrink-0 rotate-45 ${isMet ? 'bg-hld-green shadow-[0_0_6px_var(--tw-colors-hld-green)]' : 'bg-hld-muted'}`} />
                        <div className="flex flex-col min-w-0 gap-[1px]">
                          <span className={`truncate text-[10px] font-sans font-bold ${isMet ? 'text-hld-green' : 'text-hld-text'}`}>
                            {depSection ? depSection.title : 'Unknown'}
                          </span>
                          <span className="text-[7px] text-hld-muted uppercase tracking-[0.14em] font-mono">
                            {dep.type}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveDependency(dep.id)} className="text-hld-muted hover:text-hld-magenta transition-colors ml-2">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
                {currentDependencies.length === 0 && (
                  <div className="text-[10px] text-hld-muted italic px-[6px] py-1 font-sans">No dependencies.</div>
                )}
              </div>
              <div className="flex gap-2 items-center mt-2">
                <select
                  className="w-1/3 pl-2 pr-6 py-1.5 text-[8px] font-mono uppercase tracking-[0.14em] bg-hld-surface2 border border-hld-border rounded-none text-hld-text outline-none focus:border-hld-cyan appearance-none cursor-pointer"
                  value={dependencyType}
                  onChange={(e) => setDependencyType(e.target.value as any)}
                >
                  <option value="prerequisite">Prerequisite</option>
                  <option value="reference">Reference</option>
                </select>
                <div className="relative flex-1">
                  <select
                    className="w-full pl-2 pr-8 py-1.5 text-[8px] font-mono uppercase tracking-[0.14em] bg-hld-surface2 border border-hld-border rounded-none text-hld-text outline-none focus:border-hld-cyan appearance-none cursor-pointer"
                    onChange={(e) => { if (e.target.value) { handleAddDependency(e.target.value); e.target.value = ""; } }}
                    value=""
                  >
                    <option value="" disabled>+ Add...</option>
                    {flatSections
                      .filter(s => s.id !== currentSection.id && !currentDependencies.some(d => d.id === s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {'\u00A0'.repeat((s.level - 1) * 2)} {s.title}
                        </option>
                      ))}
                  </select>
                  <div className="absolute right-[6px] top-1/2 -translate-y-1/2 pointer-events-none text-hld-muted">
                    <ChevronDown size={10} />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-[6px] mt-4">
              <button
                onClick={onRunTests}
                disabled={isProcessing || (!spec && !entry?.goals)}
                className="w-full p-[11px] bg-transparent border border-[rgba(255,16,96,0.3)] text-hld-magenta font-mono uppercase tracking-[0.14em] text-[8px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[rgba(255,16,96,0.06)] hover:shadow-[0_0_20px_rgba(255,16,96,0.3)] bracketed"
                style={{"--br-color": "var(--tw-colors-hld-magenta)"} as any}
              >
                {isProcessing ? <>Evaluating...</> : <><Play size={10} fill="currentColor" /> Run Diagnostic</>}
              </button>
              <button
                onClick={onOpenSuggestions}
                disabled={isProcessing}
                className="w-full p-[9px] bg-transparent border border-hld-border text-hld-muted font-mono uppercase tracking-[0.14em] text-[7px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-hld-surface2 hover:text-hld-text bracketed"
                style={{"--br-color": "var(--tw-colors-hld-muted)"} as any}
              >
                <Lightbulb size={10} className="text-hld-yellow" /> Content Suggestions
              </button>
            </div>

            {/* === DIAGNOSTIC RESULTS === */}
            {diagnostic && (
              <div className="space-y-[14px] animate-in fade-in slide-in-from-bottom-4 duration-500 pt-[10px] mt-[10px] border-t border-hld-border">
                {/* Readiness Banner + Next Priority */}
                
                <div className="flex justify-between items-center mb-[8px] pb-[4px]">
                  <div className="text-[10px] font-mono tracking-[0.15em] font-bold text-hld-text flex items-center gap-[6px]">
                    <span className="text-hld-cyan">▰</span> DIAGNOSTICS
                  </div>
                  <div className={`text-[8px] font-mono tracking-[0.14em] font-bold uppercase ${READINESS_CONFIG[diagnostic.overallReadiness].color}`}>
                    {READINESS_CONFIG[diagnostic.overallReadiness].label}
                  </div>
                </div>

                <div className="space-y-[14px]">
                  {/* Next Priority — the most important thing */}
                  <div className="p-[10px] bg-[#0c1520] border border-hld-border">
                    <div className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-cyan mb-[4px] flex items-center gap-1">
                      <Crosshair size={10} /> Next Priority
                    </div>
                    <div className="text-[10px] text-hld-cyan/90 font-sans leading-[1.6]">
                      {diagnostic.nextPriority}
                    </div>
                  </div>
                </div>

                {/* Move-by-Move Results */}
                <div className="space-y-[8px]">
                  <div className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-muted">
                    Move-by-Move Breakdown
                  </div>
                  {diagnostic.moveResults.map((result, i) => (
                    <MoveResultCard key={result.moveId} result={result} index={i} />
                  ))}
                </div>

                {/* Coherence Notes */}
                {diagnostic.coherenceNotes.length > 0 && (
                  <div className="space-y-[8px]">
                    <div className="text-[7px] font-mono uppercase tracking-[0.15em] text-hld-muted mb-[4px]">
                      Coherence Notes
                    </div>
                    {diagnostic.coherenceNotes.map((note, i) => (
                      <div key={i} className="text-[10px] bg-transparent p-[8px] border border-hld-border text-hld-text flex gap-[8px] font-sans leading-[1.6]">
                        <AlertCircle size={12} className="text-hld-muted shrink-0 mt-0.5" />
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
          </>
        ) : (
          <div className="text-center text-hld-muted mt-10">
            <Layout size={32} className="mx-auto mb-2 opacity-50" />
            <p className="font-mono uppercase tracking-[0.14em] text-[8px]">Select a section</p>
          </div>
        )}
      </div>
    </div>
  );
};
