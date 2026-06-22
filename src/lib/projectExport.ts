import type { AppState } from '../state';

/** The subset of store state captured in a `.socratic` project export. */
type ProjectExportFields = Pick<
  AppState,
  | 'projectName'
  | 'markdown'
  | 'localContent'
  | 'testSuite'
  | 'hiddenSectionIds'
  | 'activePersonaId'
  | 'customPersonas'
  | 'projectPromptsOverride'
  | 'modelConfig'
  | 'cachedCoachAdvice'
  | 'revisions'
>;

/**
 * Build the `.socratic` export blob from store state. Mirrors the on-disk
 * project schema written by `saveCurrentState`, so a round-trip re-import
 * (see `handleLoadFile`) hydrates cleanly.
 *
 * Crucially it emits the SPARSE per-project prompts override, not the resolved
 * effective config: baking the resolved config in would freeze this machine's
 * global-tier prompt edits onto every field, so a re-import on another machine
 * could no longer inherit that machine's global prompts. `modelsConfig` is
 * included for parity with `saveCurrentState`.
 */
export function buildProjectExport(s: ProjectExportFields) {
  return {
    projectName: s.projectName,
    markdown: s.markdown,
    localDraft: s.localContent,
    testSuite: s.testSuite,
    hiddenSectionIds: s.hiddenSectionIds,
    activePersonaId: s.activePersonaId,
    customPersonas: s.customPersonas,
    promptsConfig: s.projectPromptsOverride,
    modelsConfig: s.modelConfig,
    cachedCoachAdvice: s.cachedCoachAdvice,
    revisions: s.revisions,
    lastModified: Date.now(),
  };
}
