import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { DialogueMessage, SectionAnalysisState } from '../../types';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { computeHash } from '../../lib/utils';
import { makeAnalysisVersion } from '../../lib/analysis-helpers';
import { buildStructuralSurround, formatStructuralSurround } from '../../lib/diagnostic-helpers';
import { DEFAULT_SPELLS } from '../../lib/defaultSpells';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { useCurrentSection } from '../shared/use-current-section';

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
    notifyAiError(e, `Dialogue failed: ${errMessage(e)}`);
  }
};

/**
 * Orchestration for the Analysis + Dialogue tabs: analyze, interrogate,
 * chat (streaming), conclude-and-refactor. Components -> this hook ->
 * slice actions + aiProvider; the SDK never crosses into feature code.
 *
 * Analyze/refactor set the global `isProcessing` (the existing convention
 * for heavyweight AI calls); dialogue turns only set the per-section
 * in-flight guard, so a chat never locks the rest of the app. The two locks
 * are mutually exclusive *for a given section*: every entry point bails if
 * either is held, so a refactor can't run while a turn streams (and vice
 * versa) and they can never race two writes to the same sidecar.
 *
 * `testSuite`/`promptsConfig`/`isProcessing` are read via `getState()` at
 * call time rather than subscribed, so the callbacks keep a stable identity
 * (they don't churn on every streamed-message commit) and the guards always
 * see live values instead of a render-time snapshot.
 */
