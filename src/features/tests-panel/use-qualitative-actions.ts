import { useCallback } from 'react';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { computeHash } from '../../lib/utils';
import { buildStructuralSurround, formatStructuralSurround } from '../../lib/diagnostic-helpers';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { useCurrentSection } from './use-current-section';
import type { FeltTrouble } from '../../types';

/**
 * Sections with a Deweyan qualitative op in flight. Module-level so the guard
 * survives a remount (mirrors the gestalt + analysis hooks' `inFlight`).
 */
const inFlight = new Set<string>();

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * The Deweyan qualitative operations (docs/dewey-design.md), surfaced beside the
 * gestalt ones. Two ephemeral readings — the document's pervasive quality (the
 * "ground", on root) and the Goya test (does this part carry it?) — plus the
 * "felt before stated" ramp, which is PERSISTED (a writer-typed note is
 * intellectual work) and therefore calls `saveCurrentState()`. All three share
 * the global `isProcessing` lock with the other heavyweight AI calls.
 */
export const useQualitativeActions = () => {
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setQualitativeSignature = useStore((s) => s.setQualitativeSignature);
  const setPartQuality = useStore((s) => s.setPartQuality);
  const setFeltTrouble = useStore((s) => s.setFeltTrouble);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const currentSection = useCurrentSection();

  // --- the qualitative signature (the "ground"): root only -----------------
  const runReadPervasiveQuality = useCallback(async () => {
    if (!currentSection) return;
    const { id: sectionId, title: documentTitle, fullContent: documentText } = currentSection;
    // The pervasive quality is read from the WHOLE; it lives on the root.
    if (sectionId !== 'root') return;
    const { promptsConfig, isProcessing, modelConfig, globalModelDefault, modelCatalog } = useStore.getState();
    if (isProcessing || inFlight.has(sectionId)) return;

    const choice = resolveModelChoice('readPervasiveQuality', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text: documentText,
        what: 'This document',
        setting: 'Pervasive quality',
      })
    ) {
      return;
    }

    inFlight.add(sectionId);
    setIsProcessing(true);
    try {
      const result = await aiProvider.readPervasiveQuality({ documentTitle, documentText, config: promptsConfig });
      if (!result) {
        notifyAiError(new Error('empty response'), 'Pervasive quality returned no usable reading.');
        return;
      }
      setQualitativeSignature(sectionId, { ...result, timestamp: Date.now(), inputHash: computeHash(documentText) });
    } catch (e) {
      notifyAiError(e, `Pervasive quality failed: ${errMessage(e)}`);
    } finally {
      inFlight.delete(sectionId);
      setIsProcessing(false);
    }
  }, [currentSection, setIsProcessing, setQualitativeSignature]);

  // --- the Goya test: a part read against the whole's quality --------------
  const runReadPartQuality = useCallback(async () => {
    if (!currentSection) return;
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    if (sectionId === 'root') return;
    const { testSuite, isProcessing, modelConfig, globalModelDefault, modelCatalog, promptsConfig } = useStore.getState();
    if (isProcessing || inFlight.has(sectionId)) return;

    const documentQuality = testSuite['root']?.qualitativeSignature?.quality?.trim() || undefined;
    const choice = resolveModelChoice('readPartQuality', modelConfig, globalModelDefault);
    if (
      !guardContextFit({ catalog: modelCatalog, choice, text: sectionText, what: 'This section', setting: 'Goya test' })
    ) {
      return;
    }

    inFlight.add(sectionId);
    setIsProcessing(true);
    try {
      const result = await aiProvider.readPartQuality({ sectionTitle, sectionText, documentQuality, config: promptsConfig });
      if (!result) {
        notifyAiError(new Error('empty response'), 'Goya test returned no usable reading.');
        return;
      }
      setPartQuality(sectionId, { ...result, timestamp: Date.now(), inputHash: computeHash(sectionText) });
    } catch (e) {
      notifyAiError(e, `Goya test failed: ${errMessage(e)}`);
    } finally {
      inFlight.delete(sectionId);
      setIsProcessing(false);
    }
  }, [currentSection, setIsProcessing, setPartQuality]);

  // --- the felt note (persisted) -------------------------------------------
  const saveFeltNote = useCallback(
    async (note: string) => {
      if (!currentSection) return;
      const { id: sectionId } = currentSection;
      const { testSuite } = useStore.getState();
      const existing = testSuite[sectionId]?.feltTrouble;
      const trimmed = note.trim();
      // Clearing the note clears the whole register (note is the anchor).
      const next: FeltTrouble | undefined = trimmed
        ? { ...existing, note: trimmed, timestamp: Date.now() }
        : undefined;
      setFeltTrouble(sectionId, next);
      try {
        await saveCurrentState();
      } catch {
        // The note lives in memory; a disk-write failure is non-fatal here.
      }
    },
    [currentSection, setFeltTrouble, saveCurrentState],
  );

  // --- the "felt before stated" ramp: note → located gap → vector ----------
  const runArticulateTrouble = useCallback(async () => {
    if (!currentSection) return;
    const { id: sectionId, title: sectionTitle, fullContent: sectionText } = currentSection;
    const { testSuite, sections, promptsConfig, isProcessing, modelConfig, globalModelDefault, modelCatalog } =
      useStore.getState();
    if (isProcessing || inFlight.has(sectionId)) return;

    const feltNote = testSuite[sectionId]?.feltTrouble?.note?.trim();
    if (!feltNote) return;

    const specs = Object.fromEntries(Object.entries(testSuite).map(([id, e]) => [id, e?.spec]));
    const structuralSurround =
      sectionId === 'root'
        ? undefined
        : formatStructuralSurround(buildStructuralSurround(sectionId, sections, specs)) || undefined;

    const choice = resolveModelChoice('articulateTrouble', modelConfig, globalModelDefault);
    if (
      !guardContextFit({ catalog: modelCatalog, choice, text: sectionText, what: 'This section', setting: 'Articulate trouble' })
    ) {
      return;
    }

    inFlight.add(sectionId);
    setIsProcessing(true);
    try {
      const result = await aiProvider.articulateTrouble({
        sectionTitle,
        sectionText,
        feltNote,
        structuralSurround,
        config: promptsConfig,
      });
      if (!result) {
        notifyAiError(new Error('empty response'), 'Articulate trouble returned no usable result.');
        return;
      }
      const existing = useStore.getState().testSuite[sectionId]?.feltTrouble;
      setFeltTrouble(sectionId, {
        note: existing?.note ?? feltNote,
        timestamp: existing?.timestamp ?? Date.now(),
        articulated: result,
        articulatedHash: computeHash(sectionText),
      });
      try {
        await saveCurrentState();
      } catch {
        /* in-memory; disk-write failure non-fatal */
      }
    } catch (e) {
      notifyAiError(e, `Articulate trouble failed: ${errMessage(e)}`);
    } finally {
      inFlight.delete(sectionId);
      setIsProcessing(false);
    }
  }, [currentSection, setIsProcessing, setFeltTrouble, saveCurrentState]);

  return { runReadPervasiveQuality, runReadPartQuality, saveFeltNote, runArticulateTrouble };
};
