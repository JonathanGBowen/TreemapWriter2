import React, { useState, useEffect } from "react";
import { Sparkles, X, Lightbulb, MessageSquare, ArrowRight, RefreshCw, Settings, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { computeHash } from "../../lib/utils";
import { PromptsConfig } from "../../types";
import { DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { useStore } from "../../store";
import { aiProvider } from "../../services/ai-provider-registry";
import { guardContextFit } from "../shared/context-guard";
import { notifyAiError } from "../shared/ai-error";
import { AgentTraceTicker } from "../shared/AgentTraceTicker";
import { ModelPicker } from "./ModelPicker";
import { useModelChoice } from "./use-model-choice";

interface ContentSuggestionsModalProps {
  sectionTitle: string;
  currentGoals: string;
  fullSectionContent: string;
  parentGoals?: string;
  sectionId: string;
  cachedSuggestions?: { inputHash: string; suggestions: string };
  onSaveCache?: (sectionId: string, inputHash: string, suggestions: string) => void;
  promptsConfig?: PromptsConfig;
}

export const ContentSuggestionsModal: React.FC<ContentSuggestionsModalProps> = ({
  sectionTitle,
  currentGoals,
  fullSectionContent,
  parentGoals,
  sectionId,
  cachedSuggestions,
  onSaveCache,
  promptsConfig = DEFAULT_PROMPTS_CONFIG
}) => {
  const isOpen = useStore(s => s.showSuggestionsModal);
  const setShow = useStore(s => s.setShowSuggestionsModal);
  const onClose = () => setShow(false);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [choice, setChoice] = useModelChoice('getContentSuggestions', isOpen);
  const modelCatalog = useStore(s => s.modelCatalog);
  const [isStale, setIsStale] = useState(false);
  
  const currentInputHash = computeHash(`${sectionTitle}|${currentGoals}|${fullSectionContent}|${parentGoals||''}`);

  useEffect(() => {
    if (isOpen) {
      if (cachedSuggestions && cachedSuggestions.inputHash === currentInputHash) {
        setSuggestions(cachedSuggestions.suggestions);
        setIsStale(false);
      } else if (cachedSuggestions) {
        setSuggestions(cachedSuggestions.suggestions);
        setIsStale(true);
      } else {
        // No cache: wait for an explicit "Generate" rather than firing an AI
        // call (and burning tokens) the instant the modal opens.
        setSuggestions(null);
      }
    }
  }, [isOpen, sectionTitle, currentGoals, fullSectionContent, parentGoals, cachedSuggestions]);

  const handleGenerate = async () => {
    // The full section content is sent whole; abort on overflow rather than slicing.
    if (!guardContextFit({ catalog: modelCatalog, choice, text: fullSectionContent, what: 'This section', setting: 'Content suggestions' })) {
      return;
    }
    setIsThinking(true);
    setIsStale(false);
    try {
      const text = await aiProvider.getContentSuggestions({
        sectionTitle,
        currentGoals,
        fullSectionContent,
        parentGoals,
        config: promptsConfig,
        modelChoice: choice,
      });
      setSuggestions(text);
      if (onSaveCache && text) {
        onSaveCache(sectionId, currentInputHash, text);
      }
    } catch (e) {
      console.error(e);
      notifyAiError(e, "Failed to generate suggestions. Please check your connection and try again.");
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-hld-surface rounded-xl shadow-2xl w-full max-w-3xl border border-hld-border flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-hld-border flex justify-between items-center bg-hld-surface2 rounded-t-xl">
          <h3 className="text-lg font-bold text-hld-text flex items-center gap-2 font-sans">
            <Lightbulb className="text-hld-yellow" size={18} />
            Content Suggestions: <span className="text-hld-cyan font-mono">{sectionTitle}</span>
          </h3>
          <button onClick={onClose} className="text-hld-muted hover:text-hld-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isStale && (
            <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700 rounded-md flex gap-2 items-start">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <div className="text-sm text-amber-400">
                <strong>Document has changed.</strong> These suggestions are based on an older version of your content or goals. 
                <button onClick={handleGenerate} className="ml-2 underline font-semibold hover:text-amber-300">Regenerate</button>
              </div>
            </div>
          )}
          {isThinking ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-sm font-mono uppercase tracking-widest text-hld-muted animate-pulse">Analyzing Content...</p>
              <AgentTraceTicker
                kinds={['getContentSuggestions']}
                className="flex items-center gap-1.5 text-[10px] font-mono text-hld-muted max-w-md min-w-0 px-4"
              />
            </div>
          ) : (
            <div className="prose prose-invert max-w-none font-sans">
              {suggestions ? (
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p className="mb-4 leading-relaxed text-hld-text">{children}</p>,
                    li: ({children}) => <li className="mb-2 text-hld-text">{children}</li>,
                    h1: ({children}) => <h1 className="text-xl font-bold mt-6 mb-4 text-hld-cyan">{children}</h1>,
                    h2: ({children}) => <h2 className="text-lg font-bold mt-5 mb-3 text-hld-cyan">{children}</h2>,
                  }}
                >
                  {suggestions}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <p className="text-center text-hld-muted italic font-sans">No suggestions yet for this section.</p>
                  <button
                    onClick={handleGenerate}
                    className="px-5 py-2 bg-hld-cyan text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-cyan/80 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Sparkles size={14} /> Generate suggestions
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-hld-border bg-hld-surface rounded-b-xl flex justify-between items-center">
           <div className="flex items-center gap-2">
             <Settings size={14} className="text-hld-muted" />
             <ModelPicker value={choice} onChange={(c) => c && setChoice(c)} />
           </div>
           <div className="flex gap-3">
             <button 
               onClick={handleGenerate}
               disabled={isThinking}
               className="px-4 py-2 bg-hld-surface2 border border-hld-border rounded-md text-[10px] font-mono uppercase tracking-widest font-semibold hover:bg-hld-border text-hld-text transition-colors flex items-center gap-2"
             >
               <RefreshCw size={14} className={isThinking ? "animate-spin" : ""} />
               Regenerate
             </button>
             <button 
               onClick={onClose}
               className="px-6 py-2 bg-hld-cyan text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-hld-cyan/80 transition-all active:scale-95"
             >
               Close
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
