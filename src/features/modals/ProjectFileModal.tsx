import React, { useState, useEffect, useMemo } from 'react';
import { X, Code, FileText, CheckCircle, Save, Layers, Hash, AlertTriangle, FileJson } from 'lucide-react';
import { Section, TestSuite, PromptsConfig, Persona } from '../../types';
import { StructuredJsonEditor } from './StructuredJsonEditor';
import { useStore } from '../../store';

interface ProjectFileModalProps {
  sections: Section[];
  testSuite: TestSuite;
  projectName: string;
  markdown: string;
  promptsConfig: PromptsConfig;
  customPersonas: Persona[];
  onSaveData: (data: { testSuite: TestSuite; projectName: string; promptsConfig?: PromptsConfig; customPersonas?: Persona[] }) => void;
}

export const ProjectFileModal: React.FC<ProjectFileModalProps> = ({
  sections,
  testSuite,
  projectName,
  markdown,
  promptsConfig,
  customPersonas,
  onSaveData
}) => {
  const isOpen = useStore(s => s.showProjectFileModal);
  const setShow = useStore(s => s.setShowProjectFileModal);
  const onClose = () => setShow(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'section'>('overview');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  
  // Local state for editing
  const [localTitle, setLocalTitle] = useState(projectName);
  const [localTestSuite, setLocalTestSuite] = useState<TestSuite>(testSuite);
  const [localPrompts, setLocalPrompts] = useState<PromptsConfig>(promptsConfig);
  const [localPersonas, setLocalPersonas] = useState<Persona[]>(customPersonas);

  const [rawJsonStr, setRawJsonStr] = useState("");
  const [jsonError, setJsonError] = useState("");

  // When modal opens or props update globally, sync local state
  useEffect(() => {
    if (isOpen) {
      setLocalTitle(projectName);
      setLocalTestSuite(JSON.parse(JSON.stringify(testSuite))); // deep clone
      setLocalPrompts(JSON.parse(JSON.stringify(promptsConfig)));
      setLocalPersonas(JSON.parse(JSON.stringify(customPersonas)));
      if (!selectedSectionId && sections.length > 0) {
        setSelectedSectionId(sections[0].id);
      }
    }
  }, [isOpen, testSuite, projectName, promptsConfig, customPersonas]);

  // Sync raw json when overview tab is opened or dependencies change
  useEffect(() => {
    if (activeTab === 'overview') {
      const obj = {
        projectName: localTitle,
        testSuite: localTestSuite,
        promptsConfig: localPrompts,
        customPersonas: localPersonas
      };
      setRawJsonStr(JSON.stringify(obj, null, 2));
      setJsonError("");
    }
  }, [activeTab, localTitle, localTestSuite, localPrompts, localPersonas]);

  const tokenCount = Math.ceil(markdown.length / 4);

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(rawJsonStr);
      if (parsed.projectName) setLocalTitle(parsed.projectName);
      if (parsed.testSuite) setLocalTestSuite(parsed.testSuite);
      if (parsed.promptsConfig) setLocalPrompts(parsed.promptsConfig);
      if (parsed.customPersonas) setLocalPersonas(parsed.customPersonas);
      setJsonError("Applied locally — click Save to persist.");
      setTimeout(() => setJsonError(""), 3000);
    } catch (e) {
      setJsonError("Invalid JSON structure.");
    }
  };

  const handleSave = () => {
    onSaveData({
      testSuite: localTestSuite,
      projectName: localTitle,
      promptsConfig: localPrompts,
      customPersonas: localPersonas
    });
    onClose();
  };

  const handleUpdateSectionGoal = (sectionId: string, goals: string) => {
    setLocalTestSuite(prev => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        goals
      }
    }));
  };

  const flattenSections = (nodes: Section[]): Section[] => {
    let result: Section[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.children) {
        result = result.concat(flattenSections(node.children));
      }
    });
    return result;
  };
  const allSections = useMemo(() => flattenSections(sections), [sections]);
  const activeSection = allSections.find(s => s.id === selectedSectionId) || null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
       <div className="bg-[#0b0c10] border border-cyan-800 shadow-[0_0_20px_rgba(34,211,238,0.2)] w-[95vw] h-[95vh] rounded-xl flex flex-col overflow-hidden relative">
          
          {/* Tech HUD Decals */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/40 pointer-events-none rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none rounded-br-xl" />

          {/* Header */}
          <div className="p-4 border-b border-cyan-900/50 bg-[#12141c] flex justify-between items-center shrink-0 z-10">
             <div>
               <h2 className="text-xl font-bold text-cyan-50 flex items-center gap-2">
                 <Code size={20} className="text-cyan-400" /> Project File Editor (JSON Root)
               </h2>
               <p className="text-xs uppercase tracking-widest text-cyan-500/70 font-mono mt-1">Full State Representation</p>
             </div>
             
             <div className="flex bg-[#0b0c10] p-1 rounded-lg border border-cyan-900/30">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className={`p-1.5 px-3 rounded flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors ${activeTab === 'overview' ? 'bg-cyan-900/50 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-500 hover:text-cyan-400/80'}`}
                >
                  <FileJson size={14} /> JSON Root
                </button>
                <button 
                  onClick={() => setActiveTab('section')}
                  className={`p-1.5 px-3 rounded flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors ${activeTab === 'section' ? 'bg-cyan-900/50 text-cyan-300 font-bold border border-cyan-500/30' : 'text-slate-500 hover:text-cyan-400/80'}`}
                >
                  <FileText size={14} /> Section Focus
                </button>
             </div>

             <div className="flex items-center gap-3">
                <div className="flex flex-col items-end mr-4">
                  <span className="text-[10px] uppercase text-slate-500 font-mono tracking-widest">Global Tokens</span>
                  <span className="text-sm text-cyan-400 font-mono font-bold flex items-center gap-1">
                    <Hash size={12} /> {tokenCount.toLocaleString()}
                  </span>
                </div>
                <button 
                  onClick={handleSave}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 px-4 rounded font-mono text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                >
                  <Save size={14} /> Save Globally
                </button>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
             </div>
          </div>

          <div className="flex-1 flex overflow-hidden bg-[#0b0c10] relative z-0">
             {/* Subtle Grid Background */}
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

             {activeTab === 'overview' && (
               <div className="flex-1 flex flex-col p-6 font-mono text-sm relative z-10">
                 <div className="w-full h-full flex-1 flex flex-col">
                   <div className="flex items-start justify-between mb-4">
                     <div className="flex items-start gap-3 p-3 rounded bg-cyan-900/10 border border-cyan-500/20 text-cyan-400/80 text-xs w-full">
                       <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                       <p>Edit the underlying project state directly here. Ensure structural integrity of the JSON object. Click 'Apply Local JSON' to validate and preview changes locally before saving globally.</p>
                     </div>
                   </div>
                   
                   <div className="flex-1 flex flex-col bg-[#12141c] border border-slate-800 rounded-lg shadow-2xl overflow-y-auto overflow-x-hidden relative">
                     <div className="p-4 w-full">
                        <StructuredJsonEditor 
                           data={{
                             projectName: localTitle,
                             testSuite: localTestSuite,
                             promptsConfig: localPrompts,
                             customPersonas: localPersonas
                           }}
                           onChange={(newData: any) => {
                             if (newData.projectName !== undefined) setLocalTitle(newData.projectName);
                             if (newData.testSuite !== undefined) setLocalTestSuite(newData.testSuite);
                             if (newData.promptsConfig !== undefined) setLocalPrompts(newData.promptsConfig);
                             if (newData.customPersonas !== undefined) setLocalPersonas(newData.customPersonas);
                           }}
                        />
                     </div>
                   </div>
                 </div>
               </div>
             )}

             {activeTab === 'section' && (
               <div className="flex-1 flex w-full relative z-10">
                 {/* Sidebar */}
                 <div className="w-1/3 border-r border-slate-800/80 flex flex-col bg-[#0f1118]">
                    <div className="p-3 border-b border-slate-800/80 bg-[#161820]">
                      <h3 className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Document Sections</h3>
                    </div>
                    <div className="flex-1 overflow-auto p-2 space-y-1">
                      {allSections.map(sec => (
                        <div 
                           key={sec.id}
                           onClick={() => setSelectedSectionId(sec.id)}
                           className={`p-2 rounded cursor-pointer text-xs font-mono transition-all border ${selectedSectionId === sec.id ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-200' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-300'}`}
                           style={{ paddingLeft: `${Math.max(0.5, sec.level * 1)}rem` }}
                        >
                           <span className="opacity-50 mr-2">H{sec.level}</span>
                           <span className="break-words">{sec.title || `Section ${sec.id.split('-').pop()}`}</span>
                        </div>
                      ))}
                    </div>
                 </div>

                 {/* Main Column */}
                 <div className="w-2/3 flex flex-col bg-[#0b0c10] overflow-auto">
                    {activeSection ? (
                      <div className="p-6 w-full">
                         <div className="mb-6 pb-4 border-b border-slate-800">
                           <h3 className="font-sans text-xl font-bold text-white mb-2">{activeSection.title}</h3>
                           <div className="flex gap-4 font-mono text-[10px] uppercase tracking-widest text-cyan-500/60">
                             <span>Words: {activeSection.wordCount}</span>
                             <span>Lines: {activeSection.startLine}-{activeSection.endLine}</span>
                           </div>
                         </div>

                         <div className="mb-8">
                           <label className="block text-[10px] text-cyan-400 uppercase tracking-widest font-bold mb-2">Section Content (Read-Only context)</label>
                           <div className="bg-[#12141c] border border-slate-800 rounded p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto shadow-inner">
                              {activeSection.fullContent || "(Empty)"}
                           </div>
                         </div>

                         <div className="space-y-6">
                            <div>
                               <label className="block text-[10px] text-[#ff007f] uppercase tracking-widest font-bold mb-2">Section Goal / Spec (Editable)</label>
                               <textarea 
                                 className="w-full bg-[#161820] border border-slate-700/50 rounded p-4 text-sm text-slate-200 font-mono focus:border-[#ff007f] focus:outline-none focus:ring-1 focus:ring-[#ff007f] transition-all min-h-[120px]"
                                 value={localTestSuite[activeSection.id]?.goals || ''}
                                 onChange={(e) => handleUpdateSectionGoal(activeSection.id, e.target.value)}
                                 placeholder="Enter goals for this specific section..."
                               />
                            </div>
                            
                            {localTestSuite[activeSection.id]?.spec ? (
                              <div className="p-4 border border-fuchsia-900/40 bg-fuchsia-950/10 rounded">
                                <h4 className="text-[10px] text-fuchsia-400 uppercase font-mono tracking-widest mb-3">Structured Spec Data</h4>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-xs font-mono text-slate-400 mb-1">Function</label>
                                    <div className="text-sm font-mono text-slate-300 bg-[#0b0c10] p-2 rounded border border-slate-800">{localTestSuite[activeSection.id]?.spec?.function}</div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-mono text-slate-400 mb-1">Main Claim</label>
                                    <div className="text-sm font-mono text-slate-300 bg-[#0b0c10] p-2 rounded border border-slate-800">{localTestSuite[activeSection.id]?.spec?.mainClaim}</div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-mono text-slate-400 mb-1">Required Moves</label>
                                    <div className="text-sm font-mono text-slate-300 bg-[#0b0c10] p-2 rounded border border-slate-800 space-y-2">
                                      {localTestSuite[activeSection.id]?.spec?.requiredMoves?.map(move => (
                                         <div key={move.id} className="p-1.5 bg-slate-900/50 rounded text-xs border border-slate-700/50">
                                            <span className="text-fuchsia-400 mr-2">[{move.id}]</span> {move.description}
                                         </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs font-mono text-slate-400 mb-1">Incoming Context</label>
                                      <div className="text-xs font-mono text-slate-300 bg-[#0b0c10] p-2 rounded border border-slate-800 h-24 overflow-auto">
                                        {localTestSuite[activeSection.id]?.spec?.incomingContext?.map((ctx, i) => (
                                          <div key={i} className="mb-1 pb-1 border-b border-slate-800/50 last:border-0 opacity-80">• {ctx}</div>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-mono text-slate-400 mb-1">Outgoing Commitments</label>
                                      <div className="text-xs font-mono text-slate-300 bg-[#0b0c10] p-2 rounded border border-slate-800 h-24 overflow-auto">
                                        {localTestSuite[activeSection.id]?.spec?.outgoingCommitments?.map((ctx, i) => (
                                          <div key={i} className="mb-1 pb-1 border-b border-slate-800/50 last:border-0 opacity-80">• {ctx}</div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 border border-slate-800 bg-slate-900/20 rounded text-slate-500 font-mono text-xs uppercase tracking-widest flex items-center justify-center">
                                No Structured Spec Exists
                              </div>
                            )}
                         </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs uppercase tracking-widest">
                        Select a section from the hierarchy
                      </div>
                    )}
                 </div>
               </div>
             )}
          </div>
       </div>
    </div>
  );
};