export const useAnalysisActions = () => {
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
    if (!currentSection) return;
    // Capture at call time: edits or a section switch mid-flight must not
    // redirect where the result lands or what the inputHash describes.
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    const {
      testSuite,
      sections,
      promptsConfig,
      isProcessing,
      modelCatalog,
      modelConfig,
      globalModelDefault,
      customSpells,
      activeSpellId,
      analysisMode,
    } = useStore.getState();
    // Mutually exclusive with a streaming dialogue turn for this section:
    // both would write the same sidecar and could otherwise race two saves.
    if (isProcessing || inFlight.has(sectionId)) return;

    // The active lens, if any. Built-ins + the global custom library; null id
    // means a plain exegetical reconstruction with no persona/lens overlay.
    const spell = activeSpellId
      ? [...DEFAULT_SPELLS, ...customSpells].find((s) => s.id === activeSpellId)
      : undefined;

    // The full section text is sent whole — never silently truncate (whole-document
    // or per-section). Pre-flight the token budget and abort on overflow, asking the
    // user to pick a larger-context model rather than slicing the text.
    const wholeDocument = sectionId === 'root';
    const choice = resolveModelChoice('analyzeSection', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text: sectionText,
        what: wholeDocument ? 'The whole document' : 'This section',
        setting: 'Analyze section',
      })
    ) {
      return;
    }

    const prevVersions = testSuite[sectionId]?.analysis?.versions ?? [];

    // Read this section as a part of the whole: its neighbours' claims and
    // commitments (role-reconstructions, never prose). The whole-document pass is
    // already the whole, so it gets no surround.
    const specs = Object.fromEntries(
      Object.entries(testSuite).map(([id, e]) => [id, e?.spec]),
    );
    const structuralSurround = wholeDocument
      ? undefined
      : formatStructuralSurround(buildStructuralSurround(sectionId, sections, specs)) || undefined;

    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Analyzing section…' });
    try {
      const result = await aiProvider.analyzeSection({
        sectionTitle,
        sectionText,
        config: promptsConfig,
        wholeDocument,
        spell: spell ? { persona: spell.persona, lens: spell.lens } : undefined,
        structuralSurround,
        mode: analysisMode,
      });
      const version = makeAnalysisVersion({
        kind: 'analysis',
        prevVersions,
        result,
        inputHash: computeHash(sectionText),
        spellName: spell?.name,
      });
      addAnalysisVersion(sectionId, version);
    } catch (e) {
      notifyAiError(e, `Analysis failed: ${errMessage(e)}`);
      setIsProcessing(false);
      useStore.getState().endOp(opId);
      return;
    }
    // The analysis succeeded the moment the version is in state; a persistence
    // failure is a distinct error, not "analysis failed".
    try {
      await saveCurrentState();
    } catch (e) {
      toast.error(`Analysis saved in memory, but writing to disk failed: ${errMessage(e)}`);
    } finally {
      setIsProcessing(false);
      useStore.getState().endOp(opId);
    }
  }, [currentSection, setIsProcessing, addAnalysisVersion, saveCurrentState]);

  const interrogate = useCallback(
    (context: string) => {
      if (!currentSection) return;
      const sectionId = currentSection.id;
      // A turn is mid-stream for this section: don't disturb it. Clearing now
      // would be undone by the stream's onCommit (which rebuilds from the
      // captured nextMessages), resurrecting the transcript under a new focus.
      // Just surface the live dialogue instead.
      if (inFlight.has(sectionId)) {
        setTestsPanelTab('dialogue');
        return;
      }
      const state = useStore.getState().testSuite[sectionId]?.analysis;
      // A glyph seeds a *fresh* focused dialogue. If an unconcluded dialogue
      // about a different focus is open, clear it so the transcript matches
      // the FOCUS banner (a concluded dialogue is preserved on the version's
      // sourceDialogue by refactor; this only discards an in-progress chat
      // the user is redirecting away from). Re-clicking the same focus keeps
      // the conversation going.
      if (state && state.dialogue.length > 0 && state.dialogueContext !== context) {
        clearDialogue(sectionId);
      }
      startDialogue(sectionId, context);
      setTestsPanelTab('dialogue');
      // Persist the seed so the focus survives a reload before the first send.
      void saveCurrentState().catch(() => {});
    },
    [currentSection, clearDialogue, startDialogue, setTestsPanelTab, saveCurrentState],
  );

  const sendDialogueMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!currentSection || !trimmed) return;
      const sectionId = currentSection.id;
      const { testSuite, promptsConfig, isProcessing, modelConfig, globalModelDefault, modelCatalog } =
        useStore.getState();
      // Mutually exclusive with analyze/refactor (isProcessing) and with a
      // second concurrent send (inFlight) on this section.
      if (inFlight.has(sectionId) || isProcessing) return;

      const state = testSuite[sectionId]?.analysis;
      const nextMessages: DialogueMessage[] = [
        ...(state?.dialogue ?? []),
        { role: 'user', text: trimmed },
      ];

      // The whole conversation travels each turn (no history window); pre-flight
      // the assembled context + transcript and abort on overflow rather than
      // dropping older turns.
      const analysisResult = activeVersionOf(state)?.result;
      const budgetText = [
        state?.dialogueContext ?? '',
        analysisResult ? JSON.stringify(analysisResult) : '',
        ...nextMessages.map((m) => m.text),
      ].join('\n\n');
      const choice = resolveModelChoice('continueDialogue', modelConfig, globalModelDefault);
      if (!guardContextFit({ catalog: modelCatalog, choice, text: budgetText, what: 'This conversation', setting: 'Dialogue' })) {
        return;
      }

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
          onProgress: (t) => setStreaming({ sectionId, text: t }),
          onCommit: (t) => {
            setDialogue(sectionId, [...nextMessages, { role: 'model', text: t }]);
            void saveCurrentState().catch(() => {});
          },
        });
      } finally {
        inFlight.delete(sectionId);
        setStreaming((prev) => (prev?.sectionId === sectionId ? null : prev));
      }
    },
    [currentSection, setDialogue, saveCurrentState],
  );

  const concludeAndRefactor = useCallback(async () => {
    if (!currentSection) return;
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    const { testSuite, promptsConfig, isProcessing, analysisMode } = useStore.getState();
    if (isProcessing || inFlight.has(sectionId)) return;

    const state = testSuite[sectionId]?.analysis;
    const active = activeVersionOf(state);
    if (!state || !active) return;
    const dialogue = state.dialogue;
    if (!dialogue.some((m) => m.role === 'user') || !dialogue.some((m) => m.role === 'model')) return;

    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Refactoring analysis…' });
    try {
      const result = await aiProvider.refactorAnalysis({
        sectionTitle,
        sectionText,
        analysis: active.result,
        dialogue,
        dialogueContext: state.dialogueContext,
        mode: analysisMode,
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
    } catch (e) {
      // Dialogue and versions are untouched on failure: nothing mutates
      // until the provider call resolves.
      notifyAiError(e, `Refactor failed: ${errMessage(e)}`);
      setIsProcessing(false);
      useStore.getState().endOp(opId);
      return;
    }
    // The refactor succeeded the moment the version is in state; a save
    // failure is its own, distinct error.
    try {
      await saveCurrentState();
      toast.success('Analysis refactored.');
    } catch (e) {
      toast.error(`Refactor saved in memory, but writing to disk failed: ${errMessage(e)}`);
    } finally {
      setIsProcessing(false);
      useStore.getState().endOp(opId);
    }
  }, [currentSection, setIsProcessing, addAnalysisVersion, clearDialogue, setTestsPanelTab, saveCurrentState]);

  const discardDialogue = useCallback(() => {
    if (!currentSection || inFlight.has(currentSection.id)) return;
    // No confirm: a cleared transcript is recoverable — dialogues ride the
    // per-section YAML sidecar into git history (Version History restores).
    clearDialogue(currentSection.id);
    void saveCurrentState().catch(() => {});
  }, [currentSection, clearDialogue, saveCurrentState]);

  return { runAnalysis, interrogate, sendDialogueMessage, concludeAndRefactor, discardDialogue, streaming };
};
