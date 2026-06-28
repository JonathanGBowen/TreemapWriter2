import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import type { Section } from '../../types';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/** Depth-first lookup of a section by id (the tree is small; no memo needed). */
const findById = (nodes: Section[], id: string): Section | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findById(n.children, id);
    if (found) return found;
  }
  return null;
};

/**
 * Orchestration for the Climate Artist workspace: resolve the target text (whole
 * draft or a selected section), call the provider with the chosen instrument, and
 * land the prose verdict in the slice. Components → this hook → slice actions +
 * aiProvider; the SDK never crosses into feature code.
 *
 * Reads live state via `getState()` at call time so the callback keeps a stable
 * identity and always sees the current selection.
 */
export const useClimateActions = () => {
  const setClimateReport = useStore((s) => s.setClimateReport);
  const setClimateStatus = useStore((s) => s.setClimateStatus);

  const runAtmosphere = useCallback(async () => {
    const {
      markdown,
      sections,
      climateInstrument,
      climateTargetId,
      climateStatus,
      promptsConfig,
      modelCatalog,
      modelConfig,
      globalModelDefault,
    } = useStore.getState();

    if (climateStatus === 'running') return;

    let target: 'document' | 'section' = 'document';
    let sectionTitle: string | undefined;
    let text = markdown;

    if (climateTargetId) {
      const section = findById(sections, climateTargetId);
      if (!section) {
        toast.error('That section is no longer in the draft — pick another target.');
        return;
      }
      target = 'section';
      sectionTitle = section.title;
      text = section.fullContent;
    }

    if (!text.trim()) {
      toast.error('Nothing to read yet — the draft (or selected section) is empty.');
      return;
    }

    // The full target text is sent whole — never silently truncate. Pre-flight the
    // token budget and abort on overflow, asking for a larger-context model rather
    // than slicing the draft (cf. use-analysis-actions / use-comparison-actions).
    const choice = resolveModelChoice('analyzeAtmosphere', modelConfig, globalModelDefault);
    if (
      !guardContextFit({
        catalog: modelCatalog,
        choice,
        text,
        what: target === 'document' ? 'The whole draft' : 'This section',
        setting: 'Atmosphere',
      })
    ) {
      return;
    }

    setClimateStatus('running');
    const opId = useStore.getState().beginOp({ label: 'Reading atmosphere…', workspace: 'climate' });
    try {
      const report = await aiProvider.analyzeAtmosphere({
        instrument: climateInstrument,
        target,
        sectionTitle,
        text,
        config: promptsConfig,
      });
      if (!report) {
        setClimateStatus('error');
        toast.error('The model returned an empty reading — try again.');
        return;
      }
      setClimateReport(report);
      setClimateStatus('idle');
    } catch (e) {
      setClimateStatus('error');
      notifyAiError(e, `Atmospheric reading failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, [setClimateReport, setClimateStatus]);

  return { runAtmosphere };
};
