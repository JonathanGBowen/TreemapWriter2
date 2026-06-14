import { create } from 'zustand';
import { createAIStateSlice, type AIStateSlice } from './ai-state';
import { createDocumentStateSlice, type DocumentStateSlice } from './document-state';
import { createEditorStateSlice, type EditorStateSlice } from './editor-state';
import { createProjectStateSlice, type ProjectStateSlice } from './project-state';
import { createUIStateSlice, type UIStateSlice } from './ui-state';
import { createRevisionSlice, type RevisionSlice } from './revision-state';
import { setModelConfigSource } from '../services/ai-provider-registry';

/**
 * The combined state of the application, partitioned by lifecycle:
 *
 * - {@link UIStateSlice}       — modal flags, panel widths, focus mode (ephemeral)
 * - {@link EditorStateSlice}   — local draft, selection, cursor (ephemeral)
 * - {@link DocumentStateSlice} — markdown, sections, testSuite, history (domain)
 * - {@link ProjectStateSlice}  — project list, active project, persistence thunks
 * - {@link AIStateSlice}       — persona, prompts, coach cache
 * - {@link RevisionSlice}      — Glass Box revision workflow (ephemeral, unpersisted)
 *
 * Components subscribe to a single slice's shape via selectors. New code
 * should not destructure the whole store; that pattern is a Phase-1 legacy.
 */
export type AppState =
  & UIStateSlice
  & EditorStateSlice
  & DocumentStateSlice
  & ProjectStateSlice
  & AIStateSlice
  & RevisionSlice;

export const useStore = create<AppState>()((...args) => ({
  ...createUIStateSlice(...args),
  ...createEditorStateSlice(...args),
  ...createDocumentStateSlice(...args),
  ...createProjectStateSlice(...args),
  ...createAIStateSlice(...args),
  ...createRevisionSlice(...args),
}));

// Wire model resolution to live state without the registry importing the store
// (avoids a cycle). The provider reads the active per-project + global config here.
setModelConfigSource(() => {
  const s = useStore.getState();
  return { projectConfig: s.modelConfig, globalDefault: s.globalModelDefault };
});
