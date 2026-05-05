import React, { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { Sparkles, X, Lightbulb, MessageSquare, ArrowRight, RefreshCw, Settings, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { computeHash } from "../../lib/utils";
import { PromptsConfig } from "../../types";
import { DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";

const MODELS = [
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini Flash Lite',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
  }
];

interface ContentSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  isOpen,
  onClose,
  sectionTitle,
  currentGoals,
  fullSectionContent,
  parentGoals,
  sectionId,
  cachedSuggestions,
  onSaveCache,
  promptsConfig = DEFAULT_PROMPTS_CONFIG
}) => {
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3.1-flash-lite-preview');
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
        setSuggestions(null);
        handleGenerate();
      }
    }
  }, [isOpen, sectionTitle, currentGoals, fullSectionContent, parentGoals, cachedSuggestions]);

  const handleGenerate = async () => {
    setIsThinking(true);
    setIsStale(false);
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
${promptsConfig.suggestContentPrompt}

CONTEXT:
Section Title: "${sectionTitle}"
Parent Section Goals: "${parentGoals || 'N/A'}"
Section Goals: "${currentGoals}"
Current Content:
---
${fullSectionContent.slice(0, 5000)}
---
      `;

      const response = await ai.models.generateContent({
        model: selectedModelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      
      const text = response.text;
      setSuggestions(text);
      if (onSaveCache && text) {
        onSaveCache(sectionId, currentInputHash, text);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate suggestions. Please check your connection and API key.");
      setSuggestions("Failed to generate suggestions. Please check your connection and try again.");
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-hld-surface rounded-xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-hld-border flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-slate-100 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-hld-surface2 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-800 dark:text-hld-text flex items-center gap-2 font-sans">
            <Lightbulb className="text-amber-500 dark:text-hld-yellow" size={18} />
            Content Suggestions: <span className="text-indigo-600 dark:text-hld-cyan font-mono">{sectionTitle}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 dark:text-hld-muted hover:text-slate-600 dark:hover:text-hld-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isStale && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md flex gap-2 items-start">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
              <div className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Document has changed.</strong> These suggestions are based on an older version of your content or goals. 
                <button onClick={handleGenerate} className="ml-2 underline font-semibold hover:text-amber-800 dark:hover:text-amber-300">Regenerate</button>
              </div>
            </div>
          )}
          {isThinking ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-sm font-mono uppercase tracking-widest text-slate-500 dark:text-hld-muted animate-pulse">Analyzing Content...</p>
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none font-sans">
              {suggestions ? (
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p className="mb-4 leading-relaxed text-slate-700 dark:text-hld-text">{children}</p>,
                    li: ({children}) => <li className="mb-2 text-slate-700 dark:text-hld-text">{children}</li>,
                    h1: ({children}) => <h1 className="text-xl font-bold mt-6 mb-4 text-indigo-600 dark:text-hld-cyan">{children}</h1>,
                    h2: ({children}) => <h2 className="text-lg font-bold mt-5 mb-3 text-indigo-600 dark:text-hld-cyan">{children}</h2>,
                  }}
                >
                  {suggestions}
                </ReactMarkdown>
              ) : (
                <p className="text-center text-slate-400 dark:text-hld-muted py-10 italic">No suggestions available.</p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-hld-border bg-slate-50 dark:bg-hld-surface rounded-b-xl flex justify-between items-center">
           <div className="flex items-center gap-2">
             <Settings size={14} className="text-slate-400 dark:text-hld-muted" />
             <select 
               value={selectedModelId}
               onChange={(e) => setSelectedModelId(e.target.value)}
               className="bg-white dark:bg-hld-surface2 border border-slate-200 dark:border-hld-border rounded px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-600 dark:text-hld-text outline-none focus:border-indigo-500 dark:focus:border-hld-cyan"
             >
               {MODELS.map(m => (
                 <option key={m.id} value={m.id}>{m.name}</option>
               ))}
             </select>
           </div>
           <div className="flex gap-3">
             <button 
               onClick={handleGenerate}
               disabled={isThinking}
               className="px-4 py-2 bg-white dark:bg-hld-surface2 border border-slate-200 dark:border-hld-border rounded-md text-[10px] font-mono uppercase tracking-widest font-semibold hover:bg-slate-50 dark:hover:bg-hld-border text-slate-700 dark:text-hld-text transition-colors flex items-center gap-2"
             >
               <RefreshCw size={14} className={isThinking ? "animate-spin" : ""} />
               Regenerate
             </button>
             <button 
               onClick={onClose}
               className="px-6 py-2 bg-indigo-600 dark:bg-hld-cyan text-white dark:text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 transition-all active:scale-95"
             >
               Close
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
