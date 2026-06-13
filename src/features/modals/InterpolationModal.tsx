import React, { useState, useMemo, useEffect } from "react";
import { BrainCircuit, Zap, Check, Info, X, Edit3 } from "lucide-react";

import { PromptsConfig } from "../../types";
import { useStore } from "../../store";
import { ModelPicker } from "./ModelPicker";
import { resolveModelChoice } from "../../services/ai/resolve-model-choice";
import type { ModelChoice } from "../../services/ai/model-types";

interface InterpolationModalProps {
  onConfirm: (choice: ModelChoice, config: PromptsConfig) => void;
  documentStats: {
    wordCount: number;
    sectionCount: number;
    depth: number;
  };
  initialConfig: PromptsConfig;
}

export const InterpolationModal: React.FC<InterpolationModalProps> = ({
  onConfirm,
  documentStats,
  initialConfig
}) => {
  const isOpen = useStore(s => s.showInterpolationModal);
  const setShow = useStore(s => s.setShowInterpolationModal);
  const onClose = () => setShow(false);
  const [choice, setChoice] = useState<ModelChoice>(() => {
    const s = useStore.getState();
    return resolveModelChoice('generateSpecs', s.modelConfig, s.globalModelDefault);
  });
  const [config, setConfig] = useState<PromptsConfig>(initialConfig);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const s = useStore.getState();
    setChoice(resolveModelChoice('generateSpecs', s.modelConfig, s.globalModelDefault));
  }, [isOpen]);

  const isGemini = choice.provider === 'gemini';
  const thinkingBudget = choice.thinkingBudget ?? 0;

  // Estimation Logic
  const estimates = useMemo(() => {
    // Heuristics
    const tokensPerWord = 1.3;
    const inputBaseTokens = Math.ceil(documentStats.wordCount * tokensPerWord);
    
    // We batch by levels (roughly depth / 2 batches) plus root analysis
    const estimatedBatches = Math.max(1, Math.ceil(documentStats.depth / 2)) + 1;
    
    // In every batch, we send context. 
    const totalInputTokens = inputBaseTokens * estimatedBatches;
    
    // Thinking per batch
    const totalThinkingTokens = thinkingBudget * estimatedBatches;
    
    // Output: Approx 150 tokens per section goal
    const totalOutputTokens = documentStats.sectionCount * 150;

    return {
      batches: estimatedBatches,
      input: totalInputTokens,
      thinking: totalThinkingTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalThinkingTokens + totalOutputTokens
    };
  }, [documentStats, thinkingBudget]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-hld-surface rounded-xl shadow-2xl w-full max-w-2xl border border-hld-border flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-hld-border flex justify-between items-center bg-hld-surface2">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-hld-text flex items-center gap-2 font-sans">
              <BrainCircuit className="text-hld-cyan" />
              Configure Deep Analysis
            </h3>
            <p className="text-sm text-hld-muted mt-1 font-sans">
              Select a model to generate specifications for {documentStats.sectionCount} sections.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              title="Copy analysis prompt structure to clipboard"
              onClick={() => {
                const promptBody = [
                  initialConfig.systemInstruction,
                  "\nLEVEL 1 TASK:\n", initialConfig.l1TaskInstruction,
                  "\nSUB-TASK:\n", initialConfig.subTaskInstruction
                ].join("\n");
                navigator.clipboard.writeText(promptBody);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1.5 border rounded flex items-center gap-1.5 transition-all ${
                copied 
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
                  : 'text-hld-muted hover:text-hld-cyan border-hld-border hover:bg-hld-cyan/10'
              }`}
            >
              {copied ? <Check size={14} /> : <Zap size={14} />}
              {copied ? 'Copied' : 'Copy Prompt'}
            </button>
            <button onClick={onClose} className="text-hld-muted hover:text-hld-text p-2 rounded-full hover:bg-hld-border transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Model Selection */}
          <div>
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted mb-2 block">
              Model
            </label>
            <ModelPicker
              value={choice}
              onChange={(c) => c && setChoice(c)}
              className="w-full bg-hld-bg border border-hld-border rounded-lg px-3 py-2.5 text-sm font-mono text-hld-text outline-none focus:border-hld-cyan"
            />
          </div>

          {/* Prompt Configuration - HLD Inspired Visual Tree */}
          <div className="relative p-4 border border-hld-border bg-hld-bg rounded-xl">
            <h5 className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted mb-4 flex items-center gap-2">
              <Edit3 size={14} /> Prompt Configuration
            </h5>
            
            <div className="relative pl-6 space-y-6">
              {/* Vertical connecting line */}
              <div className="absolute left-3 top-4 bottom-8 w-0.5 bg-hld-border"></div>

              {/* System Instruction */}
              <div className="relative">
                <div className="absolute -left-6 top-3 w-3 h-3 rounded-full bg-hld-cyan border-2 border-hld-bg z-10 hld-glow-cyan"></div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-cyan mb-1 block">
                  System Instruction (Global)
                </label>
                <textarea 
                  value={config.systemInstruction}
                  onChange={(e) => setConfig({...config, systemInstruction: e.target.value})}
                  className="w-full h-20 p-3 text-sm border border-hld-border rounded-lg bg-hld-surface2 text-hld-text focus:ring-1 focus:ring-hld-cyan focus:border-hld-cyan outline-none resize-none font-mono placeholder-hld-muted/50"
                  placeholder="Enter the system instruction..."
                />
              </div>

              {/* L1 Task Instruction */}
              <div className="relative">
                <div className="absolute -left-6 top-3 w-3 h-3 rounded-full bg-hld-pink border-2 border-hld-bg z-10 hld-glow-pink"></div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-pink mb-1 block">
                  Level 1 Task (Root & Main Sections)
                </label>
                <textarea 
                  value={config.l1TaskInstruction}
                  onChange={(e) => setConfig({...config, l1TaskInstruction: e.target.value})}
                  className="w-full h-32 p-3 text-sm border border-hld-border rounded-lg bg-hld-surface2 text-hld-text focus:ring-1 focus:ring-hld-pink focus:border-hld-pink outline-none resize-none font-mono placeholder-hld-muted/50"
                  placeholder="Enter the Level 1 task instruction..."
                />
              </div>

              {/* Sub-Task Instruction */}
              <div className="relative">
                <div className="absolute -left-6 top-3 w-3 h-3 rounded-full bg-hld-purple border-2 border-hld-bg z-10 hld-glow-purple"></div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-purple mb-1 block">
                  Sub-Level Task (Subsections)
                </label>
                <textarea 
                  value={config.subTaskInstruction}
                  onChange={(e) => setConfig({...config, subTaskInstruction: e.target.value})}
                  className="w-full h-32 p-3 text-sm border border-hld-border rounded-lg bg-hld-surface2 text-hld-text focus:ring-1 focus:ring-hld-purple focus:border-hld-purple outline-none resize-none font-mono placeholder-hld-muted/50"
                  placeholder="Enter the sub-level task instruction..."
                />
              </div>
            </div>
            
            <p className="text-[10px] font-mono uppercase tracking-widest text-hld-muted mt-4">
               These prompts define how the AI interprets the main thesis and criteria for different levels of the document hierarchy.
            </p>
          </div>

          {/* Stats & Estimation — token math is Gemini-specific. */}
          {isGemini && (
          <div className="bg-hld-bg rounded-lg p-5 border border-hld-border">
            <h5 className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted mb-4 flex items-center gap-2">
              <Info size={14} /> Usage Estimation
            </h5>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] font-mono text-hld-muted uppercase font-semibold mb-1">Batches</div>
                <div className="text-lg font-mono font-medium text-hld-text">{estimates.batches}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-hld-muted uppercase font-semibold mb-1">Input Tokens</div>
                <div className="text-lg font-mono font-medium text-hld-text">~{(estimates.input / 1000).toFixed(1)}k</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-hld-muted uppercase font-semibold mb-1">Thinking</div>
                <div className="text-lg font-mono font-medium text-hld-cyan">~{(estimates.thinking / 1000).toFixed(1)}k</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-hld-muted uppercase font-semibold mb-1">Total Est.</div>
                <div className="text-lg font-mono font-bold text-hld-cyan">~{(estimates.total / 1000).toFixed(1)}k</div>
              </div>
            </div>

            <div className="mt-4 text-[10px] font-mono uppercase tracking-widest text-hld-muted italic bg-hld-surface2 p-2 rounded border border-hld-border">
              * Estimations are rough approximations based on document structure. Actual usage may vary.
              {thinkingBudget === 0 && " This model does not use thinking tokens."}
            </div>
          </div>
          )}

        </div>

        <div className="p-4 bg-hld-surface2 border-t border-hld-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-hld-muted hover:text-hld-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(choice, config)}
            className="px-6 py-2 bg-hld-cyan hover:bg-hld-cyan/80 text-hld-bg rounded-lg text-[10px] font-mono uppercase tracking-widest font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 hld-glow-cyan"
          >
            <BrainCircuit size={16} />
            Start Analysis
          </button>
        </div>

      </div>
    </div>
  );
};