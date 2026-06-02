import React, { useState, useRef } from "react";
import { User, Sparkles, Plus, Trash2, Check, X, Bot, Download, Upload, Key } from "lucide-react";
import { Persona, PromptsConfig } from "../../types";
import { toast } from "sonner";
import { DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { useStore } from "../../store";
import { aiProvider, refreshGeminiKey } from "../../services/ai-provider-registry";
import { setSecret } from "../../services/credentials";
import { isTauri } from "../../services/tauri-environment";

interface PersonaSettingsModalProps {
  activePersonaId: string;
  personas: Persona[];
  onSelectPersona: (id: string) => void;
  onAddPersona: (persona: Persona) => void;
  onDeletePersona: (id: string) => void;
  documentContext: string; // Used for generating relevant personas
  promptsConfig?: PromptsConfig;
}

export const PersonaSettingsModal: React.FC<PersonaSettingsModalProps> = ({
  activePersonaId,
  personas,
  onSelectPersona,
  onAddPersona,
  onDeletePersona,
  documentContext,
  promptsConfig = DEFAULT_PROMPTS_CONFIG
}) => {
  const isOpen = useStore(s => s.showPersonaModal);
  const setShow = useStore(s => s.setShowPersonaModal);
  const onClose = () => setShow(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [view, setView] = useState<'list' | 'create'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Create Form State
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newInstruction, setNewInstruction] = useState("");

  // API key field (Phase 4f). The actual stored value lives in the OS
  // keyring; we never read it back into the UI. The user types a new value
  // here only when changing or setting the key.
  const [pendingApiKey, setPendingApiKey] = useState("");
  const [savingApiKey, setSavingApiKey] = useState(false);

  const handleSaveApiKey = async () => {
    if (!pendingApiKey.trim()) return;
    if (!isTauri()) {
      toast.error("API key storage requires the desktop app.");
      return;
    }
    setSavingApiKey(true);
    try {
      await setSecret('gemini', pendingApiKey.trim());
      refreshGeminiKey(pendingApiKey.trim());
      setPendingApiKey("");
      toast.success("Gemini API key saved to OS keyring.");
    } catch (e: any) {
      toast.error(`Failed to save key: ${e?.message || e}`);
    } finally {
      setSavingApiKey(false);
    }
  };

  if (!isOpen) return null;

  const handleGeneratePersonas = async () => {
    setIsGenerating(true);
    try {
      const suggestions = await aiProvider.generatePersonas({
        documentContext,
        config: promptsConfig,
      });
      suggestions.forEach(p => {
        onAddPersona({
          id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: p.name,
          role: p.role,
          instruction: p.instruction,
        });
      });
    } catch (e) {
      console.error("Failed to generate personas", e);
      toast.error("Could not generate personas. Please check your API configuration.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualAdd = () => {
    if (!newName || !newInstruction) return;
    onAddPersona({
      id: `custom-${Date.now()}`,
      name: newName,
      role: newRole || "Custom Role",
      instruction: newInstruction
    });
    setNewName("");
    setNewRole("");
    setNewInstruction("");
    setView('list');
  };

  const handleExport = () => {
    const customPersonas = personas.filter(p => p.id.startsWith('custom-') || p.id.startsWith('gen-'));
    const blob = new Blob([JSON.stringify(customPersonas, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personas.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          imported.forEach((p: any) => {
            if (p.name && p.role && p.instruction) {
              onAddPersona({
                id: p.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: p.name,
                role: p.role,
                instruction: p.instruction
              });
            }
          });
        }
      } catch (err) {
        toast.error("Failed to parse personas file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-hld-surface rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-hld-border flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-hld-border flex justify-between items-center bg-slate-50 dark:bg-hld-surface2 rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-hld-text flex items-center gap-2 font-sans">
              <User size={20} className="text-indigo-500 dark:text-hld-cyan" /> 
              Persona Configuration
            </h3>
            <p className="text-sm text-slate-500 dark:text-hld-muted font-sans">Who is reviewing your work?</p>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-hld-muted hover:text-slate-600 dark:hover:text-hld-text p-2 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'list' ? (
            <div className="space-y-4">
              {/* Gemini API Key (Phase 4f) */}
              <div className="bg-slate-50 dark:bg-hld-surface2 border border-slate-200 dark:border-hld-border rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key size={14} className="text-amber-500 dark:text-hld-yellow" />
                  <h4 className="text-[10px] font-mono uppercase tracking-widest font-bold text-slate-700 dark:text-hld-text">
                    Gemini API Key
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-hld-muted leading-relaxed mb-3 font-sans">
                  Stored in your OS keyring (Windows Credential Manager / macOS
                  Keychain / Linux Secret Service). Falls back to <code className="font-mono">.env.local</code> if unset.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={pendingApiKey}
                    onChange={(e) => setPendingApiKey(e.target.value)}
                    placeholder="Paste a new key to set or replace"
                    disabled={savingApiKey}
                    className="flex-1 p-2 text-[12px] font-mono border border-slate-300 dark:border-hld-border rounded bg-white dark:bg-hld-bg text-slate-700 dark:text-hld-text focus:outline-none focus:border-indigo-500 dark:focus:border-hld-cyan disabled:opacity-50"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!pendingApiKey.trim() || savingApiKey}
                    className="px-3 py-2 bg-indigo-600 dark:bg-hld-cyan text-white dark:text-hld-bg rounded text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingApiKey ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Generator Banner */}
              <div className="bg-indigo-50 dark:bg-hld-cyan/10 border border-indigo-100 dark:border-hld-cyan/30 rounded-lg p-4 flex items-center justify-between mb-6">
                 <div>
                   <h4 className="font-semibold text-indigo-900 dark:text-hld-cyan text-sm font-sans">Need the perfect editor?</h4>
                   <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-700 dark:text-hld-cyan/70 mt-1">AI can analyze your text and suggest bespoke personas.</p>
                 </div>
                 <button 
                   onClick={handleGeneratePersonas}
                   disabled={isGenerating}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-hld-cyan text-white dark:text-hld-bg text-[10px] font-mono font-bold uppercase tracking-widest rounded-md shadow-sm hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 disabled:opacity-50 transition-all hld-glow-cyan"
                 >
                   {isGenerating ? <span className="animate-spin">✨</span> : <Sparkles size={14} />}
                   {isGenerating ? "Analyzing..." : "Auto-Generate"}
                 </button>
              </div>

              <div className="grid gap-3">
                {personas.map(persona => {
                  const isActive = persona.id === activePersonaId;
                  return (
                    <div 
                      key={persona.id}
                      onClick={() => onSelectPersona(persona.id)}
                      className={`group relative p-4 rounded-lg border cursor-pointer transition-all ${
                        isActive 
                          ? 'border-indigo-500 dark:border-hld-cyan bg-indigo-50/50 dark:bg-hld-cyan/10 ring-1 ring-indigo-500 dark:ring-hld-cyan' 
                          : 'border-slate-200 dark:border-hld-border hover:border-indigo-300 dark:hover:border-hld-cyan/50 bg-white dark:bg-hld-surface'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-full ${isActive ? 'bg-indigo-100 dark:bg-hld-cyan/20 text-indigo-600 dark:text-hld-cyan' : 'bg-slate-100 dark:bg-hld-surface2 text-slate-500 dark:text-hld-muted'}`}>
                             <Bot size={20} />
                           </div>
                           <div>
                             <div className="font-bold text-slate-800 dark:text-hld-text text-sm font-sans">{persona.name}</div>
                             <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-hld-muted font-medium">{persona.role}</div>
                           </div>
                        </div>
                        {isActive && <Check size={18} className="text-indigo-500 dark:text-hld-cyan" />}
                        {!isActive && persona.id !== 'default' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeletePersona(persona.id); }}
                            className="text-slate-300 dark:text-hld-muted hover:text-rose-500 dark:hover:text-hld-magenta opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-slate-600 dark:text-hld-muted bg-slate-50 dark:bg-hld-bg p-2 rounded font-mono border border-slate-100 dark:border-hld-border line-clamp-2">
                        {persona.instruction}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-hld-muted mb-1">Name</label>
                <input 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-hld-border rounded bg-transparent dark:text-hld-text focus:border-hld-cyan focus:ring-1 focus:ring-hld-cyan outline-none font-sans"
                  placeholder="e.g. The Harsh Critic"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-hld-muted mb-1">Role / Tagline</label>
                <input 
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-hld-border rounded bg-transparent dark:text-hld-text focus:border-hld-cyan focus:ring-1 focus:ring-hld-cyan outline-none font-sans"
                  placeholder="e.g. Senior Editor at Nature"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-hld-muted mb-1">System Instruction</label>
                <textarea 
                  value={newInstruction}
                  onChange={e => setNewInstruction(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-hld-border rounded bg-transparent dark:text-hld-text h-32 focus:border-hld-cyan focus:ring-1 focus:ring-hld-cyan outline-none font-mono text-sm"
                  placeholder="You are an expert in..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-hld-border bg-slate-50 dark:bg-hld-surface2 rounded-b-xl flex justify-between">
          {view === 'list' ? (
             <div className="flex items-center gap-4">
               <button 
                 onClick={() => setView('create')}
                 className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-indigo-600 dark:text-hld-cyan hover:text-indigo-800 dark:hover:text-hld-cyan/80 transition-colors"
               >
                 <Plus size={16} /> Create Custom
               </button>
               <div className="h-4 w-px bg-slate-300 dark:bg-hld-border"></div>
               <button 
                 onClick={handleExport}
                 className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-slate-600 dark:text-hld-muted hover:text-slate-800 dark:hover:text-hld-text transition-colors"
               >
                 <Download size={16} /> Export
               </button>
               <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-semibold text-slate-600 dark:text-hld-muted hover:text-slate-800 dark:hover:text-hld-text cursor-pointer transition-colors">
                 <Upload size={16} /> Import
                 <input 
                   type="file" 
                   accept=".json" 
                   className="hidden" 
                   ref={fileInputRef}
                   onChange={handleImport} 
                 />
               </label>
             </div>
          ) : (
             <button 
               onClick={() => setView('list')}
               className="text-[10px] font-mono uppercase tracking-widest font-semibold text-slate-500 dark:text-hld-muted hover:text-slate-800 dark:hover:text-hld-text transition-colors"
             >
               Back to list
             </button>
          )}

          <div className="flex gap-2">
            {view === 'create' && (
              <button 
                onClick={handleManualAdd}
                className="px-4 py-2 bg-indigo-600 dark:bg-hld-cyan text-white dark:text-hld-bg rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow hover:bg-indigo-700 dark:hover:bg-hld-cyan/80 transition-colors hld-glow-cyan"
              >
                Add Persona
              </button>
            )}
            {view === 'list' && (
              <button onClick={onClose} className="px-4 py-2 bg-white dark:bg-hld-surface border border-slate-200 dark:border-hld-border rounded-md text-[10px] font-mono uppercase tracking-widest font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-hld-border text-slate-700 dark:text-hld-text transition-colors">
                Done
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};