import { create } from 'zustand';
import { createAIStateSlice, type AIStateSlice } from './ai-state';
import { createDocumentStateSlice, type DocumentStateSlice } from './document-state';
import { createEditorStateSlice, type EditorStateSlice } from './editor-state';
import { createProjectStateSlice, type ProjectStateSlice } from './project-state';
import { createUIStateSlice, type UIStateSlice } from './ui-state';
import { createRevisionSlice, type RevisionSlice } from './revision-state';
import { createComparisonSlice, type ComparisonSlice } from './comparison-state';
import { createSpecTestSlice, type SpecTestSlice } from './spec-test-state';
import { createClimateSlice, type ClimateSlice } from './climate-state';
import { createInterpolationSlice, type InterpolationSlice } from './interpolation-state';
import { createSegmentSlice, type SegmentSlice } from './segment-state';
import { createParallelSlice, type ParallelSlice } from './parallel-state';
import { createGistSlice, type GistSlice } from './gist-state';
import { createTraceSlice, type TraceSlice } from './trace-state';
import { createSessionSlice, type SessionSlice } from './session-state';
import { createLedgerSlice, type LedgerSlice } from './ledger-state';
import { createInboxSlice, type InboxSlice } from './inbox-state';
import { createCanvasSlice, type CanvasSlice } from './canvas-state';
import { createReorderSlice, type ReorderSlice } from './reorder-state';
import {
  setModelConfigSource,
  setAgentTraceSink,
  setFallbackSource,
  setCooldownSink,
  setThrottleWaitSink,
} from '../services/ai-provider-registry';

/**
 * The combined state of the application, partitioned by lifecycle:
 *
 * - {@link UIStateSlice}       — modal flags, panel widths, focus mode (ephemeral)
 * - {@link EditorStateSlice}   — local draft, selection, cursor (ephemeral)
 * - {@link DocumentStateSlice} — markdown, sections, testSuite, history (domain)
 * - {@link ProjectStateSlice}  — project list, active project, persistence thunks
 * - {@link AIStateSlice}       — persona, prompts, coach cache
 * - {@link RevisionSlice}      — Glass Box revision workflow (ephemeral, unpersisted)
 * - {@link ComparisonSlice}    — Version Compare workspace (ephemeral, unpersisted)
 * - {@link SpecTestSlice}      — Spec Test workspace (ephemeral, unpersisted)
 * - {@link ClimateSlice}       — Climate Artist workspace (ephemeral, unpersisted)
 * - {@link InterpolationSlice} — Generate-Specs workspace (ephemeral, unpersisted)
 * - {@link ParallelSlice}      — Parallel Editor workspace (ephemeral; outlineA persists in DocumentState)
 * - {@link GistSlice}          — Gist Editor workspace (ephemeral; the gist persists in DocumentState)
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
  & RevisionSlice
  & ComparisonSlice
  & SpecTestSlice
  & ClimateSlice
  & InterpolationSlice
  & SegmentSlice
  & ParallelSlice
  & GistSlice
  & TraceSlice
  & SessionSlice
  & LedgerSlice
  & InboxSlice
  & CanvasSlice
  & ReorderSlice;

export const useStore = create<AppState>()((...args) => ({
  ...createUIStateSlice(...args),
  ...createEditorStateSlice(...args),
  ...createDocumentStateSlice(...args),
  ...createProjectStateSlice(...args),
  ...createAIStateSlice(...args),
  ...createRevisionSlice(...args),
  ...createComparisonSlice(...args),
  ...createSpecTestSlice(...args),
  ...createClimateSlice(...args),
  ...createInterpolationSlice(...args),
  ...createSegmentSlice(...args),
  ...createParallelSlice(...args),
  ...createGistSlice(...args),
  ...createTraceSlice(...args),
  ...createSessionSlice(...args),
  ...createLedgerSlice(...args),
  ...createInboxSlice(...args),
  ...createCanvasSlice(...args),
  ...createReorderSlice(...args),
}));

// Wire model resolution to live state without the registry importing the store
// (avoids a cycle). The provider reads the active per-project + global config here.
setModelConfigSource(() => {
  const s = useStore.getState();
  return {
    projectConfig: s.modelConfig,
    globalDefault: s.globalModelDefault,
    agentMode: s.agentModeEnabled,
    agentModel: s.agentSdkModel,
  };
});

// Wire the quota-fallback policy to live state (the ladder + toggle + catalog),
// and mirror the registry's cooldown changes back into the store for the settings
// UI (the store setter write-throughs to preferences). Mirrors the two wirings
// above; keeps the registry free of a store import.
setFallbackSource(() => {
  const s = useStore.getState();
  return {
    settings: { enabled: s.fallbackEnabled, ladder: s.fallbackLadder },
    catalog: s.modelCatalog,
  };
});
setCooldownSink((snapshot) => useStore.getState().setModelCooldowns(snapshot));
// Surface throttle waits as "queued" on the activity pill (mirrors setCooldownSink).
setThrottleWaitSink((waiting) => useStore.getState().setThrottleWaiting(waiting));

// Feed the Agent SDK activity trace into the store (the client never imports the
// store — avoids a cycle, mirroring setModelConfigSource). Then load any
// persisted traces + the saving flag.
setAgentTraceSink((e) => useStore.getState().applyTraceEvent(e));
void useStore.getState().hydrateTraces();
