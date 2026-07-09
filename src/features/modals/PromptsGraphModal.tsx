import React, { useState } from 'react';
import { PromptsConfig } from '../../types';
import { X, Network, Save, RotateCcw } from 'lucide-react';
import { DEFAULT_PROMPTS_CONFIG } from '../../lib/constants';
import { ConfirmModal } from './ConfirmModal';
import { useStore } from '../../store';

interface PromptsGraphModalProps {
  promptsConfig: PromptsConfig;
  setPromptsConfig: (config: PromptsConfig) => void;
}

export const PromptsGraphModal: React.FC<PromptsGraphModalProps> = ({
  promptsConfig,
  setPromptsConfig
}) => {
  const isOpen = useStore(s => s.showPromptsGraphModal);
  const setShow = useStore(s => s.setShowPromptsGraphModal);
  const onClose = () => setShow(false);
  const [localConfig, setLocalConfig] = useState<PromptsConfig>(promptsConfig);
  const [selectedNode, setSelectedNode] = useState<keyof PromptsConfig | null>(null);
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({isOpen: false, message: '', onConfirm: () => {}});

  if (!isOpen) return null;

  const handleSave = () => {
    setPromptsConfig(localConfig);
    onClose();
  };

  const handleReset = () => {
    setConfirmState({
      isOpen: true,
      message: "Are you sure you want to reset all prompts to defaults?",
      onConfirm: () => {
        setLocalConfig(DEFAULT_PROMPTS_CONFIG);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const Node = ({ id, label, color, type }: { id: keyof PromptsConfig, label: string, color: string, type: 'input'|'process'|'output' }) => {
    const isSelected = selectedNode === id;
    return (
      <div 
        onClick={() => setSelectedNode(id)}
        className={`
          relative cursor-pointer transition-all duration-200 p-3 flex flex-col items-center justify-center
          border-2 font-mono text-[10px] uppercase tracking-widest w-full text-center
          ${isSelected ? `bg-${color}-500/20 border-${color}-400 text-${color}-300 shadow-[0_0_15px_rgba(var(--tw-colors-${color}-500),0.5)]` 
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}
        `}
      >
        <span className={isSelected ? 'font-bold' : ''}>{label}</span>
      </div>
    );
  };

  const nodeLabels: Record<keyof PromptsConfig, string> = {
    systemInstruction: 'SYS INSTRUCTION',
    l1TaskInstruction: 'L1 TASK ESTIMATOR',
    subTaskInstruction: 'SUB TASK ESTIMATOR',
    refineSpecPrompt: 'SPEC REFINER',
    diagnosticInstruction: 'DIAGNOSTIC ENGINE',
    coachPrompt: 'COACH DIAGNOSTIC',
    generatePersonasPrompt: 'PERSONA GENERATOR',
    suggestContentPrompt: 'CONTENT SUGGESTER',
    dependenciesPrompt: 'DEPENDENCY ESTIMATOR',
    analysisPrompt: 'ANALYSIS ENGINE',
    refactorAnalysisPrompt: 'REFACTOR SYNTHESIZER',
    dialoguePrompt: 'SOCRATIC PARTNER',
  };

  const nodeDescriptions: Record<keyof PromptsConfig, string> = {
    systemInstruction: "Core personality and behavioral constraints for the specification engine.",
    l1TaskInstruction: "Instructions for analyzing top-level document sections and generating their structural specs.",
    subTaskInstruction: "Instructions for inheriting constraints from parent sections and specifying sub-tasks.",
    refineSpecPrompt: "The refinement rules used when manually adjusting a section's specification.",
    diagnosticInstruction: "Core instructions for assessing a section against its structured specification.",
    coachPrompt: "The diagnostic framework used by the ADHD Coach to formulate actionable writing plans.",
    generatePersonasPrompt: "The creative engine that generates AI reviewer personas based on document sampling.",
    suggestContentPrompt: "The ghostwriter persona used when generating specific content suggestions based on section specs.",
    dependenciesPrompt: "Logic for identifying structural prerequisites and references between different document sections.",
    analysisPrompt: "Shared output contract for analysis: the JSON schema every analytical lens fills (thesis, concepts, premises, conclusion, objections). The lenses themselves are built-in.",
    refactorAnalysisPrompt: "Synthesizes a Socratic dialogue back into a refined analysis version.",
    dialoguePrompt: "The Socratic partner persona that interrogates parts of an analysis with the author.",
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/90 backdrop-blur-sm shadow-2xl p-6 font-sans">
      <div className="flex w-full h-full border-2 border-hld-border bg-hld-bg relative overflow-hidden">
        
        {/* Graph Area */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0f14] to-black">
          {/* Background grid */}
          <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#00e8f5 1px, transparent 1px), linear-gradient(90deg, #00e8f5 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          
          <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
            <Network className="text-hld-cyan" size={24} />
            <h2 className="text-xl font-bold text-slate-100 font-mono tracking-widest uppercase text-shadow-hld">Signal Routing Map</h2>
          </div>

          {/* Schematic Graph representing data flows */}
          <div className="z-10 flex flex-col items-center gap-8 select-none relative w-full max-w-4xl mt-12">
            <div className="text-hld-muted font-mono text-[10px] uppercase tracking-widest absolute -top-8">Data Source</div>
            <div className="w-full max-w-3xl py-4 border-2 border-slate-700 flex items-center justify-center bg-slate-900 text-slate-400 font-mono text-sm tracking-widest shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20 relative">
               MASTER DOCUMENT REPOSITORY
            </div>

            {/* 4 Pillars */}
            <div className="grid grid-cols-4 gap-8 w-full max-w-3xl relative mt-12">
              {/* Connecting lines via SVG */}
              <svg className="absolute -top-[50px] left-0 w-full h-[600px] pointer-events-none stroke-slate-700 stroke-2 fill-none" style={{ zIndex: 0 }}>
                 {/* Hub to 4 pillars */}
                 <path d="M 384 0 L 384 40 L 84 40 L 84 60" />
                 <path d="M 384 0 L 384 40 L 284 40 L 284 60" />
                 <path d="M 384 0 L 384 40 L 484 40 L 484 60" />
                 <path d="M 384 0 L 384 40 L 684 40 L 684 60" />
                 
                 {/* Pillar 1 lines (Structural — 4 nodes) */}
                 <path d="M 84 120 L 84 140" />
                 <path d="M 84 200 L 84 220" />
                 <path d="M 84 280 L 84 300" />
                 
                 {/* Pillar 2 lines (Diagnostic — 3 nodes) */}
                 <path d="M 284 120 L 284 140" />
                 <path d="M 284 200 L 284 220" />
                 
                 {/* Pillar 3 lines (Generative — 2 nodes) */}
                 <path d="M 484 120 L 484 140" />

                 {/* Pillar 4 lines (Exegesis — 3 nodes) */}
                 <path d="M 684 120 L 684 140" />
                 <path d="M 684 200 L 684 220" />
              </svg>

              {/* Structural Specification */}
              <div className="flex flex-col gap-6 w-full z-10 relative">
                <div className="text-center text-emerald-500/70 font-mono text-[10px] uppercase tracking-widest mb-2 border-b border-emerald-500/30 pb-2">Structural Interpolation</div>
                <Node id="systemInstruction" label="System Instruction" color="emerald" type="process" />
                <Node id="l1TaskInstruction" label="L1 Task Specifier" color="emerald" type="process" />
                <Node id="subTaskInstruction" label="Sub-Task Specifier" color="emerald" type="process" />
                <Node id="refineSpecPrompt" label="Spec Refiner" color="emerald" type="process" />
              </div>

              {/* Diagnostics & Review */}
              <div className="flex flex-col gap-6 w-full z-10 relative">
                <div className="text-center text-amber-500/70 font-mono text-[10px] uppercase tracking-widest mb-2 border-b border-amber-500/30 pb-2">Diagnostic & Coaching</div>
                <Node id="generatePersonasPrompt" label="Persona Engine" color="amber" type="process" />
                <Node id="diagnosticInstruction" label="Diagnostic Engine" color="amber" type="process" />
                <Node id="coachPrompt" label="Coach Evaluation" color="amber" type="process" />
              </div>

              {/* Generative Utilities */}
              <div className="flex flex-col gap-6 w-full z-10 relative">
                <div className="text-center text-purple-500/70 font-mono text-[10px] uppercase tracking-widest mb-2 border-b border-purple-500/30 pb-2">Generative Inference</div>
                <Node id="suggestContentPrompt" label="Content Suggester" color="purple" type="process" />
                <Node id="dependenciesPrompt" label="Dependency Estimator" color="purple" type="process" />
              </div>

              {/* Exegesis & Dialogue */}
              <div className="flex flex-col gap-6 w-full z-10 relative">
                <div className="text-center text-cyan-500/70 font-mono text-[10px] uppercase tracking-widest mb-2 border-b border-cyan-500/30 pb-2">Exegesis & Dialogue</div>
                <Node id="analysisPrompt" label="Analysis Engine" color="cyan" type="process" />
                <Node id="dialoguePrompt" label="Socratic Partner" color="cyan" type="process" />
                <Node id="refactorAnalysisPrompt" label="Refactor Synthesizer" color="cyan" type="process" />
              </div>
            </div>

          </div>
        </div>

        {/* Editor Sidebar */}
        <div className="w-[480px] bg-slate-900 border-l border-hld-border flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between p-4 border-b border-hld-border bg-slate-800">
            <h3 className="text-hld-text font-mono text-[12px] uppercase tracking-widest">Signal Configurator</h3>
            <div className="flex items-center gap-2">
              <button onClick={handleReset} className="text-hld-muted hover:text-amber-400" title="Reset to Defaults"><RotateCcw size={16} /></button>
              <button onClick={handleSave} className="text-hld-cyan hover:text-white" title="Save Configuration"><Save size={16} /></button>
              <button onClick={onClose} className="text-hld-muted hover:text-hld-magenta ml-2"><X size={20} /></button>
            </div>
          </div>
          
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
            {!selectedNode ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-[12px] uppercase tracking-widest text-center">
                <Network className="w-12 h-12 mb-4 opacity-50 text-slate-600" />
                Select a node from the routing map <br/>to configure its signal prompt.
              </div>
            ) : (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-slate-100 font-mono text-sm tracking-widest uppercase">{nodeLabels[selectedNode]}</h4>
                  <span className="text-[10px] px-2 py-1 bg-black text-hld-cyan font-mono border border-hld-cyan/30 rounded">ACTIVE</span>
                </div>
                <div className="text-[11px] text-slate-400 mb-4 font-sans leading-relaxed">
                  {nodeDescriptions[selectedNode]}
                </div>
                <textarea
                  value={localConfig[selectedNode]}
                  onChange={e => setLocalConfig(prev => ({ ...prev, [selectedNode]: e.target.value }))}
                  className="flex-1 w-full bg-[#05080f] text-[#00e8f5] font-mono text-[13px] p-4 border border-hld-border focus:border-[#00e8f5] focus:outline-none focus:ring-1 focus:ring-[#00e8f5] focus:shadow-[0_0_15px_rgba(0,232,245,0.2)] resize-none rounded-sm selection:bg-[#00e8f5] selection:text-black leading-relaxed shadow-inner"
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
