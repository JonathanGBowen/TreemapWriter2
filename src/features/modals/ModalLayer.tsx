import { toast } from "sonner";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { isTauri } from "../../services/tauri-environment";
import { normalizePromptsConfig } from "../../lib/constants";
import type { Section, Persona, Dependency } from "../../types";
import type { ModelChoice } from "../../services/ai/model-types";
import type { ReadingMode } from "../../types";

import { TestRunnerModal } from "./analysis/TestRunnerModal";
import { VersionHistoryModal } from "./project/VersionHistoryModal";
import { AiSettingsModal } from "./settings/AiSettingsModal";
import { GrimoireModal } from "./analysis/GrimoireModal";
import { SpecGeneratorModal } from "./analysis/SpecGeneratorModal";
import { SprintModal } from "./sprint/SprintModal";
import { ProjectManagerModal } from "./project/ProjectManagerModal";
import { DependencyGraphModal } from "./analysis/DependencyGraphModal";
import { CoachModal } from "../coach/CoachModal";
import { PromptsGraphModal } from "./analysis/PromptsGraphModal";
import { SectionMapModal } from "./analysis/SectionMapModal";
import { MigrationModal } from "../migration/MigrationModal";
import { SyncConfigModal } from "./sync/SyncConfigModal";
import { RemoteProjectModal } from "./sync/RemoteProjectModal";
import { ConflictResolutionModal } from "./sync/ConflictResolutionModal";
import { ExternalChangeModal } from "./sync/ExternalChangeModal";
import { RevisionWorkspace } from "../revision/RevisionWorkspace";
import { RevisionSettingsModal } from "./settings/RevisionSettingsModal";
import { SourceEditorModal } from "./project/SourceEditorModal";
import { ZoteroPickerModal } from "./project/ZoteroPickerModal";
import { AgentTraceModal } from "./settings/AgentTraceModal";
import { CompareWorkspace } from "../compare/CompareWorkspace";
import { SpecTestWorkspace } from "../spec-test/SpecTestWorkspace";
import { ClimateWorkspace } from "../climate/ClimateWorkspace";
import { DoctorWorkspace } from "../doctor/DoctorWorkspace";
import { InterpolateWorkspace } from "../interpolate/InterpolateWorkspace";
import { SegmentWorkspace } from "../segment/SegmentWorkspace";
import { DashboardWorkspace } from "../dashboard/DashboardWorkspace";
import { ParallelWorkspace } from "../parallel/ParallelWorkspace";
import { ParallelSettingsModal } from "./settings/ParallelSettingsModal";
import { GistWorkspace } from "../gist/GistWorkspace";
import { GistSettingsModal } from "./settings/GistSettingsModal";
import { SessionModal } from "./project/SessionModal";
import { CommandPaletteModal, type Command } from "./shared/CommandPaletteModal";

/**
 * The app's modal/workspace orchestration layer, extracted from the layout shell
 * (audit 4.2). Every modal still owns its own `showXModal` flag and self-mounts;
 * this component just *hosts* them so `App.tsx` stays a layout shell.
 *
 * The split of where each modal's data comes from is deliberate:
 *   - Pure store data/actions (markdown, sections, the setters, project thunks)
 *     are subscribed to here directly — there is no reason to thread them through
 *     App.
 *   - App-LOCAL values arrive as props: the derived memos (`currentSection`,
 *     `activePersona`, …) and the AI-orchestration handlers (`handleRunTests`, …)
 *     are also used by non-modal code in App, so App stays their single owner.
 *
 * No modal takes `isOpen`/`onClose` (per the AGENTS.md modal convention) — only
 * orchestration handlers cross this boundary.
 */
interface ModalLayerProps {
  currentSection: Section | null;
  documentStats: { wordCount: number; sectionCount: number; depth: number };
  activePersona: Persona;
  handleRunTests: (
    scope: "segment" | "parent" | "full",
    choice: ModelChoice,
    instruction: string,
    mode: ReadingMode,
  ) => Promise<void>;
  getParentGoals: () => string | undefined;
  handleSaveContent: (sectionId: string, newContent: string) => void;
  handleEstimateDependencies: () => Promise<void>;
  updateDependencies: (id: string, deps: Dependency[]) => void;
  requestConfirm: (message: string, onConfirmAction: () => void) => void;
  paletteCommands: Command[];
}

