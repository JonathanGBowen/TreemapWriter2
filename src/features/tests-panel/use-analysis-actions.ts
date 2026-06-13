import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { DialogueMessage, SectionAnalysisState } from '../../types';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { computeHash } from '../../lib/utils';
import { makeAnalysisVersion } from '../../lib/analysis-helpers';
import { useCurrentSection } from './use-current-section';

/**
 * Sections with a dialogue turn currently streaming. Module-level (not hook
 * state) so the guard survives tab switches/remounts: a stream started
 * before a remount must still block a second concurrent send.
 */
const inFlight = new Set<string>();

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

const activeVersionOf = (state: SectionAnalysisState | undefined) =>
  state?.versions.find((v) => v.id === state.activeVersionId) ?? state?.versions[0];

const consumeStream = async (
  stream: AsyncIterable<string>,
  onProgress: (text: string) => void,
): Promise<string> => {
  let acc = '';
  for await (const chunk of stream) {
    acc += chunk;
    onProgress(acc);
  }
  return acc;
};

/**
 * One streamed model turn. `messages` already ends with the (persisted)
 * user message; `onCommit` lands the model reply in the store, `onProgress`
 * feeds the live bubble. On failure any partial text is committed and the
 * error toasted — error text never enters the transcript.
 */
const runDialogueTurn = async (args: {
  input: Parameters<typeof aiProvider.continueDialogue>[0];
  onProgress: (text: string) => void;
  onCommit: (text: string) => void;
}): Promise<void> => {
  let partial = '';
  try {
    const full = await consumeStream(aiProvider.continueDialogue(args.input), (text) => {
      partial = text;
      args.onProgress(text);
    });
    if (full) args.onCommit(full);
    else toast.error('Dialogue returned no text.');
  } catch (e) {
    if (partial) args.onCommit(partial);
    toast.error(`Dialogue failed: ${errMessage(e)}`);
  }
};

/**
 * Orchestration for the Analysis + Dialogue tabs: analyze, interrogate,
 * chat (streaming), conclude-and-refactor. Components -> this hook ->
 * slice actions + aiProvider; the SDK never crosses into feature code.
 *
 * Analyze/refactor set the global `isProcessing` (the existing convention
 * for heavyweight AI calls); dialogue turns only set the per-section
 * in-flight guard, so a chat never locks the rest of the app.
 */
export const useAnalysisActions = () => {
  const testSuite = useStore((s) => s.testSuite);
  const promptsConfig = useStore((s) => s.promptsConfig);
  const isProcessing = useStore((s) => s.isProcessing);
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setTestsPanelTab = useStore((s) => s.setTestsPanelTab);
  const addAnalysisVersion = useStore((s) => s.addAnalysisVersion);
  const setDialogue = useStore((s) => s.setDialogue);
  const startDialogue = useStore((s) => s.startDialogue);
  const clearDialogue = useStore((s) => s.clearDialogue);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

  const currentSection = useCurrentSection();
  /** In-flight model turn for the live bubble; null when nothing streams. */
  const [streaming, setStreaming] = useState<{ sectionId: string; text: string } | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!currentSection || isProcessing) return;
    // Capture at call time: edits or a section switch mid-flight must not
    // redirect where the result lands or what the inputHash describes.
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    const prevVersions = testSuite[sectionId]?.analysis?.versions ?? [];

    setIsProcessing(true);
    try {
      const result = await aiProvider.analyzeSection({
        sectionTitle,
        sectionText,
        config: promptsConfig,
      });
      const version = makeAnalysisVersion({
        kind: 'analysis',
        prevVersions,
        result,
        inputHash: computeHash(sectionText),
      });
      addAnalysisVersion(sectionId, version);
      await saveCurrentState();
    } catch (e) {
      toast.error(`Analysis failed: ${errMessage(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [currentSection, isProcessing, testSuite, promptsConfig, setIsProcessing, addAnalysisVersion, saveCurrentState]);

  const interrogate = useCallback(
    (context: string) => {
      if (!currentSection) return;
      startDialogue(currentSection.id, context);
      setTestsPanelTab('dialogue');
    },
    [currentSection, startDialogue, setTestsPanelTab],
  );

  const sendDialogueMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!currentSection || !trimmed) return;
      const sectionId = currentSection.id;
      if (inFlight.has(sectionId)) return;

      const state = testSuite[sectionId]?.analysis;
      const nextMessages: DialogueMessage[] = [
        ...(state?.dialogue ?? []),
        { role: 'user', text: trimmed },
      ];
      // The user's words are persisted before the stream starts; a crash
      // mid-stream loses only the regenerable model reply.
      setDialogue(sectionId, nextMessages);

      inFlight.add(sectionId);
      setStreaming({ sectionId, text: '' });
      try {
        await runDialogueTurn({
          input: {
            context: state?.dialogueContext ?? '',
            analysis: activeVersionOf(state)?.result ?? null,
            messages: nextMessages,
            config: promptsConfig,
          },
          onProgress: (text) => setStreaming({ sectionId, text }),
          onCommit: (text) => {
            setDialogue(sectionId, [...nextMessages, { role: 'model', text }]);
            void saveCurrentState();
          },
        });
      } finally {
        inFlight.delete(sectionId);
        setStreaming((prev) => (prev?.sectionId === sectionId ? null : prev));
      }
    },
    [currentSection, testSuite, promptsConfig, setDialogue, saveCurrentState],
  );

  const concludeAndRefactor = useCallback(async () => {
    if (!currentSection || isProcessing) return;
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    if (inFlight.has(sectionId)) return;

    const state = testSuite[sectionId]?.analysis;
    const active = activeVersionOf(state);
    if (!state || !active) return;
    const dialogue = state.dialogue;
    if (!dialogue.some((m) => m.role === 'user') || !dialogue.some((m) => m.role === 'model')) return;

    setIsProcessing(true);
    try {
      const result = await aiProvider.refactorAnalysis({
        sectionTitle,
        sectionText,
        analysis: active.result,
        dialogue,
        dialogueContext: state.dialogueContext,
        config: promptsConfig,
      });
      const version = makeAnalysisVersion({
        kind: 'refactor',
        prevVersions: state.versions,
        result,
        inputHash: computeHash(sectionText),
        sourceDialogue: dialogue,
      });
      addAnalysisVersion(sectionId, version);
      clearDialogue(sectionId);
      setTestsPanelTab('analysis');
      await saveCurrentState();
      toast.success('Analysis refactored.');
    } catch (e) {
      // Dialogue and versions are untouched on failure: nothing mutates
      // until the provider call resolves.
      toast.error(`Refactor failed: ${errMessage(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [currentSection, isProcessing, testSuite, promptsConfig, setIsProcessing, addAnalysisVersion, clearDialogue, setTestsPanelTab, saveCurrentState]);

  const discardDialogue = useCallback(() => {
    if (!currentSection || inFlight.has(currentSection.id)) return;
    // No confirm: a cleared transcript is recoverable — dialogues ride the
    // per-section YAML sidecar into git history (Version History restores).
    clearDialogue(currentSection.id);
    void saveCurrentState();
  }, [currentSection, clearDialogue, saveCurrentState]);

  return { runAnalysis, interrogate, sendDialogueMessage, concludeAndRefactor, discardDialogue, streaming };
};
