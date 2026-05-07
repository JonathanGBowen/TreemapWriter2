import React, { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { Sparkles, ArrowRight, X, Check, History, GitCompare } from "lucide-react";
import * as Diff from "diff";
import { toast } from "sonner";
import { PromptsConfig } from "../../types";
import { DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { useStore } from "../../store";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsThinking(true);
    
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
${promptsConfig.refineSpecPrompt}

CONTEXT:
Section Title: "${sectionTitle}"
Parent Section Goals: "${parentGoals || 'N/A'}"
Current Goals: "${draftGoals}"
Section Content: "${fullSectionContent.slice(0, 3000)}..."

USER INSTRUCTION: "${instruction.trim() || 'Improve and refine the goals for clarity, conciseness, and completeness.'}"
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 16000 }
        }
      });
      
      const newText = response.text?.trim();
      if (newText) {
        setProposedGoals(newText);
        setMode('diff');
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate specs. Please check your connection and API key.");
    } finally {
      setIsThinking(false);
    }
  };

  const renderDiff = () => {
    if (!proposedGoals) return null;
    const diff = Diff.diffWords(draftGoals, proposedGoals);
    
    return (
      <div className="bg-slate-50 dark:bg-hld-bg p-4 rounded-lg border border-slate-200 dark:border-hld-border font-mono text-sm whitespace-pre-wrap leading-relaxed">
        {diff.map((part, i) => {
          if (part.added) {
            return <span key={i} className="bg-emerald-100 dark:bg-hld-green/20 text-emerald-800 dark:text-hld-green px-1 rounded">{part.value}</span>;
          }
          if (part.removed) {
            return <span key={i} className="bg-rose-100 dark:bg-hld-magenta/20 text-rose-800 dark:text-hld-magenta px-1 rounded line-through opacity-70 decoration-2">{part.value}</span>;
          }
          return <span key={i} className="text-slate-600 dark:text-hld-muted">{part.value}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-hld-surface rounded-xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-hld-border flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-slate-100 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-hld-surface2 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-800 dark:text-hld-text flex items-center gap-2 font-sans">
            <Sparkles className="text-indigo-500 dark:text-hld-cyan" size={18} />
            Refine Specs: <span className="text-indigo-600 dark:text-hld-cyan font-mono">{sectionTitle}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 dark:text-hld-muted hover:text-slate-600 dark:hover:text-hld-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {mode === 'edit' && (
             <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-hld-muted mb-1 block">Current Goals</label>
                  <textarea 
                    value={draftGoals}
                    onChange={(e) => setDraftGoals(e.target.value)}
                    className="w-full h-32 p-3 text-sm border border-slate-200 dark:border-hld-border bg-white dark:bg-hld-surface text-slate-700 dark:text-hld-text rounded-lg focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-hld-cyan/30 focus:border-indigo-500 dark:focus:border-hld-cyan outline-none font-sans"
                  />
               </div>
               
               <div className="bg-indigo-50 dark:bg-hld-surface2 p-4 rounded-lg border border-indigo-100 dark:border-hld-border">
                 <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-700 dark:text-hld-cyan mb-2 block flex items-center gap-2">
                    <Sparkles size={12} /> AI Refinement
                 </label>
                 <div className="flex gap-2">
                   <input 
                     value={instruction}
                     onChange={(e) => setInstruction(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                     placeholder="e.g. 'Make it more concise', 'Focus on the logical contradictions', 'Simplify language'"
                     className="flex-1 p-2 text-sm border border-slate-200 dark:border-hld-border rounded bg-white dark:bg-hld-bg text-slate-700 dark:text-hld-text focus:border-indigo-500 dark:focus:border-hld-cyan outline-none font-sans"
                   />
                   <button 
                     onClick={handleGenerate}
                     disabled={isThinking}
                     className="px-4 py-2 bg-indigo-600 dark:bg-hld-cyan text-white dark:text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                   >
                     {isThinking ? "Thinking..." : "Generate"}
                   </button>
                 </div>
               </div>
             </div>
          )}

          {mode === 'diff' && proposedGoals && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-slate-500 dark:text-hld-muted">
                   <GitCompare size={16} /> Proposed Changes
                </div>
                <button 
                  onClick={() => setMode('edit')}
                  className="text-[10px] font-mono uppercase tracking-widest text-indigo-500 dark:text-hld-cyan hover:text-indigo-600 dark:hover:text-hld-cyan/80 font-medium hover:underline"
                >
                  Edit Prompt
                </button>
              </div>
              
              {renderDiff()}
              
              <div className="p-3 bg-amber-50 dark:bg-hld-yellow/10 border border-amber-100 dark:border-hld-yellow/30 rounded text-xs text-amber-800 dark:text-hld-yellow font-sans">
                Note: Accepting changes will mark previous test results as "Stale".
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-hld-border bg-slate-50 dark:bg-hld-surface rounded-b-xl flex justify-end gap-3">
           <button 
             onClick={onClose}
             className="px-4 py-2 bg-white dark:bg-hld-surface2 border border-slate-200 dark:border-hld-border rounded-md text-[10px] font-mono uppercase tracking-widest font-semibold hover:bg-slate-50 dark:hover:bg-hld-border text-slate-700 dark:text-hld-text transition-colors"
           >
             Cancel
           </button>
           
           {mode === 'diff' ? (
             <button 
               onClick={() => onAccept(proposedGoals!, instruction)}
               className="px-4 py-2 bg-emerald-600 dark:bg-hld-green text-white dark:text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-emerald-700 dark:hover:bg-hld-green/80 flex items-center gap-2 transition-all active:scale-95"
             >
               <Check size={16} /> Accept Changes
             </button>
           ) : (
             <button 
               onClick={() => onAccept(draftGoals, "Manual Edit")}
               className="px-4 py-2 bg-indigo-600 dark:bg-hld-cyan text-white dark:text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 flex items-center gap-2 transition-all active:scale-95"
             >
               <Check size={16} /> Save Goals
             </button>
           )}
        </div>
      </div>
    </div>
  );
};