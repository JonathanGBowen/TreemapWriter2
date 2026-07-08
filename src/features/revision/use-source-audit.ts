import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { checkContextFit } from '../../services/ai/context-budget';
import { auditBudgetText, nextQueued } from '../../lib/audit-helpers';
import { notifyAiError } from '../shared/ai-error';
import { buildRootSection, findSectionById } from '../../lib/utils';
import type { AppState } from '../../state';
import type { Section } from '../../types';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * The pinned audit target's LIVE text. Re-derived every iteration (never captured
 * once at run start) because a mid-run accept rewrites the document — a source must
 * be audited against what the document says NOW, or its proposals anchor to text
 * that no longer exists and silently no-op at accept. For the whole document the
 * live editor buffer is the source of truth for the prose (`localContent`; the
 * committed `markdown` converges only after each save lands).
 */
const resolveAuditTarget = (st: AppState): Section | null => {
  if (!st.auditTargetId) return null;
  if (st.auditTargetId === 'root') {
    return buildRootSection(
      st.localContent || st.markdown,
      st.sections,
      st.projectName?.trim() || 'Whole Document',
    );
  }
  return findSectionById(st.sections, st.auditTargetId);
};

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
  const step = useCallback(async () => {
    // The pass this loop belongs to. Any epoch move (close / new pass / new
    // audit) orphans the loop — it must stop and drop whatever is in flight.
    // The reopenable `revisionWorkspaceOpen` boolean cannot carry that: close +
    // reopen while a call is in flight restores the flag, never the pass.
    const epoch = useStore.getState().revisionPassEpoch;

    for (;;) {
      const st = useStore.getState();
      if (st.revisionPassEpoch !== epoch || !st.revisionWorkspaceOpen) return;
      if (st.auditCancelled) {
        st.settleAuditRemaining('skipped', 'stopped');
        break;
      }
      const next = nextQueued(st.auditQueue);
      if (!next) break;
      const target = resolveAuditTarget(st);
      if (!target) {
        st.settleAuditRemaining('skipped', 'section changed');
        break;
      }
      const { title: documentTitle, fullContent: documentText } = target;
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
        // The pass may have been cleared or replaced while this call was in
        // flight — its results belong to a dead pass, so drop them.
        if (live.revisionPassEpoch !== epoch) return;
        live.appendProposals(proposals.map((p) => ({ ...p, _status: 'pending' as const })));
        live.patchAuditItem(source.id, { status: 'done', proposalCount: proposals.length });
      } catch (e) {
        notifyAiError(e, `Audit of "${source.label}" failed: ${errMessage(e)}`);
        const live = useStore.getState();
        // Same dead-pass rule as the success path: never stamp an old run's
        // error onto a fresh queue that may hold the same source.
        if (live.revisionPassEpoch === epoch) {
          live.patchAuditItem(source.id, { status: 'error', note: errMessage(e) });
        }
      } finally {
        useStore.getState().setIsProcessing(false);
        useStore.getState().endOp(opId);
      }

      const after = useStore.getState();
      if (after.revisionPassEpoch !== epoch) return;
      if (after.auditPacing === 'stepped' && !after.auditCancelled && nextQueued(after.auditQueue)) {
        after.setAuditAwaiting(true);
        return; // paused — continueAudit() resumes the loop
      }
    }

    const st = useStore.getState();
    if (st.revisionPassEpoch !== epoch) return;
    st.setAuditAwaiting(false);
    // Only land on review while the run's queue still exists — a pass cleared
    // out from under the loop (close / new pass) must stay cleared.
    if (st.auditQueue.length) st.setRevisionPhase('review');
  }, []);

  const runAudit = useCallback(async () => {
    const st = useStore.getState();
    if (st.isProcessing) return;
    const sources = st.sources.filter((s) => st.selectedSourceIds.includes(s.id));
    if (sources.length === 0) {
      toast.error('Select at least one source to audit.');
      return;
    }
    // Pin the run's target here (the section the workspace is on; 'root' for the
    // whole document) — rail navigation mid-run must not retarget the audit.
    st.startAudit(sources.map((s) => s.id), st.selectedId ?? 'root');
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
