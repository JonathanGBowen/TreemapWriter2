import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { checkContextFit } from '../../services/ai/context-budget';
import { auditBudgetText, nextQueued } from '../../lib/audit-helpers';
import { notifyAiError } from '../shared/ai-error';
import { useCurrentSection } from '../tests-panel/use-current-section';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * Orchestration for the per-source batch citation audit: one focused
 * `auditSourceUsage` call per selected source, sequenced (the RequestThrottle
 * spaces the calls), each collected into the shared proposal queue for the
 * unchanged accept gate. One source failing or overflowing the model window
 * never sinks the run — it is marked (error / skipped + note) and the sweep
 * continues, the segment-sweep idiom. Stepped pacing pauses between sources;
 * stop settles the remainder at the next source boundary.
 */
export const useSourceAudit = () => {
  const currentSection = useCurrentSection();

  const step = useCallback(async () => {
    if (!currentSection) return;
    const { title: documentTitle, fullContent: documentText } = currentSection;

    for (;;) {
      const st = useStore.getState();
      if (st.auditCancelled) {
        st.settleAuditRemaining('skipped', 'stopped');
        break;
      }
      const next = nextQueued(st.auditQueue);
      if (!next) break;
      const source = st.sources.find((s) => s.id === next.sourceId);
      if (!source) {
        st.patchAuditItem(next.sourceId, { status: 'skipped', note: 'source removed' });
        continue;
      }

      // Per-source pre-flight: an over-window source is SKIPPED with a note (a
      // visible outcome), never an abort of the whole run — unlike the single-pass
      // guardContextFit, which toasts and aborts.
      const choice = resolveModelChoice('auditSourceUsage', st.modelConfig, st.globalModelDefault);
      const fit = checkContextFit(
        st.modelCatalog,
        choice,
        auditBudgetText(documentText, source, st.directive),
      );
      if (fit.overflow) {
        st.patchAuditItem(source.id, {
          status: 'skipped',
          note: `~${Math.round(fit.estimatedTokens / 1000)}k tokens — exceeds ${choice.model}'s window`,
        });
        continue;
      }

      st.patchAuditItem(source.id, { status: 'auditing' });
      // The lock is held per CALL (not per run) so a stepped pause never locks the app.
      st.setIsProcessing(true);
      const opId = st.beginOp({ label: `Auditing ${source.label}…`, workspace: 'revision' });
      try {
        const proposals = await aiProvider.auditSourceUsage({
          documentTitle,
          documentText,
          source,
          directive: st.directive,
        });
        const live = useStore.getState();
        live.appendProposals(proposals.map((p) => ({ ...p, _status: 'pending' as const })));
        live.patchAuditItem(source.id, { status: 'done', proposalCount: proposals.length });
      } catch (e) {
        notifyAiError(e, `Audit of "${source.label}" failed: ${errMessage(e)}`);
        useStore.getState().patchAuditItem(source.id, { status: 'error', note: errMessage(e) });
      } finally {
        useStore.getState().setIsProcessing(false);
        useStore.getState().endOp(opId);
      }

      const after = useStore.getState();
      if (after.auditPacing === 'stepped' && !after.auditCancelled && nextQueued(after.auditQueue)) {
        after.setAuditAwaiting(true);
        return; // paused — continueAudit() resumes the loop
      }
    }

    const st = useStore.getState();
    st.setAuditAwaiting(false);
    st.setRevisionPhase('review');
  }, [currentSection]);

  const runAudit = useCallback(async () => {
    const st = useStore.getState();
    if (st.isProcessing) return;
    const sources = st.sources.filter((s) => st.selectedSourceIds.includes(s.id));
    if (sources.length === 0) {
      toast.error('Select at least one source to audit.');
      return;
    }
    st.startAudit(sources.map((s) => s.id));
    await step();
  }, [step]);

  const continueAudit = useCallback(async () => {
    useStore.getState().setAuditAwaiting(false);
    await step();
  }, [step]);

  /** Stop at the source boundary; if the run is paused, settle immediately. */
  const stopAudit = useCallback(() => {
    const st = useStore.getState();
    st.requestAuditCancel();
    if (st.auditAwaiting) {
      st.settleAuditRemaining('skipped', 'stopped');
      st.setAuditAwaiting(false);
      st.setRevisionPhase('review');
    }
  }, []);

  return { runAudit, continueAudit, stopAudit };
};
