import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveOperand } from '../../lib/compareHelpers';
import { parseMarkdown } from '../../lib/utils';
import { buildSpecByTitle } from '../../lib/specTestHelpers';
import { runSpecTestForOperands } from '../../lib/specTestRun';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { checkContextFit } from '../../services/ai/context-budget';
import { notifyAiError } from '../shared/ai-error';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * Orchestration for the Spec Test workspace: resolve the two operands, build the
 * HELD rubric (live testSuite by default, or snapshot A's frozen specs), pre-flight
 * the per-section context budget, run the store-free engine
 * (lib/specTestRun.runSpecTestForOperands), and land the report — filling the card
 * incrementally as each section resolves. Components → this hook → slice + the pure
 * engine; the SDK never crosses into feature code. The Compare fold calls the SAME
 * engine, so there is no divergent logic.
 */
export const useSpecTestActions = () => {
  const setReport = useStore((s) => s.setSpecTestReport);
  const setStatus = useStore((s) => s.setSpecTestStatus);
  const resetPartial = useStore((s) => s.resetSpecTestPartial);

  const runSpecTest = useCallback(async () => {
    const st = useStore.getState();
    if (st.specTestStatus === 'running') return;

    const a = resolveOperand(st.specTestAId, st.specTestLoadedA, st.localContent);
    const b = resolveOperand(st.specTestBId, st.specTestLoadedB, st.localContent);
    if (!a || !b) {
      toast.error('That version is still loading — try again in a moment.');
      return;
    }
    if (a.markdown === b.markdown) {
      toast.error('Pick two different versions to test.');
      return;
    }

    // The held rubric: snapshot A's frozen specs if asked AND available, else live.
    const snapSuite = st.specTestLoadedA?.testSuite;
    const fromLive = st.specTestRubricSource === 'live' || !snapSuite;
    const rubricSections = fromLive ? st.sections : parseMarkdown(st.specTestLoadedA!.markdown);
    const rubricSuite = fromLive ? st.testSuite : snapSuite!;
    const specByTitle = buildSpecByTitle(rubricSections, rubricSuite);
    if (specByTitle.size === 0) {
      toast.error('No section specs to test against — author or generate specs first.');
      return;
    }
    const rootSpec = rubricSuite['root']?.spec;

    // Per-section context pre-flight (mirrors Version Compare): skip + warn rather
    // than truncate. The part call carries one section's A+B prose + surround.
    const choice = resolveModelChoice('runSpecTestSection', st.modelConfig, st.globalModelDefault);
    const shouldSkipForContext = (proseA: string, proseB: string) =>
      checkContextFit(st.modelCatalog, choice, `${proseA}\n\n${proseB}`).overflow;

    setReport(null);
    resetPartial();
    setStatus('running');
    const opId = useStore.getState().beginOp({ label: 'Running spec test…', workspace: 'spec-test' });
    try {
      const report = await runSpecTestForOperands(aiProvider, a, b, {
        specByTitle,
        rubricSections,
        rootSpec,
        scope: st.specTestScope,
        mode: st.specTestMode,
        rubricSource: fromLive ? 'live' : 'snapshot-a',
        config: st.promptsConfig,
        onSection: (r) => useStore.getState().pushSpecTestSection(r),
        shouldSkipForContext,
      });
      setReport(report);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      notifyAiError(e, `Spec test failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, [setReport, setStatus, resetPartial]);

  return { runSpecTest };
};
