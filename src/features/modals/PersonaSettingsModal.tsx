import React, { useState, useRef } from "react";
import { Sparkles, Trash2, Check, Bot, Download, Upload } from "lucide-react";
import { Persona, PromptsConfig } from "../../types";
import { toast } from "sonner";
import { DEFAULT_PROMPTS_CONFIG } from "../../lib/constants";
import { useStore } from "../../store";
import { aiProvider } from "../../services/ai-provider-registry";
import { ModalShell } from "./ModalShell";
import { Disclosure } from "../shared/Disclosure";
import { AiSettingsSection } from "./AiSettingsSection";

interface PersonaSettingsModalProps {
  activePersonaId: string;
  personas: Persona[];
  onSelectPersona: (id: string) => void;
  onAddPersona: (persona: Persona) => void;
  onDeletePersona: (id: string) => void;
  documentContext: string; // Used for generating relevant personas
  promptsConfig?: PromptsConfig;
}

/** One persona as a calm selectable row: square outline avatar, name + role,
 *  cyan check when active, quiet hover-delete for custom personas. */
function PersonaRow({ persona, isActive, onSelect, onDelete }: { persona: Persona; isActive: boolean; onSelect: () => void; onDelete?: () => void }) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex items-center gap-[12px] px-[14px] py-[13px] border text-left transition-colors ${
          isActive ? 'border-hld-cyan/50 bg-hld-cyan/5' : 'border-hld-border hover:border-hld-cyan/40'
        }`}
      >
        <span className={`w-[30px] h-[30px] flex items-center justify-center border shrink-0 ${isActive ? 'border-hld-cyan/40 text-hld-cyan' : 'border-hld-border text-hld-muted-text-2'}`}>
          <Bot size={16} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold text-hld-text truncate">{persona.name}</span>
          <span className="block text-[12px] text-hld-muted-text-2 truncate mt-[2px]">{persona.role}</span>
        </span>
        {isActive && <Check size={16} className="text-hld-cyan shrink-0" />}
      </button>
      {!isActive && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${persona.name}`}
          className="absolute right-[14px] top-1/2 -translate-y-1/2 text-hld-muted hover:text-hld-magenta opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/** Labelled field for the create form (mono eyebrow + full-width control). */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[9px] tracking-[0.12em] uppercase text-hld-muted-text-2 mb-[5px]">{label}</label>
      {children}
    </div>
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create Form State
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newInstruction, setNewInstruction] = useState("");

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

  const inputClass = "w-full p-[9px] bg-[#080d13] border border-hld-border text-hld-text text-[13px] focus:border-hld-cyan outline-none font-sans";

  return (
    <ModalShell
      accent="cyan"
      eyebrow="Evaluator"
      title="Choose a persona"
      onClose={onClose}
      onPrimary={onClose}
      primaryLabel="Use persona"
    >
      <div className="flex flex-col gap-[14px]">
        {/* Primary content: the persona list */}
        <div className="flex flex-col gap-[8px]">
          {personas.map((persona) => (
            <PersonaRow
              key={persona.id}
              persona={persona}
              isActive={persona.id === activePersonaId}
              onSelect={() => onSelectPersona(persona.id)}
              onDelete={persona.id !== 'default' ? () => onDeletePersona(persona.id) : undefined}
            />
          ))}
        </div>

        {/* One quiet link — replaces the glowing auto-generate banner */}
        <button
          type="button"
          onClick={handleGeneratePersonas}
          disabled={isGenerating}
          className="self-start inline-flex items-center gap-[6px] font-mono text-[10px] tracking-[0.1em] uppercase text-hld-muted-text-2 hover:text-hld-cyan disabled:opacity-50 transition-colors"
        >
          {isGenerating ? <span className="animate-spin">✦</span> : <Sparkles size={12} />}
          {isGenerating ? 'Analyzing draft…' : 'Suggest personas from my draft'}
        </button>

        {/* Everything else folds away */}
        <div>
          <Disclosure label="AI model & API key">
            <AiSettingsSection />
          </Disclosure>

          <Disclosure label="Create, import & export">
            <div className="flex flex-col gap-[12px]">
              <Field label="Name">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} placeholder="e.g. The Harsh Critic" />
              </Field>
              <Field label="Role / Tagline">
                <input value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputClass} placeholder="e.g. Senior Editor at Nature" />
              </Field>
              <Field label="System Instruction">
                <textarea value={newInstruction} onChange={(e) => setNewInstruction(e.target.value)} className={`${inputClass} h-28 resize-none font-mono`} placeholder="You are an expert in..." />
              </Field>
              <div className="flex items-center gap-[14px]">
                <button
                  type="button"
                  onClick={handleManualAdd}
                  disabled={!newName || !newInstruction}
                  className="px-[16px] py-[9px] border border-hld-cyan/40 text-hld-cyan font-mono text-[10px] font-bold tracking-[0.12em] uppercase hover:bg-hld-cyan/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Add persona
                </button>
                <span className="w-px h-[16px] bg-hld-border" />
                <button type="button" onClick={handleExport} className="inline-flex items-center gap-[6px] font-mono text-[10px] tracking-[0.1em] uppercase text-hld-muted-text-2 hover:text-hld-cyan transition-colors">
                  <Download size={13} /> Export
                </button>
                <label className="inline-flex items-center gap-[6px] font-mono text-[10px] tracking-[0.1em] uppercase text-hld-muted-text-2 hover:text-hld-cyan cursor-pointer transition-colors">
                  <Upload size={13} /> Import
                  <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />
                </label>
              </div>
            </div>
          </Disclosure>
        </div>
      </div>
    </ModalShell>
  );
};
