import React from "react";
import { Layout, Settings } from "lucide-react";
import { useStore } from "../../state";
import { useCurrentSection } from "./use-current-section";
import { SpecTab } from "./SpecTab";
import { AnalysisTab } from "./AnalysisTab";
import { DialogueTab } from "./DialogueTab";
import { RevisePanel } from "./RevisePanel";
import { PersonaBanner } from "./PersonaBanner";

const TABS = [
  { id: 'spec', label: 'Spec' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'dialogue', label: 'Dialogue' },
  { id: 'revise', label: 'Revise' },
] as const;

const startResize = (e: React.MouseEvent, startWidth: number, setWidth: (w: number) => void) => {
  e.preventDefault();
  const startX = e.clientX;
  const handleMouseMove = (ev: MouseEvent) => setWidth(Math.max(280, Math.min(startWidth + (startX - ev.clientX), 800)));
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
 * The right panel shell: resize handle + the chrome row (magenta accent line,
 * the Spec | Analysis | Dialogue tab strip, and the persona ⚙). Each tab owns
 * its content; the shell renders the shared empty state when no section is set.
 */
export const TestsPanel: React.FC = () => {
  const width = useStore((s) => s.testsPanelWidth);
  const setWidth = useStore((s) => s.setTestsPanelWidth);
  const tab = useStore((s) => s.testsPanelTab);
  const setTab = useStore((s) => s.setTestsPanelTab);
  const testSuite = useStore((s) => s.testSuite);
  const setShowPersonaModal = useStore((s) => s.setShowPersonaModal);

  const currentSection = useCurrentSection();
  const analysisState = currentSection ? testSuite[currentSection.id]?.analysis : undefined;
  const dialogueActive = !!analysisState && (analysisState.dialogue.length > 0 || !!analysisState.dialogueContext);
  const revisePending = useStore((s) => s.proposals.some((p) => p._status === 'pending'));

  return (
    <div
      style={{ width }}
      className="tests-panel-step h-full flex-none relative border-l border-hld-border bg-[#080d13] flex flex-col shadow-sm z-10"
    >
      {/* Resize Handle */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-hld-cyan/50 hover:w-2 transition-all duration-150 z-50 -translate-x-1/2"
        onMouseDown={(e) => startResize(e, width, setWidth)}
      />

      {/* Chrome — magenta accent line + tab strip + persona settings */}
      <div className="relative flex items-stretch border-b border-hld-border bg-[#080d13]">
        <div className="absolute top-0 left-0 right-0 h-px bg-hld-magenta shadow-[0_0_12px_var(--color-hld-magenta)]" />
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 relative py-[10px] font-mono uppercase tracking-[0.15em] text-[8px] font-bold border-b-2 transition-colors ${
              tab === t.id ? 'text-hld-cyan border-hld-cyan bg-hld-cyan/5' : 'text-hld-muted-text border-transparent hover:text-hld-text'
            }`}
          >
            {t.label}
            {t.id === 'dialogue' && dialogueActive && (
              <span className="absolute top-[6px] right-[8px] w-[4px] h-[4px] rotate-45 bg-hld-magenta shadow-[0_0_6px_var(--color-hld-magenta)]" />
            )}
            {t.id === 'revise' && revisePending && (
              <span className="absolute top-[6px] right-[8px] w-[4px] h-[4px] rotate-45 bg-hld-cyan shadow-[0_0_6px_var(--color-hld-cyan)]" />
            )}
          </button>
        ))}
        <button
          onClick={() => setShowPersonaModal(true)}
          className="w-[34px] flex items-center justify-center border-l border-hld-border text-hld-muted-text hover:text-hld-cyan hover:bg-hld-cyan/10 transition-colors shrink-0"
          title="Persona / evaluator settings"
          aria-label="Persona settings"
        >
          <Settings size={12} />
        </button>
      </div>

      {currentSection ? (
        <>
          {tab === 'spec' && <SpecTab />}
          {tab === 'analysis' && <AnalysisTab />}
          {tab === 'dialogue' && <DialogueTab />}
          {tab === 'revise' && <RevisePanel />}
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 bg-[#080d13] space-y-[10px]">
          {tab === 'spec' && <PersonaBanner />}
          <div className="text-center text-hld-muted-text mt-10">
            <Layout size={32} className="mx-auto mb-2 opacity-50" />
            <p className="font-mono uppercase tracking-[0.14em] text-[8px]">Select a section</p>
          </div>
        </div>
      )}
    </div>
  );
};
