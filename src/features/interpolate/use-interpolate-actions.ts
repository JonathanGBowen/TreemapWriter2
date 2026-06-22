import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { DialogueMessage } from '../../types';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import type { ModelChoice } from '../../services/ai/model-types';
import { checkContextFit } from '../../services/ai/context-budget';
import { parseStageResponse, type SpecStage } from '../../services/ai/ai-provider.specs';
import { mergeSpecsIntoTestSuite } from '../../lib/spec-merge';
import { extractFencedJson } from '../../lib/fenced-json';
import { notifyAiError } from '../shared/ai-error';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * Stages with a collaborative turn currently streaming. Module-level (not hook
 * state) so the guard survives remounts: a stream started before a remount must
 * still block a second concurrent send for that stage.
 */
const inFlight = new Set<string>();

/** Stage lookup by id within the materialized plan. */
const stageById = (stages: SpecStage[], id: string) => stages.find((s) => s.id === id);

/**
 * Orchestration for the Generate-Specs workspace. Components → this hook → slice
 * actions + `aiProvider`; the SDK never crosses into feature code. Two paths land
 * one level's specs:
 *  - `generateLevel` (single shot) for the non-agent "steer note → generate" flow
 *    and "run all remaining";
 *  - `developLevel` (streaming) for iterating with the agent.
 * Either way `acceptLevel` merges the level's proposal into the testSuite + the
 * slice's `specCache` (the next level's parent context) and descends.
 *
 * Live state is read via `getState()` at call time so the callbacks keep a stable
 * identity and always see the current walk.
 */
