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
      if (result.instrument !== 'thesisCheck') return; // unreachable; type narrowing
      const st = useStore.getState();
      st.setDoctorCoherenceRows(result.rows);
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
    const epoch = s.doctorWizardEpoch;
    s.setDoctorCriticalIssue('');
    useStore.setState({ doctorDiagnosis: '' });
    s.setDoctorStatus('streaming');
    const opId = s.beginOp({ label: 'Diagnosing…', workspace: 'doctor' });
    try {
      const stream = aiProvider.diagnoseStructure({
        outlineData: formatOutlineData(rows),
        config: s.promptsConfig,
      });
      for await (const chunk of stream) {
        const st = useStore.getState();
        // A retreat/reset/scope-change bumped the epoch — stop landing stale prose.
        if (st.doctorWizardEpoch !== epoch) return;
        st.appendDoctorDiagnosis(chunk);
      }
      const st = useStore.getState();
      if (st.doctorWizardEpoch !== epoch) return;
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
    s.setDoctorStatus('running');
    const opId = s.beginOp({ label: 'Drawing roadmaps…', workspace: 'doctor' });
    try {
      const roadmaps = await aiProvider.proposeRoadmaps({
        criticalIssue: s.doctorCriticalIssue.trim(),
        outlineData: formatOutlineData(rows),
        config: s.promptsConfig,
      });
      if (roadmaps.length === 0) {
        useStore.getState().setDoctorStatus('error');
        toast.error('The model returned no usable roadmaps — try again.');
        return;
      }
      const st = useStore.getState();
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
    s.setDoctorStatus('running');
    const opId = s.beginOp({ label: 'Writing the checklist…', workspace: 'doctor' });
    try {
      const tasks = await aiProvider.generateDoctorChecklist({
        chosenRoadmap: roadmap,
        outlineData: formatOutlineData(rows),
        blocks: scope.blocks.map((b) => ({ index: b.index, text: b.text, kind: b.kind })),
        config: s.promptsConfig,
      });
      if (tasks.length === 0) {
        useStore.getState().setDoctorStatus('error');
        toast.error('The model returned no usable tasks — try again.');
        return;
      }
      const st = useStore.getState();
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
    if (!scope || !roadmap || !s.doctorDraftTasks?.length) return;
    const checklist: DoctorChecklist = {
      scopeKey: scope.scopeKey,
      thesis: s.doctorThesis,
      criticalIssue: s.doctorCriticalIssue,
      roadmapTitle: roadmap.title,
      roadmapOutline: roadmap.outline,
      tasks: s.doctorDraftTasks,
      createdAt: Date.now(),
      sourceHash: sourceHashOf(scope.text),
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
