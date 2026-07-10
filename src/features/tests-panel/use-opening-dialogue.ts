import { useCallback } from 'react';
import type { DialogueMessage } from '../../types';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { extractOpeningDeposit, type OpeningDeposit } from '../../lib/dialogue-openings';
import { findSectionById } from '../../lib/utils';
import { guardContextFit } from '../shared/context-guard';
import { useDialogueStream, dialogueInFlight } from '../shared/dialogue';

const OPENING_KEY = 'dialogue-opening';

/**
 * Drives the anchored-opening dialogue (re-entry / coach-plan / unstick) through
 * the shared streaming kit and the `interlocutorTurn` provider method. The
 * transcript is ephemeral (the `dialogue-state` slice); the deposit is applied
 * as a slingshot back into the manuscript (§II.3). One opening at a time.
 */
export function useOpeningDialogue() {
  const setOpeningMessages = useStore((s) => s.setOpeningMessages);
  const endDialogueOpening = useStore((s) => s.endDialogueOpening);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const setTestsPanelTab = useStore((s) => s.setTestsPanelTab);
  const setSessionPrefill = useStore((s) => s.setSessionPrefill);
  const setShowSessionModal = useStore((s) => s.setShowSessionModal);
  const setMemorandum = useStore((s) => s.setMemorandum);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const { streaming: liveTurn, runTurn } = useDialogueStream();

  const isStreaming = liveTurn?.key === OPENING_KEY;
  const streamedText = isStreaming ? liveTurn.text : '';

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || dialogueInFlight(OPENING_KEY)) return;
      const { dialogueOpening, openingMessages, promptsConfig, modelConfig, globalModelDefault, modelCatalog } =
        useStore.getState();
      if (!dialogueOpening) return;

      const next: DialogueMessage[] = [...openingMessages, { role: 'user', text: trimmed }];

      const budgetText = [dialogueOpening.context, ...next.map((m) => m.text)].join('\n\n');
      const choice = resolveModelChoice('interlocutorTurn', modelConfig, globalModelDefault);
      if (!guardContextFit({ catalog: modelCatalog, choice, text: budgetText, what: 'This dialogue', setting: 'Interlocutor' })) {
        return;
      }

      setOpeningMessages(next);
      await runTurn({
        key: OPENING_KEY,
        stream: aiProvider.interlocutorTurn({
          opening: { kind: dialogueOpening.kind, label: dialogueOpening.label, context: dialogueOpening.context },
          messages: next,
          config: promptsConfig,
        }),
        onCommit: (t) => {
          // Read the latest transcript at commit time (the opening may have been
          // ended by a concurrent action; guard against a stale append).
          const state = useStore.getState();
          if (!state.dialogueOpening) return;
          state.setOpeningMessages([...next, { role: 'model', text: t }]);
        },
      });
    },
    [runTurn, setOpeningMessages],
  );

  /** Land the deposit back in the manuscript and end the ephemeral dialogue. */
  const applyDeposit = useCallback(
    (deposit: OpeningDeposit) => {
      const { sections } = useStore.getState();
      const target = deposit.sectionId && findSectionById(sections, deposit.sectionId)
        ? deposit.sectionId
        : null;
      if (target) {
        setSelectedId(target); // editor restores the caret + scrolls on section change
      }
      endDialogueOpening();
    },
    [setSelectedId, endDialogueOpening],
  );

  /** Hand the converged wish to the session check-in (the writer still starts it). */
  const toSession = useCallback(
    (deposit: OpeningDeposit) => {
      if (deposit.wish) setSessionPrefill({ wish: deposit.wish, firstStep: deposit.firstStep });
      endDialogueOpening();
      setShowSessionModal(true);
    },
    [setSessionPrefill, endDialogueOpening, setShowSessionModal],
  );

  /** Accept a proposed Memorandum revision (default-skip; the cap is enforced in the setter). */
  const acceptMemorandum = useCallback(
    (text: string) => {
      setMemorandum(text);
      void saveCurrentState().catch(() => {});
    },
    [setMemorandum, saveCurrentState],
  );

  const dismiss = useCallback(() => {
    if (dialogueInFlight(OPENING_KEY)) return;
    endDialogueOpening();
    setTestsPanelTab('spec');
  }, [endDialogueOpening, setTestsPanelTab]);

  return { send, applyDeposit, toSession, acceptMemorandum, dismiss, isStreaming, streamedText };
}

/** The deposit carried by the last model turn, or null. */
export function latestDeposit(messages: DialogueMessage[]): OpeningDeposit | null {
  const lastModel = [...messages].reverse().find((m) => m.role === 'model');
  return lastModel ? extractOpeningDeposit(lastModel.text) : null;
}