export const useInterpolateActions = () => {
  const createSnapshot = useStore((s) => s.createSnapshot);
  const setTestSuite = useStore((s) => s.setTestSuite);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const setStageProposed = useStore((s) => s.setStageProposed);
  const setStageMessages = useStore((s) => s.setStageMessages);
  const setStageStatus = useStore((s) => s.setStageStatus);
  const acceptStage = useStore((s) => s.acceptStage);
  const markWalkStarted = useStore((s) => s.markWalkStarted);

  // Reactive: re-renders the workspace between the collaborative chat and the
  // steer-note path when Agent mode (or a per-project override) flips.
  const agentModeEnabled = useStore((s) => s.agentModeEnabled);
  const agentSdkModel = useStore((s) => s.agentSdkModel);
  const modelConfig = useStore((s) => s.modelConfig);
  const globalModelDefault = useStore((s) => s.globalModelDefault);
  const isCollaborative = useMemo(() => {
    const agent =
      agentModeEnabled && agentSdkModel ? { enabled: true, model: agentSdkModel } : undefined;
    return (
      resolveModelChoice('developSpecLevel', modelConfig, globalModelDefault, agent).provider ===
      'agent-sdk'
    );
  }, [agentModeEnabled, agentSdkModel, modelConfig, globalModelDefault]);

  /** In-flight collaborative turn for the live bubble; null when nothing streams. */
  const [streaming, setStreaming] = useState<{ stageId: string; text: string } | null>(null);

  /** Take the one pre-ai-write snapshot for the whole walk (idempotent, non-fatal). */
  const startWalk = useCallback(async () => {
    if (useStore.getState().walkStarted) return;
    markWalkStarted(); // optimistic — prevents a double snapshot on a fast second click
    try {
      await createSnapshot('pre-ai-write', 'all', useStore.getState().promptsConfig);
    } catch {
      // The safety net failed, but the walk is still reversible via testSuite
      // history; warn and proceed rather than blocking generation.
      toast.warning('Could not save an undo snapshot before generating — proceeding.');
    }
  }, [createSnapshot, markWalkStarted]);

  /** Root stage only: does the full draft fit the model that will actually run this
   *  level? (soft-degrade). Checked against the resolved choice — the single-shot
   *  depth model on the steer path, the agent model on the collaborative path —
   *  since they can have very different context windows. */
  const rootFullTextFor = (stage: SpecStage, choice: ModelChoice): boolean => {
    if (stage.kind !== 'root') return true;
    const { modelCatalog, markdown } = useStore.getState();
    const fit = checkContextFit(modelCatalog, choice, markdown);
    if (fit.overflow) {
      toast.warning(
        `Document (~${Math.round(fit.estimatedTokens / 1000)}k tokens) exceeds ${choice.model}'s ` +
          `window; the document-level spec will use the outline only. Pick a larger-context model to include the full text.`,
      );
    }
    return !fit.overflow;
  };

  /** Single-shot generate for one stage (the steer-note path). */
  const generateLevel = useCallback(
    async (stageId: string) => {
      const { interpStages, stageWork, specCache, interpDepth, markdown, sections, promptsConfig } =
        useStore.getState();
      const stage = stageById(interpStages, stageId);
      const work = stageWork[stageId];
      if (!stage || !work) return;
      if (work.status === 'generating' || work.status === 'streaming' || inFlight.has(stageId)) return;

      await startWalk();
      setStageStatus(stageId, 'generating');
      try {
        const specs = await aiProvider.generateSpecLevel({
          stage,
          sections,
          markdown,
          specCache,
          rootFullText: rootFullTextFor(stage, interpDepth),
          steer: work.steer,
          config: promptsConfig,
          modelChoice: interpDepth,
        });
        setStageProposed(stageId, specs);
        setStageStatus(stageId, Object.keys(specs).length > 0 ? 'proposed' : 'idle');
        if (Object.keys(specs).length === 0) {
          toast.error('The model returned no specs for this level — try again or add a steer note.');
        }
      } catch (e) {
        setStageStatus(stageId, 'error');
        notifyAiError(e, `Spec generation failed: ${errMessage(e)}`);
      }
    },
    [startWalk, setStageProposed, setStageStatus],
  );

  /** One streamed collaborative turn for a stage (opening proposal or a refine). */
  const developLevel = useCallback(
    async (stageId: string, userText: string) => {
      const s = useStore.getState();
      const { interpStages, stageWork, specCache, markdown, sections, promptsConfig } = s;
      const stage = stageById(interpStages, stageId);
      const work = stageWork[stageId];
      if (!stage || !work || inFlight.has(stageId)) return;

      // The fit check must use the model that will actually run this turn (the agent
      // model on the collaborative path), not the single-shot depth.
      const agent =
        s.agentModeEnabled && s.agentSdkModel ? { enabled: true, model: s.agentSdkModel } : undefined;
      const devChoice = resolveModelChoice('developSpecLevel', s.modelConfig, s.globalModelDefault, agent);

      // Seed the opening turn when the writer just hits "Propose"; otherwise require text.
      const seed = userText.trim() || (work.messages.length === 0 ? 'Propose the specification for this level.' : '');
      if (!seed) return;

      await startWalk();
      const nextMessages: DialogueMessage[] = [...work.messages, { role: 'user', text: seed }];
      setStageMessages(stageId, nextMessages);

      inFlight.add(stageId);
      setStreaming({ stageId, text: '' });
      setStageStatus(stageId, 'streaming');
      let partial = '';
      try {
        for await (const chunk of aiProvider.developSpecLevel({
          stage,
          sections,
          markdown,
          specCache,
          rootFullText: rootFullTextFor(stage, devChoice),
          messages: nextMessages,
          config: promptsConfig,
        })) {
          partial += chunk;
          setStreaming({ stageId, text: partial });
        }
        // Land the committed turn: append the reply, parse its fenced JSON proposal.
        if (!partial) {
          setStageStatus(stageId, 'idle');
          toast.error('The agent returned no text — try again.');
        } else {
          setStageMessages(stageId, [...nextMessages, { role: 'model', text: partial }]);
          const jsonText = extractFencedJson(partial) ?? partial;
          const specs = parseStageResponse(stage, jsonText);
          if (Object.keys(specs).length > 0) {
            setStageProposed(stageId, specs);
            setStageStatus(stageId, 'proposed');
          } else {
            // A conversational turn with no usable JSON: keep any prior proposal.
            const hasPrior =
              Object.keys(useStore.getState().stageWork[stageId]?.proposed ?? {}).length > 0;
            setStageStatus(stageId, hasPrior ? 'proposed' : 'idle');
          }
        }
      } catch (e) {
        // Commit any partial reply so the transcript isn't lost, then surface the error.
        if (partial) setStageMessages(stageId, [...nextMessages, { role: 'model', text: partial }]);
        setStageStatus(stageId, 'error');
        notifyAiError(e, `Spec development failed: ${errMessage(e)}`);
      } finally {
        inFlight.delete(stageId);
        setStreaming((prev) => (prev?.stageId === stageId ? null : prev));
      }
    },
    [startWalk, setStageMessages, setStageStatus, setStageProposed],
  );

  /** Merge an accepted level into the testSuite + specCache and descend. */
  const acceptLevel = useCallback(
    async (stageId: string) => {
      const { stageWork, agentModeEnabled: agentOn, agentSdkModel: agentModel, interpDepth } =
        useStore.getState();
      const proposed = stageWork[stageId]?.proposed ?? {};
      if (Object.keys(proposed).length === 0) {
        toast.error('Nothing to accept yet — generate or develop this level first.');
        return;
      }
      const modelLabel = isCollaborative && agentOn ? `collaborative (${agentModel})` : interpDepth.model;
      setTestSuite((prev) => mergeSpecsIntoTestSuite(prev, proposed, modelLabel));
      acceptStage(stageId); // merges specCache + advances the cursor
      try {
        await saveCurrentState();
      } catch (e) {
        toast.error(`Specs accepted in memory, but writing to disk failed: ${errMessage(e)}`);
      }
    },
    [isCollaborative, setTestSuite, acceptStage, saveCurrentState],
  );

  /** Finish the rest of the walk non-interactively: single-shot generate + accept each. */
  const runAllRemaining = useCallback(async () => {
    await startWalk();
    const { interpStages, stageCursor } = useStore.getState();
    try {
      for (let i = stageCursor; i < interpStages.length; i++) {
        const stage = interpStages[i];
        const { specCache, interpDepth, markdown, sections, promptsConfig } = useStore.getState();
        setStageStatus(stage.id, 'generating');
        const specs = await aiProvider.generateSpecLevel({
          stage,
          sections,
          markdown,
          specCache,
          rootFullText: rootFullTextFor(stage, interpDepth),
          steer: useStore.getState().stageWork[stage.id]?.steer ?? '',
          config: promptsConfig,
          modelChoice: interpDepth,
        });
        setStageProposed(stage.id, specs);
        const modelLabel = interpDepth.model;
        setTestSuite((prev) => mergeSpecsIntoTestSuite(prev, specs, modelLabel));
        acceptStage(stage.id);
      }
      await saveCurrentState();
      toast.success('All levels generated.');
    } catch (e) {
      notifyAiError(e, `Run-all stopped: ${errMessage(e)}`);
    }
  }, [startWalk, setStageStatus, setStageProposed, setTestSuite, acceptStage, saveCurrentState]);

  return {
    isCollaborative,
    streaming,
    generateLevel,
    developLevel,
    acceptLevel,
    runAllRemaining,
  };
};
