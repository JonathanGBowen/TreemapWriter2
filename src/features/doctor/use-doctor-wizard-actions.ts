import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import {
  checklistToMarkdown,
  extractCriticalIssue,
  formatOutlineData,
} from '../../lib/doctor-helpers';
import { sourceHashOf } from '../../lib/parallel-helpers';
import type { DoctorChecklist } from '../../types';
import { doctorScopeFromState } from './use-doctor-scope';
import { requireScope } from './use-doctor-actions';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * The wizard's five-step chain (the renamed Breakthrough Sequence), context
 * threaded exactly as the ported app chained it: the step-2 coherence table
 * (`outlineData`, recomputed from the rows at call time — never a duplicated
 * copy) is re-fed at steps 3, 4, and 5.
 */
export const useDoctorWizardActions = () => {
  /** Step 2 — Calibration: the thesis check over the live scope. */
  const runCalibration = useCallback(async () => {
    const s = useStore.getState();
    if (s.doctorStatus !== 'idle' && s.doctorStatus !== 'error') return;
    const scope = requireScope();
    if (!scope) return;

    const choice = resolveModelChoice('runDoctorOutline', s.modelConfig, s.globalModelDefault);
    if (
      !guardContextFit({
        catalog: s.modelCatalog,
        choice,
        text: scope.text,
        what: scope.scopeKey === 'root' ? 'The whole draft' : 'This section',
        setting: 'Outline Doctor',
      })
    ) {
      return;
    }

    const epoch = s.doctorEpoch;
    s.setDoctorStatus('running');
    const opId = s.beginOp({ label: 'Calibrating…', workspace: 'doctor' });
    try {
      const result = await aiProvider.runDoctorOutline({
        instrument: 'thesisCheck',
        scopeTitle: scope.title,
        thesis: s.doctorThesis,
        blocks: scope.blocks.map((b) => ({ index: b.index, text: b.text, kind: b.kind })),
        config: s.promptsConfig,
      });
      const st = useStore.getState();
      // Dropped if the writer closed / switched scope / edited the thesis mid-call.
      if (st.doctorEpoch !== epoch) return;
      if (result.instrument !== 'thesisCheck') return; // unreachable; type narrowing
      // Stamp the calibration-time prose hash: the coherence table's ¶ numbers
      // (the wizard's outlineData) only mean anything against this exact prose.
      st.setDoctorCoherenceRows(result.rows, sourceHashOf(scope.text));
      st.setDoctorStatus('idle');
      st.advanceDoctorStep();
    } catch (e) {
      useStore.getState().setDoctorStatus('error');
      notifyAiError(e, `Calibration failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  /** Step 3 — Diagnosis: streamed Senior-Editor CoT over the coherence table. */
  const runDiagnosis = useCallback(async () => {
    const s = useStore.getState();
    if (s.doctorStatus !== 'idle' && s.doctorStatus !== 'error') return;
    const rows = s.doctorCoherenceRows;
    if (!rows || rows.length === 0) {
      toast.error('Run the calibration first — the diagnosis reads its table.');
      return;
    }
    const epoch = s.doctorEpoch;
    s.setDoctorCriticalIssue('');
    s.clearDoctorDiagnosis();
    s.setDoctorStatus('streaming');
    const opId = s.beginOp({ label: 'Diagnosing…', workspace: 'doctor' });
    try {
      const stream = aiProvider.diagnoseStructure({
        outlineData: formatOutlineData(rows),
        config: s.promptsConfig,
      });
      for await (const chunk of stream) {
        const st = useStore.getState();
        // A close/retreat/reset/scope-change/thesis-change bumped the epoch —
        // stop landing stale prose (a second stream can't interleave into this buffer).
        if (st.doctorEpoch !== epoch) return;
        st.appendDoctorDiagnosis(chunk);
      }
      const st = useStore.getState();
      if (st.doctorEpoch !== epoch) return;
      st.setDoctorCriticalIssue(extractCriticalIssue(st.doctorDiagnosis));
      st.setDoctorStatus('idle');
    } catch (e) {
      useStore.getState().setDoctorStatus('error');
      notifyAiError(e, `Diagnosis failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  /** Step 4 — Strategy: three rescue roadmaps for the (possibly edited) issue. */
  const runStrategy = useCallback(async () => {
    const s = useStore.getState();
    if (s.doctorStatus !== 'idle' && s.doctorStatus !== 'error') return;
    const rows = s.doctorCoherenceRows;
    if (!rows || !s.doctorCriticalIssue.trim()) {
      toast.error('Name the critical issue first (step 3).');
      return;
    }
    const epoch = s.doctorEpoch;
    s.setDoctorStatus('running');
    const opId = s.beginOp({ label: 'Drawing roadmaps…', workspace: 'doctor' });
    try {
      const roadmaps = await aiProvider.proposeRoadmaps({
        criticalIssue: s.doctorCriticalIssue.trim(),
        outlineData: formatOutlineData(rows),
        config: s.promptsConfig,
      });
      const st = useStore.getState();
      if (st.doctorEpoch !== epoch) return; // stale — dropped
      if (roadmaps.length === 0) {
        st.setDoctorStatus('error');
        toast.error('The model returned no usable roadmaps — try again.');
        return;
      }
      st.setDoctorRoadmaps(roadmaps);
      st.setDoctorStatus('idle');
    } catch (e) {
      useStore.getState().setDoctorStatus('error');
      notifyAiError(e, `Roadmaps failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  /** Step 5 — Action: the chosen roadmap becomes ¶-anchored draft tasks. */
  const runChecklist = useCallback(async () => {
    const s = useStore.getState();
    if (s.doctorStatus !== 'idle' && s.doctorStatus !== 'error') return;
    const scope = requireScope();
    const rows = s.doctorCoherenceRows;
    const roadmap = s.doctorChosenRoadmap != null ? s.doctorRoadmaps?.[s.doctorChosenRoadmap] : null;
    if (!scope || !rows || !roadmap) {
      toast.error('Choose a roadmap first (step 4).');
      return;
    }
    // The checklist's ¶ numbers come from the calibration-time coherence table,
    // and its anchors resolve against the LIVE blocks — so the two only agree
    // while the prose is unchanged since calibration. If it has drifted, the plan
    // would mis-anchor every task silently; require a recalibrate first.
    if (s.doctorScopeHash && sourceHashOf(scope.text) !== s.doctorScopeHash) {
      toast.error('The draft changed since calibration — recalibrate (step 2) so the plan anchors correctly.');
      return;
    }
    const epoch = s.doctorEpoch;
    s.setDoctorStatus('running');
    const opId = s.beginOp({ label: 'Writing the checklist…', workspace: 'doctor' });
    try {
      const tasks = await aiProvider.generateDoctorChecklist({
        chosenRoadmap: roadmap,
        outlineData: formatOutlineData(rows),
        blocks: scope.blocks.map((b) => ({ index: b.index, text: b.text, kind: b.kind })),
        config: s.promptsConfig,
      });
      const st = useStore.getState();
      if (st.doctorEpoch !== epoch) return; // stale — dropped
      if (tasks.length === 0) {
        st.setDoctorStatus('error');
        toast.error('The model returned no usable tasks — try again.');
        return;
      }
      st.setDoctorDraftTasks(tasks);
      st.setDoctorStatus('idle');
      st.advanceDoctorStep();
    } catch (e) {
      useStore.getState().setDoctorStatus('error');
      notifyAiError(e, `Checklist failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  /** Persist the previewed checklist as the project's work ledger + autosave. */
  const saveChecklist = useCallback(() => {
    const s = useStore.getState();
    const scope = doctorScopeFromState(s);
    const roadmap = s.doctorChosenRoadmap != null ? s.doctorRoadmaps?.[s.doctorChosenRoadmap] : null;
    if (!roadmap || !s.doctorDraftTasks?.length) return;
    if (!scope) {
      // The target section was renamed/deleted mid-wizard, so its id no longer
      // resolves — say so rather than let the Save button look broken.
      toast.error('The target section is no longer in the draft — reopen the sequence on a current scope.');
      return;
    }
    const checklist: DoctorChecklist = {
      scopeKey: scope.scopeKey,
      thesis: s.doctorThesis,
      criticalIssue: s.doctorCriticalIssue,
      roadmapTitle: roadmap.title,
      roadmapOutline: roadmap.outline,
      tasks: s.doctorDraftTasks,
      createdAt: Date.now(),
      // The GENERATION-time hash (the prose the ¶ numbers refer to), not the
      // save-time prose — so ChecklistPanel's staleness badge is honest about
      // any edit made between calibration and save. Falls back to live only if
      // calibration somehow left no hash.
      sourceHash: s.doctorScopeHash ?? sourceHashOf(scope.text),
    };
    s.setDoctorChecklist(checklist);
    void s.saveCurrentState();
    toast.success('Checklist saved with the project.');
  }, []);

  /**
   * Hand the saved checklist to Living Sprints: seed a plain goal framing named
   * after the roadmap, ground the plan in the checklist markdown (it travels as
   * `extraContext`), and open the sprint straight at the plan-review phase.
   */
  const sendToSprint = useCallback(() => {
    const s = useStore.getState();
    const checklist = s.doctorChecklist;
    if (!checklist) return;
    // A sprint attaches to a section; a draft with no sections would open the
    // modal onto nothing and strand its open flag. Refuse loudly instead.
    if (s.sections.length === 0) {
      toast.error('Add at least one section heading before sending the plan to a sprint.');
      return;
    }
    s.setSprintSeed({
      framing: { model: 'plain', wish: `Execute revision roadmap: ${checklist.roadmapTitle}` },
      transcript: checklistToMarkdown(checklist),
    });
    s.setSprintMode('content');
    s.closeDoctor();
    s.setShowSprintModal(true);
  }, []);

  /** Download the saved checklist as markdown (the App.tsx export idiom). */
  const downloadChecklistMd = useCallback(() => {
    const s = useStore.getState();
    const checklist = s.doctorChecklist;
    if (!checklist) return;
    const blob = new Blob([checklistToMarkdown(checklist)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = s.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `${name}-revision-checklist-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    runCalibration,
    runDiagnosis,
    runStrategy,
    runChecklist,
    saveChecklist,
    sendToSprint,
    downloadChecklistMd,
  };
};
