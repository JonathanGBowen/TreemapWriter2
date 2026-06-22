import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { DialogueMessage, SectionSpec } from '../types';
import type { ModelChoice } from '../services/ai/model-types';
import { specStages, type SpecStage } from '../services/ai/ai-provider.specs';
import { resolveModelChoice } from '../services/ai/resolve-model-choice';

/**
 * The Generate-Specs workspace, as an ephemeral slice. Like the Version Compare,
 * Glass Box, and Climate slices, NOTHING here is persisted: the materialized stage
 * plan, the per-stage working data (steer note, conversation, proposed specs), and
 * the accepted-so-far `specCache` are all session state. Accepted specs land in the
 * `testSuite` (the durable home) as a side effect of Accept; the workspace-open flag
 * lives here — not in ui-state — because it is inseparable from the walk it gates.
 *
 * Pure state only: the AI calls (single-shot per level / streaming co-development)
 * and the testSuite merge + snapshot live in features/interpolate/use-interpolate-actions,
 * mirroring use-comparison-actions / use-analysis-actions. The SDK never crosses here.
 *
 * The walk is forward-only: root → chapters → sections, accepting each level to
 * descend (the next level reads the accepted parents from `specCache`). Re-doing a
 * level means re-opening the workspace (a fresh `pre-ai-write` snapshot makes it safe).
 */
export type StageStatus =
  | 'idle'        // not started
  | 'generating'  // single-shot generate in flight
  | 'streaming'   // an agent turn is streaming
  | 'proposed'    // a proposal is ready to review/edit
  | 'accepted'    // merged into the testSuite, descended past
  | 'error';

/** Mutable working data for one stage, keyed by stage id in `stageWork`. */
export interface StageWork {
  /** The author's free-text steer note (the non-agent path). */
  steer: string;
  /** The collaborative conversation for this stage (the agent path). */
  messages: DialogueMessage[];
  /** The current proposal: section-id → spec (`'root'` for the document level). */
  proposed: Record<string, SectionSpec>;
  status: StageStatus;
}

const freshWork = (): StageWork => ({ steer: '', messages: [], proposed: {}, status: 'idle' });

export interface InterpolationSlice {
  interpolateOpen: boolean;
  /** The materialized stage plan (frozen at open, so it can't desync the cursor). */
  interpStages: SpecStage[];
  /** Index into `interpStages` of the stage currently being worked. */
  stageCursor: number;
  /** Model/depth for the single-shot (non-agent) path; the top-bar depth control writes it. */
  interpDepth: ModelChoice;
  /** Accepted specs above the cursor — the authority for the next level's parent context. */
  specCache: Record<string, SectionSpec>;
  /** Per-stage working data, keyed by stage id. */
  stageWork: Record<string, StageWork>;
  /** True once the walk's one `pre-ai-write` snapshot has been taken this session. */
  walkStarted: boolean;

  openInterpolate: () => void;
  closeInterpolate: () => void;
  setInterpDepth: (choice: ModelChoice) => void;
  setStageSteer: (stageId: string, steer: string) => void;
  setStageMessages: (stageId: string, messages: DialogueMessage[]) => void;
  /** Replace a stage's whole proposal (a single-shot result or a parsed agent turn). */
  setStageProposed: (stageId: string, proposed: Record<string, SectionSpec>) => void;
  /** Edit one section's proposed spec in place (inline editing). */
  setProposedSpec: (stageId: string, sectionId: string, spec: SectionSpec) => void;
  setStageStatus: (stageId: string, status: StageStatus) => void;
  /** Merge the stage's proposal into `specCache` and advance the cursor (testSuite merge is the hook's job). */
  acceptStage: (stageId: string) => void;
  markWalkStarted: () => void;
}

export const createInterpolationSlice: StateCreator<AppState, [], [], InterpolationSlice> = (
  set,
  get,
) => ({
  interpolateOpen: false,
  interpStages: [],
  stageCursor: 0,
  interpDepth: { provider: 'gemini', model: 'gemini-3-flash-preview', thinkingBudget: 0 },
  specCache: {},
  stageWork: {},
  walkStarted: false,

  openInterpolate: () => {
    // Snapshot the structure now (the tree can change underneath an open workspace)
    // and seed fresh working data + the configured single-shot depth.
    const s = get();
    const stages = specStages(s.sections);
    const stageWork: Record<string, StageWork> = {};
    for (const st of stages) stageWork[st.id] = freshWork();
    set({
      interpolateOpen: true,
      interpStages: stages,
      stageCursor: 0,
      interpDepth: resolveModelChoice('generateSpecs', s.modelConfig, s.globalModelDefault),
      specCache: {},
      stageWork,
      walkStarted: false,
    });
  },

  // Closing fully resets the (regenerable) walk: accepted levels already live in the
  // testSuite + git history, so only un-accepted proposals are dropped. Re-opening
  // re-materializes from the current structure.
  closeInterpolate: () =>
    set({ interpolateOpen: false, interpStages: [], stageCursor: 0, specCache: {}, stageWork: {}, walkStarted: false }),

  setInterpDepth: (interpDepth) => set({ interpDepth }),

  setStageSteer: (stageId, steer) =>
    set((s) => ({ stageWork: patchWork(s.stageWork, stageId, { steer }) })),

  setStageMessages: (stageId, messages) =>
    set((s) => ({ stageWork: patchWork(s.stageWork, stageId, { messages }) })),

  setStageProposed: (stageId, proposed) =>
    set((s) => ({ stageWork: patchWork(s.stageWork, stageId, { proposed }) })),

  setProposedSpec: (stageId, sectionId, spec) =>
    set((s) => {
      const work = s.stageWork[stageId];
      if (!work) return {};
      return {
        stageWork: patchWork(s.stageWork, stageId, {
          proposed: { ...work.proposed, [sectionId]: spec },
        }),
      };
    }),

  setStageStatus: (stageId, status) =>
    set((s) => ({ stageWork: patchWork(s.stageWork, stageId, { status }) })),

  acceptStage: (stageId) =>
    set((s) => {
      const work = s.stageWork[stageId];
      if (!work) return {};
      const idx = s.interpStages.findIndex((st) => st.id === stageId);
      return {
        specCache: { ...s.specCache, ...work.proposed },
        stageWork: patchWork(s.stageWork, stageId, { status: 'accepted' }),
        stageCursor: idx >= 0 ? idx + 1 : s.stageCursor,
      };
    }),

  markWalkStarted: () => set({ walkStarted: true }),
});

/** Immutably patch one stage's working data. */
function patchWork(
  all: Record<string, StageWork>,
  stageId: string,
  patch: Partial<StageWork>,
): Record<string, StageWork> {
  const existing = all[stageId];
  if (!existing) return all;
  return { ...all, [stageId]: { ...existing, ...patch } };
}
