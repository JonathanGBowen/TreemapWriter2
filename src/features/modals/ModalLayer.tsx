import { toast } from "sonner";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { isTauri } from "../../services/tauri-environment";
import { normalizePromptsConfig } from "../../lib/constants";
import type { Section, Persona, Dependency } from "../../types";
import type { ModelChoice } from "../../services/ai/model-types";
import type { ReadingMode } from "../../types";

import { TestRunnerModal } from "./TestRunnerModal";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { PersonaSettingsModal } from "./PersonaSettingsModal";
import { GrimoireModal } from "./GrimoireModal";
import { SpecGeneratorModal } from "./SpecGeneratorModal";
import { SprintModal } from "./sprint/SprintModal";
import { ProjectManagerModal } from "./ProjectManagerModal";
import { DependencyGraphModal } from "./DependencyGraphModal";
import { ProjectFileModal } from "./ProjectFileModal";
import { CoachModal } from "../coach/CoachModal";
import { PromptsGraphModal } from "./PromptsGraphModal";
import { SectionMapModal } from "./SectionMapModal";
import { MigrationModal } from "../migration/MigrationModal";
import { SyncConfigModal } from "./SyncConfigModal";
import { RemoteProjectModal } from "./RemoteProjectModal";
import { ConflictResolutionModal } from "./ConflictResolutionModal";
import { ExternalChangeModal } from "./ExternalChangeModal";
import { RevisionWorkspace } from "../revision/RevisionWorkspace";
import { RevisionSettingsModal } from "./RevisionSettingsModal";
import { AgentTraceModal } from "./AgentTraceModal";
import { CompareWorkspace } from "../compare/CompareWorkspace";
import { ClimateWorkspace } from "../climate/ClimateWorkspace";
import { InterpolateWorkspace } from "../interpolate/InterpolateWorkspace";
import { DashboardWorkspace } from "../dashboard/DashboardWorkspace";
import { ParallelWorkspace } from "../parallel/ParallelWorkspace";
import { ParallelSettingsModal } from "./ParallelSettingsModal";
import { GistWorkspace } from "../gist/GistWorkspace";
import { GistSettingsModal } from "./GistSettingsModal";
import { SessionModal } from "./SessionModal";
import { CommandPaletteModal, type Command } from "./CommandPaletteModal";

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
  allPersonas: Persona[];
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
  allPersonas,
  handleRunTests,
  getParentGoals,
  handleSaveContent,
  handleEstimateDependencies,
  updateDependencies,
  requestConfirm,
  paletteCommands,
}: ModalLayerProps) => {
  const {
    markdown, sections, testSuite, revisions, localContent, projectName,
    customPersonas, promptsConfig, cachedCoachAdvice, projectList,
    activeProjectId, activePersonaId,
    setLocalContent, setMarkdown, setTestSuite, setProjectName, setPromptsConfig,
    setActivePersonaId, setCustomPersonas, setShowSpecModal, setCachedCoachAdvice,
    updateSectionGoals, saveCurrentState,
    switchProject, createNewProject, createDemoProject, openExistingProject, deleteProject,
  } = useStore(useShallow((state) => ({
    markdown: state.markdown,
    sections: state.sections,
    testSuite: state.testSuite,
    revisions: state.revisions,
    localContent: state.localContent,
    projectName: state.projectName,
    customPersonas: state.customPersonas,
    promptsConfig: state.promptsConfig,
    cachedCoachAdvice: state.cachedCoachAdvice,
    projectList: state.projectList,
    activeProjectId: state.activeProjectId,
    activePersonaId: state.activePersonaId,
    setLocalContent: state.setLocalContent,
    setMarkdown: state.setMarkdown,
    setTestSuite: state.setTestSuite,
    setProjectName: state.setProjectName,
    setPromptsConfig: state.setPromptsConfig,
    setActivePersonaId: state.setActivePersonaId,
    setCustomPersonas: state.setCustomPersonas,
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

      <PersonaSettingsModal
        activePersonaId={activePersonaId}
        personas={allPersonas}
        onSelectPersona={setActivePersonaId}
        onAddPersona={(p) => setCustomPersonas(prev => [...prev, p])}
        onDeletePersona={(id) => {
          setCustomPersonas(prev => prev.filter(p => p.id !== id));
          if (activePersonaId === id) setActivePersonaId('default');
        }}
        documentContext={markdown}
        promptsConfig={promptsConfig}
      />

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

      <ProjectFileModal
        sections={sections}
        testSuite={testSuite}
        projectName={projectName}
        markdown={markdown}
        promptsConfig={promptsConfig}
        customPersonas={customPersonas}
        onSaveData={({ testSuite: newTestSuite, projectName: newProjectName, promptsConfig: newPrompts, customPersonas: newPersonas }) => {
          if (newTestSuite) setTestSuite(newTestSuite);
          if (newProjectName) setProjectName(newProjectName);
          // Raw-JSON prompt edits land as a per-project override (same path as
          // the Prompts map's project scope).
          if (newPrompts) setPromptsConfig(newPrompts);
          if (newPersonas) setCustomPersonas(newPersonas);
          void saveCurrentState();
        }}
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

      <AgentTraceModal />

      <CompareWorkspace />

      <ClimateWorkspace />

      <InterpolateWorkspace />

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
