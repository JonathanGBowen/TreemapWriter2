import { create } from 'zustand';
import { createAIStateSlice, type AIStateSlice } from './ai-state';
import { createDocumentStateSlice, type DocumentStateSlice } from './document-state';
import { createEditorStateSlice, type EditorStateSlice } from './editor-state';
import { createProjectStateSlice, type ProjectStateSlice } from './project-state';
import { createUIStateSlice, type UIStateSlice } from './ui-state';

/**
 * The combined state of the application, partitioned by lifecycle:
 *
 * - {@link UIStateSlice}       — modal flags, panel widths, focus mode (ephemeral)
 * - {@link EditorStateSlice}   — local draft, selection, cursor (ephemeral)
 * - {@link DocumentStateSlice} — markdown, sections, testSuite, history (domain)
 * - {@link ProjectStateSlice}  — project list, active project, persistence thunks
 * - {@link AIStateSlice}       — persona, prompts, coach cache
 *
 * Components subscribe to a single slice's shape via selectors. New code
 * should not destructure the whole store; that pattern is a Phase-1 legacy.
 */
export type AppState =
  & UIStateSlice
  & EditorStateSlice
  & DocumentStateSlice
  & ProjectStateSlice
  & AIStateSlice;

export const useStore = create<AppState>()((...args) => ({
  ...createUIStateSlice(...args),
  ...createEditorStateSlice(...args),
  ...createDocumentStateSlice(...args),
  ...createProjectStateSlice(...args),
  ...createAIStateSlice(...args),
}));

/**
 * Legacy storage keys re-exported for back-compat with callers that haven't
 * been migrated to the Repository yet (App.tsx import/export handlers).
 *
 * @deprecated Use `browserRepository` from `src/services/browser-repository.ts`.
 */
export const STORAGE_PREFIX = 'socratic_p_';
/** @deprecated See STORAGE_PREFIX. */
export const META_KEY = 'socratic_meta_v1';
