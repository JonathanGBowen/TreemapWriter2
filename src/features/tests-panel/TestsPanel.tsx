import React from "react";
import { CheckCircle, Layout, MessagesSquare, Network, Settings } from "lucide-react";
import { useStore } from "../../state";
import { useCurrentSection } from "./use-current-section";
import { SpecTab } from "./SpecTab";
import { AnalysisTab } from "./AnalysisTab";
import { DialogueTab } from "./DialogueTab";
import { PersonaBanner } from "./PersonaBanner";

const TABS = [
  { id: 'spec', label: 'Spec', icon: CheckCircle },
  { id: 'analysis', label: 'Analysis', icon: Network },
  { id: 'dialogue', label: 'Dialogue', icon: MessagesSquare },
] as const;

const startResize = (e: React.MouseEvent, startWidth: number, setWidth: (w: number) => void) => {
  e.preventDefault();
  const startX = e.clientX;
  const handleMouseMove = (e: MouseEvent) => {
    const delta = startX - e.clientX;
    setWidth(Math.max(280, Math.min(startWidth + delta, 800)));
  };
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  };
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.cursor = 'col-resize';
};

/**
 * The right panel shell: resize handle, header, and the Spec | Analysis |
 * Dialogue tab strip. Each tab owns its content (and assumes a section is
 * selected — the shell renders the shared empty state otherwise).
 */
export const TestsPanel: React.FC = () => {
  const width = useStore(s => s.testsPanelWidth);
  const setWidth = useStore(s => s.setTestsPanelWidth);
  const tab = useStore(s => s.testsPanelTab);
  const setTab = useStore(s => s.setTestsPanelTab);
  const testSuite = useStore(s => s.testSuite);
  const setShowPersonaModal = useStore(s => s.setShowPersonaModal);

  const currentSection = useCurrentSection();

  // Indicator: an in-progress dialogue exists for the selected section.
  const analysisState = currentSection ? testSuite[currentSection.id]?.analysis : undefined;
  const dialogueActive =
    !!analysisState && (analysisState.dialogue.length > 0 || !!analysisState.dialogueContext);

  const activeTab = TABS.find(t => t.id === tab) ?? TABS[0];
  const ActiveIcon = activeTab.icon;

  return (
    <div
      style={{ width }}
      className="tests-panel-step h-full flex-none relative border-l border-hld-border bg-[#080d13] flex flex-col shadow-sm z-10 transition-colors duration-200"
    >
      {/* Resize Handle */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-hld-cyan/50 hover:w-2 transition-all duration-150 z-50 -translate-x-1/2"
        onMouseDown={(e) => startResize(e, width, setWidth)}
      />

      {/* Header */}
      <div className="p-[10px_14px] border-b border-hld-border bg-[#080d13] flex justify-between items-center relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-hld-magenta shadow-[0_0_12px_var(--tw-colors-hld-magenta)]" />
        <h2 className="font-mono uppercase tracking-[0.15em] text-[8px] font-bold text-hld-text flex items-center gap-2">
          <ActiveIcon size={13} className="text-hld-cyan" />
          {tab === 'spec' ? (
            <span>Spec <span className="text-hld-cyan">&</span> Diagnostic</span>
          ) : (
            <span>{activeTab.label}</span>
          )}
        </h2>
        <button
          onClick={() => setShowPersonaModal(true)}
          className="w-[26px] h-[26px] flex items-center justify-center border border-hld-border text-hld-muted hover:text-hld-cyan hover:bg-hld-cyan/10 hover:border-hld-cyan transition-all shrink-0"
          title="Configure Persona"
        >
          <Settings size={12} />
        </button>
      </div>

      {/* Tab Strip */}
      <div className="flex border-b border-hld-border bg-[#080d13]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 relative py-[8px] font-mono uppercase tracking-[0.15em] text-[8px] font-bold transition-all duration-200 border-b-2 ${
              tab === t.id
                ? 'text-hld-cyan border-hld-cyan bg-hld-cyan/5'
                : 'text-hld-muted-text border-transparent hover:text-hld-text'
            }`}
          >
            {t.label}
            {t.id === 'dialogue' && dialogueActive && (
              <span className="absolute top-[6px] right-[8px] w-[4px] h-[4px] rotate-45 bg-hld-magenta shadow-[0_0_6px_var(--tw-colors-hld-magenta)]" />
            )}
          </button>
        ))}
      </div>

      {currentSection ? (
        <>
          {tab === 'spec' && <SpecTab />}
          {tab === 'analysis' && <AnalysisTab />}
          {tab === 'dialogue' && <DialogueTab />}
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 bg-[#080d13] space-y-[10px]">
          {/* The persona/evaluator is a Spec-tab concern; surface it here too so
              it stays visible with no section selected, as it was pre-tabs. */}
          {tab === 'spec' && <PersonaBanner />}
          <div className="text-center text-hld-muted mt-10">
            <Layout size={32} className="mx-auto mb-2 opacity-50" />
            <p className="font-mono uppercase tracking-[0.14em] text-[8px]">Select a section</p>
          </div>
        </div>
      )}
    </div>
  );
};
