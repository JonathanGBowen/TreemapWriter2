import React, { useState, useMemo } from "react";
import { BrainCircuit, Zap, Gauge, Check, Info, X, Edit3 } from "lucide-react";

import { PromptsConfig } from "../../types";
import { useStore } from "../../store";

interface InterpolationModalProps {
  onConfirm: (modelId: string, thinkingBudget: number, config: PromptsConfig) => void;
  documentStats: {
    wordCount: number;
    sectionCount: number;
    depth: number;
  };
  initialConfig: PromptsConfig;
}

const MODELS = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    desc: 'Balanced reasoning & speed. Best for most tasks.',
    icon: Zap,
    thinkingBudget: 0,
    costTier: 'Low'
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    desc: 'Deepest reasoning. Best for complex logic.',
    icon: BrainCircuit,
    thinkingBudget: 16000,
    costTier: 'High'
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini Flash Lite',
    desc: 'Fastest. No advanced thinking steps.',
    icon: Gauge,
    thinkingBudget: 0,
    costTier: 'Lowest'
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash',
    desc: 'Fast. Standard reasoning.',
    icon: Zap,
    thinkingBudget: 0,
    costTier: 'Low'
  }
];

export const InterpolationModal: React.FC<InterpolationModalProps> = ({
  onConfirm,
  documentStats,
  initialConfig
}) => {
  const isOpen = useStore(s => s.showInterpolationModal);
  const setShow = useStore(s => s.setShowInterpolationModal);
  const onClose = () => setShow(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3-flash-preview');
  const [config, setConfig] = useState<PromptsConfig>(initialConfig);
  const [copied, setCopied] = useState(false);

  const selectedModel = useMemo(() => 
    MODELS.find(m => m.id === selectedModelId) || MODELS[0]
  , [selectedModelId]);

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
    const totalThinkingTokens = selectedModel.thinkingBudget * estimatedBatches;
    
    // Output: Approx 150 tokens per section goal
    const totalOutputTokens = documentStats.sectionCount * 150;

    return {
      batches: estimatedBatches,
      input: totalInputTokens,
      thinking: totalThinkingTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalThinkingTokens + totalOutputTokens
    };
  }, [documentStats, selectedModel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-hld-surface rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-hld-border flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-slate-100 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-hld-surface2">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-slate-800 dark:text-hld-text flex items-center gap-2 font-sans">
              <BrainCircuit className="text-indigo-600 dark:text-hld-cyan" />
              Configure Deep Analysis
            </h3>
            <p className="text-sm text-slate-500 dark:text-hld-muted mt-1 font-sans">
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
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' 
                  : 'text-slate-500 dark:text-hld-muted hover:text-indigo-600 dark:hover:text-hld-cyan border-slate-200 dark:border-hld-border hover:bg-slate-100 dark:hover:bg-hld-cyan/10'
              }`}
            >
              {copied ? <Check size={14} /> : <Zap size={14} />}
              {copied ? 'Copied' : 'Copy Prompt'}
            </button>
            <button onClick={onClose} className="text-slate-400 dark:text-hld-muted hover:text-slate-600 dark:hover:text-hld-text p-2 rounded-full hover:bg-slate-200 dark:hover:bg-hld-border transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Model Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {MODELS.map((model) => {
              const Icon = model.icon;
              const isSelected = selectedModelId === model.id;
              return (
                <div 
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={`cursor-pointer relative p-4 rounded-xl border-2 transition-all duration-200 ${
                    isSelected 
                      ? 'border-indigo-600 dark:border-hld-cyan bg-indigo-50 dark:bg-hld-cyan/10' 
                      : 'border-slate-200 dark:border-hld-border hover:border-indigo-300 dark:hover:border-hld-cyan/50 bg-white dark:bg-hld-surface'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-indigo-600 dark:text-hld-cyan">
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
                  <div className={`p-2 rounded-lg w-fit mb-3 ${isSelected ? 'bg-indigo-200 dark:bg-hld-cyan/20 text-indigo-700 dark:text-hld-cyan' : 'bg-slate-100 dark:bg-hld-surface2 text-slate-500 dark:text-hld-muted'}`}>
                    <Icon size={20} />
                  </div>
                  <h4 className={`font-bold text-sm font-sans ${isSelected ? 'text-indigo-900 dark:text-hld-cyan' : 'text-slate-700 dark:text-hld-text'}`}>
                    {model.name}
                  </h4>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-hld-muted mt-1 leading-relaxed">
                    {model.desc}
                  </p>
                </div>
              );
            })}
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

          {/* Stats & Estimation */}
          <div className="bg-slate-50 dark:bg-hld-bg rounded-lg p-5 border border-slate-200 dark:border-hld-border">
            <h5 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-hld-muted mb-4 flex items-center gap-2">
              <Info size={14} /> Usage Estimation
            </h5>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-hld-muted uppercase font-semibold mb-1">Batches</div>
                <div className="text-lg font-mono font-medium text-slate-700 dark:text-hld-text">{estimates.batches}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-hld-muted uppercase font-semibold mb-1">Input Tokens</div>
                <div className="text-lg font-mono font-medium text-slate-700 dark:text-hld-text">~{(estimates.input / 1000).toFixed(1)}k</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-hld-muted uppercase font-semibold mb-1">Thinking</div>
                <div className="text-lg font-mono font-medium text-indigo-600 dark:text-hld-cyan">~{(estimates.thinking / 1000).toFixed(1)}k</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-hld-muted uppercase font-semibold mb-1">Total Est.</div>
                <div className="text-lg font-mono font-bold text-slate-800 dark:text-hld-cyan">~{(estimates.total / 1000).toFixed(1)}k</div>
              </div>
            </div>

            <div className="mt-4 text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-hld-muted italic bg-white dark:bg-hld-surface2 p-2 rounded border border-slate-200 dark:border-hld-border">
              * Estimations are rough approximations based on document structure. Actual usage may vary.
              {selectedModel.thinkingBudget === 0 && " This model does not use thinking tokens."}
            </div>
          </div>

        </div>

        <div className="p-4 bg-slate-50 dark:bg-hld-surface2 border-t border-slate-200 dark:border-hld-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-slate-600 dark:text-hld-muted hover:text-slate-900 dark:hover:text-hld-text transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(selectedModelId, selectedModel.thinkingBudget, config)}
            className="px-6 py-2 bg-indigo-600 dark:bg-hld-cyan hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 text-white dark:text-hld-bg rounded-lg text-[10px] font-mono uppercase tracking-widest font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 hld-glow-cyan"
          >
            <BrainCircuit size={16} />
            Start Analysis
          </button>
        </div>

      </div>
    </div>
  );
};