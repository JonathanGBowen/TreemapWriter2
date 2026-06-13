import React, { useState, useMemo } from "react";
import { FileText, Layout, Book, Check, Info, X, Play, Edit3, Clipboard } from "lucide-react";
import { Section, Persona } from "../../types";
import { buildDiagnosticPrompt, DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { useStore } from "../../store";
import { ModelPicker } from "./ModelPicker";
import { useModelChoice } from "./use-model-choice";
import type { ModelChoice } from "../../services/ai/model-types";

interface TestRunnerModalProps {
  onRun: (scope: 'segment' | 'parent' | 'full', choice: ModelChoice, instruction: string) => void;
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
  const [choice, setChoice] = useModelChoice('runDiagnostic', isOpen);
  const [useThinking, setUseThinking] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [copied, setCopied] = useState(false);

  const catalogModel = useStore((s) =>
    s.modelCatalog.find((m) => m.provider === choice.provider && m.id === choice.model),
  );

  const isGemini = choice.provider === 'gemini';
  // The numeric thinking knob is Gemini-only; other providers manage reasoning themselves.
  const canThink = isGemini && (catalogModel?.supportsThinking ?? false);
  const thinkingBudget = canThink && useThinking ? catalogModel?.defaultThinkingBudget ?? 16000 : 0;
  const runChoice: ModelChoice = { ...choice, thinkingBudget };

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
    // Output is usually just critique JSON
    const outputTokens = 500;

    return {
      input: inputTokens,
      thinking: thinkingBudget,
      total: inputTokens + thinkingBudget + outputTokens
    };
  }, [selectedScope, thinkingBudget, currentSection, documentStats]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-hld-surface rounded-xl shadow-2xl w-full max-w-2xl border border-hld-border flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="p-5 border-b border-hld-border flex justify-between items-center bg-hld-surface2">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-xl font-bold text-hld-text flex items-center gap-2 font-sans">
              <Play className="text-hld-cyan" size={20} />
              Evaluate: <span className="text-hld-cyan font-mono text-base truncate">{sectionTitle}</span>
            </h3>
            <p className="text-sm text-hld-muted mt-1 font-sans">
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
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
                  : 'text-hld-muted hover:text-hld-cyan border-hld-border hover:bg-hld-cyan/10'
              }`}
            >
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? 'Copied' : 'Copy Prompt'}
            </button>
            <button onClick={onClose} className="text-hld-muted hover:text-hld-text p-2 rounded-full hover:bg-hld-border transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. Scope Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted">Context Scope</label>
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
                        ? 'border-hld-cyan bg-hld-cyan/10'
                        : 'border-hld-border bg-hld-surface hover:border-hld-cyan/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded w-fit ${isSelected ? 'bg-hld-cyan/20 text-hld-cyan' : 'bg-hld-surface2 text-hld-muted'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className={`font-bold text-sm font-sans ${isSelected ? 'text-hld-cyan' : 'text-hld-text'}`}>
                        {scope.label}
                      </div>
                      <div className="text-[10px] text-hld-muted leading-tight mt-1 font-sans">
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
            <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted">AI Model</label>
            <ModelPicker
              value={choice}
              onChange={(c) => c && setChoice(c)}
              className="w-full bg-hld-bg border border-hld-border rounded-lg px-3 py-2.5 text-sm font-mono text-hld-text outline-none focus:border-hld-cyan"
            />
          </div>

          {/* 3. Thinking Toggle (Gemini, if supported) */}
          {canThink && (
             <div className={`p-4 rounded-lg border flex items-center gap-3 transition-all ${
                useThinking 
                  ? 'bg-hld-cyan/10 border-hld-cyan/30' 
                  : 'bg-hld-surface2 border-hld-border'
             }`}>
                <div 
                  onClick={() => setUseThinking(!useThinking)}
                  className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${useThinking ? 'bg-hld-cyan' : 'bg-hld-border'}`}
                >
                  <div className={`absolute top-1 left-1 bg-hld-bg w-4 h-4 rounded-full transition-transform ${useThinking ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <div className="flex-1">
                   <div className="text-sm font-bold text-hld-text font-sans">Enable Deep Thinking</div>
                   <div className="text-xs text-hld-muted font-sans">
                     Allocates {catalogModel?.defaultThinkingBudget ?? 16000} tokens for reasoning. Slower, but more rigorous.
                   </div>
                </div>
             </div>
          )}

          {/* 4. Custom Instruction */}
          <div className="space-y-2">
             <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-hld-muted flex items-center gap-2">
                <Edit3 size={14} /> Additional Instruction (Optional)
             </label>
             <textarea 
               value={customInstruction}
               onChange={(e) => setCustomInstruction(e.target.value)}
               className="w-full h-20 p-3 text-sm border border-hld-border rounded-lg bg-hld-surface2 text-hld-text focus:ring-2 focus:ring-hld-cyan/30 focus:border-hld-cyan outline-none resize-none font-mono placeholder-hld-muted/50"
               placeholder="e.g. 'Focus heavily on the citation formatting', 'Be extremely harsh about logical fallacies'"
             />
          </div>

          {/* Estimates — token math is Gemini-specific. */}
          {isGemini && (
          <div className="bg-hld-bg rounded-lg p-4 border border-hld-border grid grid-cols-3 gap-4">
             <div>
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted">Context</div>
                <div className="font-mono text-hld-text font-semibold">~{(estimates.input / 1000).toFixed(1)}k tokens</div>
             </div>
             <div>
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted">Thinking</div>
                <div className={`font-mono font-semibold ${thinkingBudget > 0 ? 'text-hld-cyan' : 'text-hld-muted'}`}>
                  {thinkingBudget > 0 ? `~${(estimates.thinking / 1000).toFixed(1)}k tokens` : 'Disabled'}
                </div>
             </div>
             <div>
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-hld-muted">Total Est.</div>
                <div className="font-mono text-hld-cyan font-bold">~{(estimates.total / 1000).toFixed(1)}k tokens</div>
             </div>
          </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-hld-border bg-hld-surface rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-hld-muted hover:text-hld-text text-[10px] font-mono uppercase tracking-widest font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
             onClick={() => onRun(selectedScope, runChoice, customInstruction)}
             className="px-6 py-2 bg-hld-cyan hover:bg-hld-cyan/80 text-hld-bg rounded-lg text-[10px] font-mono uppercase tracking-widest font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 hld-glow-cyan"
          >
             <Play size={16} fill="currentColor" /> Run Evaluation
          </button>
        </div>
      </div>
    </div>
  );
};