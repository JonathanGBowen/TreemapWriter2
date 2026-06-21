import React, { useState, useEffect } from 'react';
import { X, BrainCircuit, Sparkles, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Section, TestSuite, PromptsConfig } from '../../types';
import ReactMarkdown from 'react-markdown';
import { computeHash } from '../../lib/utils';
import { DEFAULT_PROMPTS_CONFIG } from '../../lib/constants';
import { useStore } from '../../store';
import { aiProvider } from '../../services/ai-provider-registry';
import { guardContextFit } from '../shared/context-guard';
import { ModelPicker } from './ModelPicker';
import { useModelChoice } from './use-model-choice';
import { AgentTraceTicker } from '../shared/AgentTraceTicker';

interface CoachModalProps {
  markdown: string;
  sections: Section[];
  testSuite: TestSuite;
  cachedAdvice?: { inputHash: string; advice: string } | null;
  onSaveCache?: (inputHash: string, advice: string) => void;
  promptsConfig?: PromptsConfig;
}

export const CoachModal: React.FC<CoachModalProps> = ({
  markdown,
  sections,
  testSuite,
  cachedAdvice,
  onSaveCache,
  promptsConfig = DEFAULT_PROMPTS_CONFIG
}) => {
  const isOpen = useStore(s => s.showCoachModal);
  const setShow = useStore(s => s.setShowCoachModal);
  const modelCatalog = useStore(s => s.modelCatalog);
  const onClose = () => setShow(false);
  const [choice, setChoice] = useModelChoice('streamCoachAdvice', isOpen);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPlan, setActionPlan] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const structureData = sections.map(sec => {
    const tests = testSuite[sec.id];
    return {
      title: sec.title,
      level: sec.level,
      wordCount: sec.wordCount,
      goals: tests?.goals,
      status: tests?.status,
      missingMoves: tests?.lastDiagnostic?.moveResults?.filter(m => m.status === 'missing' || m.status === 'unclear') || []
    };
  });
  
  const currentInputHash = computeHash(`${markdown.length}|${JSON.stringify(structureData)}`);

  useEffect(() => {
    if (isOpen) {
      if (cachedAdvice && cachedAdvice.inputHash === currentInputHash) {
        setActionPlan(cachedAdvice.advice);
        setIsStale(false);
      } else if (cachedAdvice) {
        setActionPlan(cachedAdvice.advice);
        setIsStale(true);
      } else {
        setActionPlan(null);
        handleGenerate();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    // Pre-flight the structure summary (what the call actually sends) against
    // the chosen model's window — never silently truncate.
    if (!guardContextFit({
      catalog: modelCatalog,
      choice,
      text: JSON.stringify(structureData),
      what: 'This project summary',
      setting: 'Coach advice (live)',
    })) return;

    setIsProcessing(true);
    setIsStale(false);
    setError(null);
    setActionPlan('');

    try {
      // Stream token-by-token: the system's thinking is made visible, killing
      // the "is it working?" moment (the app's preferred accessibility idiom).
      let acc = '';
      for await (const chunk of aiProvider.streamCoachAdvice({
        markdown,
        sections,
        testSuite,
        config: promptsConfig,
        modelChoice: choice,
      })) {
        acc += chunk;
        setActionPlan(acc);
      }
      if (!acc) {
        setError('The coach returned no text.');
        setActionPlan(null);
      } else if (onSaveCache) {
        onSaveCache(currentInputHash, acc);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during analysis.');
      setActionPlan(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-[600px] flex flex-col bg-hld-bg border border-hld-border shadow-[0_0_40px_rgba(0,232,245,0.1)] overflow-hidden font-sans pointer-events-auto max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-[12px_16px] bg-hld-surface border-b border-hld-border shrink-0">
          <div className="flex items-center gap-[10px]">
            <BrainCircuit className="text-hld-yellow" size={16} />
            <h2 className="text-[12px] font-bold text-hld-text font-mono uppercase tracking-[0.1em]">
              ADHD Writing Coach
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-hld-muted hover:text-hld-magenta transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1 min-h-0 overflow-y-auto">
          {isStale && actionPlan && (
            <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700 rounded-md flex gap-2 items-start shrink-0">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <div className="text-[12px] text-amber-400">
                <strong>Project has changed.</strong> This advice is based on an older version of your document. 
                <button onClick={handleGenerate} className="ml-2 underline font-semibold hover:text-amber-300">Regenerate</button>
              </div>
            </div>
          )}
          {!actionPlan && !isProcessing && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BrainCircuit className="w-12 h-12 text-hld-muted/30 mb-4" />
              <h3 className="text-[14px] font-bold text-hld-text mb-2">Needs Direction?</h3>
              <p className="text-[12px] text-hld-muted max-w-[400px]">
                The coach will analyze the full scope of your project, identify the biggest bottlenecks, and give you a focused, actionable plan to get unstuck.
              </p>
              
              <div className="mt-8 flex flex-col items-start bg-hld-surface p-4 border border-hld-border w-full">
                <label className="text-[10px] font-mono uppercase text-hld-muted mb-2">Model</label>
                <ModelPicker
                  value={choice}
                  onChange={(c) => c && setChoice(c)}
                  className="w-full bg-hld-bg border border-hld-border text-[11px] p-2 text-hld-text focus:outline-none focus:border-hld-cyan"
                />
              </div>
            </div>
          )}

          {/* Spinner only until the first token lands; after that the streaming
              text itself is the progress signal. */}
          {isProcessing && !actionPlan && (
            <div className="flex flex-col items-center justify-center py-12">
               <Loader2 className="w-8 h-8 text-hld-yellow animate-spin mb-4" />
               <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-hld-muted animate-pulse">
                 Analyzing structure & generating plan...
               </div>
               <AgentTraceTicker
                 kinds={['getCoachAdvice', 'streamCoachAdvice']}
                 className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-md min-w-0 px-4"
               />
            </div>
          )}

          {error && (
            <div className="bg-hld-magenta/10 border border-hld-magenta/30 p-4 flex gap-2 items-start mt-2">
              <AlertCircle className="w-4 h-4 text-hld-magenta shrink-0 mt-0.5" />
              <div className="text-[12px] text-hld-red">{error}</div>
            </div>
          )}

          {actionPlan && (
            <div className="markdown-body p-4 bg-hld-surface border border-hld-border shadow-inner font-sans text-sm text-slate-300 overflow-y-auto">
              <ReactMarkdown>{actionPlan}</ReactMarkdown>
              {isProcessing && (
                <span className="inline-block w-[7px] h-[14px] ml-[2px] align-middle bg-hld-yellow animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex justify-end border-hld-border bg-hld-surface shrink-0">
          {!actionPlan && !isProcessing && (
            <button
               onClick={handleGenerate}
               className="px-4 py-2 bg-hld-yellow text-black hover:bg-amber-400 text-[11px] font-mono uppercase tracking-[0.1em] transition-colors flex items-center gap-2 shadow-[0_0_10px_rgba(255,190,0,0.2)]"
            >
              <Sparkles size={14} /> Get Action Plan
            </button>
          )}
          {actionPlan && (
            <button
               onClick={() => setActionPlan(null)}
               className="px-4 py-2 bg-transparent border border-hld-border text-hld-text text-[11px] font-mono uppercase tracking-[0.1em] hover:bg-hld-surface2 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
