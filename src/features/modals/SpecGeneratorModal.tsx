import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, X, Check, History, GitCompare } from "lucide-react";
import * as Diff from "diff";
import { toast } from "sonner";
import { PromptsConfig } from "../../types";
import { DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { useStore } from "../../store";
import { aiProvider } from "../../services/ai-provider-registry";
import { resolveModelChoice } from "../../services/ai/resolve-model-choice";
import { guardContextFit } from "../shared/context-guard";
import { notifyAiError } from "../shared/ai-error";
import { AgentTraceTicker } from "../shared/AgentTraceTicker";

interface SpecGeneratorModalProps {
  sectionTitle: string;
  currentGoals: string;
  onAccept: (newGoals: string, instruction?: string) => void;
  fullSectionContent: string;
  parentGoals?: string;
  promptsConfig?: PromptsConfig;
}

export const SpecGeneratorModal: React.FC<SpecGeneratorModalProps> = ({
  sectionTitle,
  currentGoals,
  onAccept,
  fullSectionContent,
  parentGoals,
  promptsConfig = DEFAULT_PROMPTS_CONFIG
}) => {
  const isOpen = useStore(s => s.showSpecModal);
  const setShow = useStore(s => s.setShowSpecModal);
  const onClose = () => setShow(false);
  const [instruction, setInstruction] = useState("");
  const [draftGoals, setDraftGoals] = useState(currentGoals);
  const [proposedGoals, setProposedGoals] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [mode, setMode] = useState<'edit' | 'diff'>('edit');

  useEffect(() => {
    if (isOpen) {
      setDraftGoals(currentGoals);
      setProposedGoals(null);
      setMode('edit');
      setInstruction("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    // The full section content is sent whole; abort on overflow rather than slicing.
    const { modelCatalog, modelConfig, globalModelDefault } = useStore.getState();
    const choice = resolveModelChoice('refineSpec', modelConfig, globalModelDefault);
    if (!guardContextFit({ catalog: modelCatalog, choice, text: fullSectionContent, what: 'This section', setting: 'Refine goals' })) {
      return;
    }
    setIsThinking(true);

    try {
      const newText = await aiProvider.refineSpec({
        sectionTitle,
        currentGoals: draftGoals,
        fullSectionContent,
        parentGoals,
        instruction,
        config: promptsConfig,
      });
      if (newText) {
        setProposedGoals(newText);
        setMode('diff');
      }
    } catch (e) {
      console.error(e);
      notifyAiError(e, "Failed to generate specs. Please check your connection and try again.");
    } finally {
      setIsThinking(false);
    }
  };

  const renderDiff = () => {
    if (!proposedGoals) return null;
    const diff = Diff.diffWords(draftGoals, proposedGoals);
    
    return (
      <div className="bg-hld-bg p-4 rounded-lg border border-hld-border font-mono text-sm whitespace-pre-wrap leading-relaxed">
        {diff.map((part, i) => {
          if (part.added) {
            return <span key={i} className="bg-hld-green/20 text-hld-green px-1 rounded">{part.value}</span>;
          }
          if (part.removed) {
            return <span key={i} className="bg-hld-magenta/20 text-hld-magenta px-1 rounded line-through opacity-70 decoration-2">{part.value}</span>;
          }
          return <span key={i} className="text-hld-muted">{part.value}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-hld-surface rounded-xl shadow-2xl w-full max-w-3xl border border-hld-border flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-hld-border flex justify-between items-center bg-hld-surface2 rounded-t-xl">
          <h3 className="text-lg font-bold text-hld-text flex items-center gap-2 font-sans">
            <Sparkles className="text-hld-cyan" size={18} />
            Refine Specs: <span className="text-hld-cyan font-mono">{sectionTitle}</span>
          </h3>
          <button onClick={onClose} className="text-hld-muted hover:text-hld-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {mode === 'edit' && (
             <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted mb-1 block">Current Goals</label>
                  <textarea 
                    value={draftGoals}
                    onChange={(e) => setDraftGoals(e.target.value)}
                    className="w-full h-32 p-3 text-sm border border-hld-border bg-hld-surface text-hld-text rounded-lg focus:ring-2 focus:ring-hld-cyan/30 focus:border-hld-cyan outline-none font-sans"
                  />
               </div>
               
               <div className="bg-hld-surface2 p-4 rounded-lg border border-hld-border">
                 <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-cyan mb-2 block flex items-center gap-2">
                    <Sparkles size={12} /> AI Refinement
                 </label>
                 <div className="flex gap-2">
                   <input 
                     value={instruction}
                     onChange={(e) => setInstruction(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                     placeholder="e.g. 'Make it more concise', 'Focus on the logical contradictions', 'Simplify language'"
                     className="flex-1 p-2 text-sm border border-hld-border rounded bg-hld-bg text-hld-text focus:border-hld-cyan outline-none font-sans"
                   />
                   <button 
                     onClick={handleGenerate}
                     disabled={isThinking}
                     className="px-4 py-2 bg-hld-cyan text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-cyan/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                   >
                     {isThinking ? "Thinking..." : "Generate"}
                   </button>
                 </div>
                 <AgentTraceTicker
                   kinds={['refineSpec']}
                   className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-hld-muted min-w-0"
                 />
               </div>
             </div>
          )}

          {mode === 'diff' && proposedGoals && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-hld-muted">
                   <GitCompare size={16} /> Proposed Changes
                </div>
                <button 
                  onClick={() => setMode('edit')}
                  className="text-[10px] font-mono uppercase tracking-widest text-hld-cyan hover:text-hld-cyan/80 font-medium hover:underline"
                >
                  Edit Prompt
                </button>
              </div>
              
              {renderDiff()}
              
              <div className="p-3 bg-hld-yellow/10 border border-hld-yellow/30 rounded text-xs text-hld-yellow font-sans">
                Note: Accepting changes will mark previous test results as "Stale".
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-hld-border bg-hld-surface rounded-b-xl flex justify-end gap-3">
           <button 
             onClick={onClose}
             className="px-4 py-2 bg-hld-surface2 border border-hld-border rounded-md text-[10px] font-mono uppercase tracking-widest font-semibold hover:bg-hld-border text-hld-text transition-colors"
           >
             Cancel
           </button>
           
           {mode === 'diff' ? (
             <button 
               onClick={() => onAccept(proposedGoals!, instruction)}
               className="px-4 py-2 bg-hld-green text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-green/80 flex items-center gap-2 transition-all active:scale-95"
             >
               <Check size={16} /> Accept Changes
             </button>
           ) : (
             <button 
               onClick={() => onAccept(draftGoals, "Manual Edit")}
               className="px-4 py-2 bg-hld-cyan text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-cyan/80 flex items-center gap-2 transition-all active:scale-95"
             >
               <Check size={16} /> Save Goals
             </button>
           )}
        </div>
      </div>
    </div>
  );
};