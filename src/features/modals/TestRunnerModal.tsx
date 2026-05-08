import React, { useState, useMemo } from "react";
import { FileText, Layout, Book, BrainCircuit, Zap, Gauge, Check, Info, X, Play, Edit3, Clipboard } from "lucide-react";
import { Section, Persona } from "../../types";
import { buildDiagnosticPrompt, DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { useStore } from "../../store";

interface TestRunnerModalProps {
  onRun: (scope: 'segment' | 'parent' | 'full', modelId: string, thinkingBudget: number, instruction: string) => void;
  sectionTitle: string;
  currentSection: Section | null;
  currentSpec?: any;
  documentStats: {
    wordCount: number;
    sectionCount: number;
    depth: number;
  };
  activePersona: Persona;
  allSections: Section[];
  fullDocument: string;
}

const MODELS = [
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini Flash Lite',
    desc: 'Fastest feedback. Good for quick checks.',
    icon: Gauge,
    thinkingBudget: 0,
    defaultThinking: 0,
    canThink: false
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash',
    desc: 'Fast feedback loop. Good for quick grammar & clarity checks.',
    icon: Zap,
    thinkingBudget: 0,
    defaultThinking: 0, 
    canThink: false
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    desc: 'Fast feedback loop. Good for quick grammar & clarity checks.',
    icon: Zap,
    thinkingBudget: 0,
    defaultThinking: 0, 
    canThink: false
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    desc: 'Deep critique. Best for logic gaps and argumentation.',
    icon: BrainCircuit,
    thinkingBudget: 16000,
    defaultThinking: 8000,
    canThink: true
  }
];