export const ModalLayer = ({
  currentSection,
  documentStats,
  activePersona,
  handleRunTests,
  getParentGoals,
  handleSaveContent,
  handleEstimateDependencies,
  updateDependencies,
  requestConfirm,
  paletteCommands,
}: ModalLayerProps) => {
  const {
    markdown, sections, testSuite, revisions, localContent,
    promptsConfig, cachedCoachAdvice, projectList,
    activeProjectId,
    setLocalContent, setMarkdown, setTestSuite, setPromptsConfig,
    setShowSpecModal, setCachedCoachAdvice,
    updateSectionGoals, saveCurrentState,
    switchProject, createNewProject, createDemoProject, openExistingProject, deleteProject,
  } = useStore(useShallow((state) => ({
    markdown: state.markdown,
    sections: state.sections,
    testSuite: state.testSuite,
    revisions: state.revisions,
    localContent: state.localContent,
    promptsConfig: state.promptsConfig,
    cachedCoachAdvice: state.cachedCoachAdvice,
    projectList: state.projectList,
    activeProjectId: state.activeProjectId,
    setLocalContent: state.setLocalContent,
    setMarkdown: state.setMarkdown,
    setTestSuite: state.setTestSuite,
    setPromptsConfig: state.setPromptsConfig,
    setShowSpecModal: state.setShowSpecModal,
    setCachedCoachAdvice: state.setCachedCoachAdvice,
    updateSectionGoals: state.updateSectionGoals,
    saveCurrentState: state.saveCurrentState,
    switchProject: state.switchProject,
    createNewProject: state.createNewProject,
    createDemoProject: state.createDemoProject,
    openExistingProject: state.openExistingProject,
    deleteProject: state.deleteProject,
  })));

  return (
    <>
      <TestRunnerModal
        onRun={handleRunTests}
        sectionTitle={currentSection?.title || 'Unknown'}
        currentSection={currentSection}
        currentSpec={currentSection ? testSuite[currentSection.id]?.spec : undefined}
        documentStats={documentStats}
        activePersona={activePersona}
        allSections={sections}
        fullDocument={markdown}
      />

      <VersionHistoryModal
        revisions={revisions}
        currentContent={localContent}
        onRestore={(snapshot) => {
          setLocalContent(snapshot.markdown);
          setMarkdown(snapshot.markdown);
          setTestSuite(snapshot.testSuite || {});
          if (snapshot.interpolationConfig) {
            // Normalized: old snapshots predate newer prompt fields.
            setPromptsConfig(normalizePromptsConfig(snapshot.interpolationConfig));
          }
          if (activeProjectId) {
            saveCurrentState();
          }
        }}
      />

      <AiSettingsModal />

      <GrimoireModal />

      <SpecGeneratorModal
        sectionTitle={currentSection?.title || ""}
        currentGoals={currentSection ? (testSuite[currentSection.id]?.goals || "") : ""}
        fullSectionContent={currentSection?.fullContent || ""}
        parentGoals={getParentGoals()}
        onAccept={(newGoals, instruction) => {
           if (currentSection) {
             updateSectionGoals(currentSection.id, newGoals, 'ai-refine', instruction);
           }
           setShowSpecModal(false);
        }}
      />

      <SprintModal
        sections={sections}
        testSuite={testSuite}
        onSaveGoal={updateSectionGoals}
        onSaveContent={handleSaveContent}
        promptsConfig={promptsConfig}
      />

      <ProjectManagerModal
        projects={projectList}
        activeProjectId={activeProjectId || ''}
        onLoadProject={async (id) => {
          // switchProject flushes the current project before loading the next,
          // so the last <60s of edits aren't lost on switch.
          const success = await switchProject(id);
          if (!success) {
             toast.error("Could not load project data.");
          }
        }}
        onCreateProject={() => createNewProject()}
        onLoadDefaultProject={() => createDemoProject()}
        onOpenProject={isTauri() ? () => openExistingProject() : undefined}
        onDeleteProject={(id) => {
          // Project delete is the one destructive action that confirms (per the
          // "undo, not confirm — except delete" rule). Copy is runtime-specific:
          // desktop only forgets the recent entry; browser delete is permanent.
          const name = projectList.find((p) => p.id === id)?.name ?? 'this project';
          const message = isTauri()
            ? `Delete "${name}"? This removes it from your recent projects — the folder on disk is kept.`
            : `Delete "${name}"? This permanently deletes the project and can't be undone.`;
          requestConfirm(message, () => { void deleteProject(id); });
        }}
      />

      <DependencyGraphModal
        sections={sections}
        testSuite={testSuite}
        updateDependencies={updateDependencies}
        onEstimateDependencies={handleEstimateDependencies}
      />

      <CoachModal
        markdown={markdown}
        sections={sections}
        testSuite={testSuite}
        cachedAdvice={cachedCoachAdvice}
        onSaveCache={(inputHash, advice) => {
          setCachedCoachAdvice({ inputHash, advice });
        }}
        promptsConfig={promptsConfig}
      />

      <PromptsGraphModal />

      <SectionMapModal
        sections={sections}
        testSuite={testSuite}
        onUpdateGoals={(id, goals) => updateSectionGoals(id, goals, 'manual')}
      />

      <MigrationModal />

      <SyncConfigModal />

      <RemoteProjectModal />

      <ConflictResolutionModal />

      <ExternalChangeModal />

      <RevisionWorkspace />

      <RevisionSettingsModal />

      <SourceEditorModal />

      <ZoteroPickerModal />

      <AgentTraceModal />

      <CompareWorkspace />

      <SpecTestWorkspace />

      <ClimateWorkspace />

      <DoctorWorkspace />

      <InterpolateWorkspace />

      <SegmentWorkspace />

      <DashboardWorkspace />

      <ParallelWorkspace />

      <ParallelSettingsModal />

      <GistWorkspace />

      <GistSettingsModal />

      <SessionModal />

      <CommandPaletteModal commands={paletteCommands} />
    </>
  );
};