const SCOPES = [
  { id: 'segment', label: 'Current Segment', desc: 'Focus on immediate writing', icon: FileText },
  { id: 'parent', label: 'Include Parent', desc: 'Check flow within chapter', icon: Layout },
  { id: 'full', label: 'Full Document', desc: 'Global consistency (Heavy)', icon: Book },
] as const;

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({
  onRun,
  sectionTitle,
  currentSection,
  currentSpec,
  documentStats,
  activePersona,
  allSections,
  fullDocument
}) => {
  const isOpen = useStore(s => s.showRunModal);
  const setShow = useStore(s => s.setShowRunModal);
  const onClose = () => setShow(false);
  const [selectedScope, setSelectedScope] = useState<'segment' | 'parent' | 'full'>('segment');
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3.1-flash-lite-preview');
  const [useThinking, setUseThinking] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedModel = useMemo(() => 
    MODELS.find(m => m.id === selectedModelId) || MODELS[0]
  , [selectedModelId]);

  // Estimates
  const estimates = useMemo(() => {
    let contextWords = 0;
    
    if (currentSection) {
      if (selectedScope === 'segment') {
        contextWords = currentSection.fullContent.split(/\s+/).length;
      } else if (selectedScope === 'parent') {
        // Crude estimate: current + parent context (approx 3x current)
        contextWords = currentSection.fullContent.split(/\s+/).length * 3;
      } else {
        contextWords = documentStats.wordCount;
      }
    }

    const inputTokens = Math.ceil(contextWords * 1.3);
    const thinkingTokens = useThinking ? selectedModel.thinkingBudget : 0;
    // Output is usually just critique JSON
    const outputTokens = 500; 

    return {
      input: inputTokens,
      thinking: thinkingTokens,
      total: inputTokens + thinkingTokens + outputTokens
    };
  }, [selectedScope, selectedModel, useThinking, currentSection, documentStats]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-hld-surface rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-hld-border flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="p-5 border-b border-slate-100 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-hld-surface2">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-hld-text flex items-center gap-2 font-sans">
              <Play className="text-indigo-600 dark:text-hld-cyan" size={20} />
              Evaluate: <span className="text-indigo-600 dark:text-hld-cyan font-mono text-base truncate">{sectionTitle}</span>
            </h3>
            <p className="text-sm text-slate-500 dark:text-hld-muted mt-1 font-sans">
              Configure the AI evaluator parameters.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              title="Copy diagnostic prompt to clipboard"
              onClick={() => {
                if (!currentSection) return;
                
                let contextContent = currentSection.fullContent;
                if (selectedScope === 'full') {
                  contextContent = fullDocument;
                } else if (selectedScope === 'parent' && currentSection.parentId) {
                  const findSection = (nodes: Section[], id: string): Section | null => {
                    for (const node of nodes) {
                      if (node.id === id) return node;
                      const found = findSection(node.children, id);
                      if (found) return found;
                    }
                    return null;
                  };
                  const parent = findSection(allSections, currentSection.parentId);
                  if (parent) contextContent = parent.fullContent;
                }

                const spec = currentSpec || {
                  function: 'argue',
                  mainClaim: '',
                  requiredMoves: [],
                  incomingContext: [],
                  outgoingCommitments: []
                };

                const prompt = buildDiagnosticPrompt({
                  baseInstruction: DEFAULT_PROMPTS_CONFIG.diagnosticInstruction,
                  personaInstruction: activePersona.instruction,
                  customInstruction,
                  sectionTitle: currentSection.title,
                  sectionFunction: spec.function,
                  mainClaim: spec.mainClaim,
                  requiredMoves: spec.requiredMoves,
                  incomingContext: spec.incomingContext,
                  outgoingCommitments: spec.outgoingCommitments,
                  scope: selectedScope,
                  content: contextContent.slice(0, 12000),
                });
                navigator.clipboard.writeText(prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1.5 border rounded flex items-center gap-1.5 transition-all ${
                copied 
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' 
                  : 'text-slate-500 dark:text-hld-muted hover:text-indigo-600 dark:hover:text-hld-cyan border-slate-200 dark:border-hld-border hover:bg-slate-100 dark:hover:bg-hld-cyan/10'
              }`}
            >
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? 'Copied' : 'Copy Prompt'}
            </button>
            <button onClick={onClose} className="text-slate-400 dark:text-hld-muted hover:text-slate-600 dark:hover:text-hld-text p-2 rounded-full hover:bg-slate-200 dark:hover:bg-hld-border transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. Scope Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-hld-muted">Context Scope</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SCOPES.map((scope) => {
                const isSelected = selectedScope === scope.id;
                const Icon = scope.icon;
                return (
                  <button
                    key={scope.id}
                    onClick={() => setSelectedScope(scope.id as any)}
                    className={`text-left p-3 rounded-xl border-2 transition-all flex flex-col gap-2 ${
                      isSelected
                        ? 'border-indigo-600 dark:border-hld-cyan bg-indigo-50 dark:bg-hld-cyan/10'
                        : 'border-slate-200 dark:border-hld-border bg-white dark:bg-hld-surface hover:border-indigo-300 dark:hover:border-hld-cyan/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded w-fit ${isSelected ? 'bg-indigo-200 dark:bg-hld-cyan/20 text-indigo-700 dark:text-hld-cyan' : 'bg-slate-100 dark:bg-hld-surface2 text-slate-500 dark:text-hld-muted'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className={`font-bold text-sm font-sans ${isSelected ? 'text-indigo-900 dark:text-hld-cyan' : 'text-slate-700 dark:text-hld-text'}`}>
                        {scope.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-hld-muted leading-tight mt-1 font-sans">
                        {scope.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Model Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-hld-muted">AI Model</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODELS.map((model) => {
                const isSelected = selectedModelId === model.id;
                const Icon = model.icon;
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                       setSelectedModelId(model.id);
                       if (model.id.includes('flash')) setUseThinking(false);
                    }}
                    className={`text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-indigo-600 dark:border-hld-cyan bg-indigo-50 dark:bg-hld-cyan/10'
                        : 'border-slate-200 dark:border-hld-border bg-white dark:bg-hld-surface hover:border-indigo-300 dark:hover:border-hld-cyan/50'
                    }`}
                  >
                     <div className={`p-2 rounded w-fit ${isSelected ? 'bg-indigo-200 dark:bg-hld-cyan/20 text-indigo-700 dark:text-hld-cyan' : 'bg-slate-100 dark:bg-hld-surface2 text-slate-500 dark:text-hld-muted'}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className={`font-bold text-sm font-sans ${isSelected ? 'text-indigo-900 dark:text-hld-cyan' : 'text-slate-700 dark:text-hld-text'}`}>
                          {model.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-hld-muted mt-1 font-sans">
                          {model.desc}
                        </div>
                      </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Thinking Toggle (If supported) */}
          {selectedModel.canThink && (
             <div className={`p-4 rounded-lg border flex items-center gap-3 transition-all ${
                useThinking 
                  ? 'bg-indigo-50 dark:bg-hld-cyan/10 border-indigo-200 dark:border-hld-cyan/30' 
                  : 'bg-slate-50 dark:bg-hld-surface2 border-slate-200 dark:border-hld-border'
             }`}>
                <div 
                  onClick={() => setUseThinking(!useThinking)}
                  className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${useThinking ? 'bg-indigo-600 dark:bg-hld-cyan' : 'bg-slate-300 dark:bg-hld-border'}`}
                >
                  <div className={`absolute top-1 left-1 bg-white dark:bg-hld-bg w-4 h-4 rounded-full transition-transform ${useThinking ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div className="flex-1">
                   <div className="text-sm font-bold text-slate-800 dark:text-hld-text font-sans">Enable Deep Thinking</div>
                   <div className="text-xs text-slate-500 dark:text-hld-muted font-sans">
                     Allocates {selectedModel.thinkingBudget} tokens for reasoning. Slower, but more rigorous.
                   </div>
                </div>
             </div>
          )}

          {/* 4. Custom Instruction */}
          <div className="space-y-2">
             <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-hld-muted flex items-center gap-2">
                <Edit3 size={14} /> Additional Instruction (Optional)
             </label>
             <textarea 
               value={customInstruction}
               onChange={(e) => setCustomInstruction(e.target.value)}
               className="w-full h-20 p-3 text-sm border border-slate-200 dark:border-hld-border rounded-lg bg-slate-50 dark:bg-hld-surface2 text-slate-700 dark:text-hld-text focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-hld-cyan/30 focus:border-indigo-500 dark:focus:border-hld-cyan outline-none resize-none font-mono placeholder-slate-400/50 dark:placeholder-hld-muted/50"
               placeholder="e.g. 'Focus heavily on the citation formatting', 'Be extremely harsh about logical fallacies'"
             />
          </div>

          {/* Estimates */}
          <div className="bg-slate-50 dark:bg-hld-bg rounded-lg p-4 border border-slate-200 dark:border-hld-border grid grid-cols-3 gap-4">
             <div>
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-400 dark:text-hld-muted">Context</div>
                <div className="font-mono text-slate-700 dark:text-hld-text font-semibold">~{(estimates.input / 1000).toFixed(1)}k tokens</div>
             </div>
             <div>
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-400 dark:text-hld-muted">Thinking</div>
                <div className={`font-mono font-semibold ${useThinking ? 'text-indigo-600 dark:text-hld-cyan' : 'text-slate-400 dark:text-hld-muted'}`}>
                  {useThinking ? `~${(estimates.thinking / 1000).toFixed(1)}k tokens` : 'Disabled'}
                </div>
             </div>
             <div>
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-400 dark:text-hld-muted">Total Est.</div>
                <div className="font-mono text-slate-900 dark:text-hld-cyan font-bold">~{(estimates.total / 1000).toFixed(1)}k tokens</div>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-hld-border bg-slate-50 dark:bg-hld-surface rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-hld-muted dark:hover:text-hld-text text-[10px] font-mono uppercase tracking-widest font-semibold transition-colors"
          >
            Cancel
          </button>
          <button 
             onClick={() => onRun(selectedScope, selectedModelId, useThinking ? selectedModel.thinkingBudget : 0, customInstruction)}
             className="px-6 py-2 bg-indigo-600 dark:bg-hld-cyan hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 text-white dark:text-hld-bg rounded-lg text-[10px] font-mono uppercase tracking-widest font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 hld-glow-cyan"
          >
             <Play size={16} fill="currentColor" /> Run Evaluation
          </button>
        </div>
      </div>
    </div>
  );
};