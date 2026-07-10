import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { anchorFor, relocateBlock } from '../../lib/paragraph-helpers';
import { formatOutlineMarkdown } from '../../lib/doctor-helpers';
import { sourceHashOf } from '../../lib/parallel-helpers';
import type { DoctorOutlineRow, DoctorReportInstrument, DoctorRowInstrument } from '../../types';
import { doctorScopeFromState, type DoctorScope } from './use-doctor-scope';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/** Resolve the scope or toast the reason it can't be read. */
export const requireScope = (): DoctorScope | null => {
  const scope = doctorScopeFromState(useStore.getState());
  if (!scope) {
    toast.error('Nothing to read — the draft (or selected section) is empty or gone.');
  }
  return scope;
};

/**
 * Orchestration for the Doctor's one-shot instruments: resolve the live scope,
 * pre-flight the token budget, call the provider, land normalized rows/reports
 * in the slice. Components → this hook → slice actions + aiProvider; the SDK
 * never crosses into feature code. Callbacks read live state via `getState()`
 * so they keep stable identities (the climate-hook idiom).
 */
export const useDoctorActions = () => {
  /** Run one of the three row instruments over the current scope. */
  const runRows = useCallback(async (instrument: DoctorRowInstrument): Promise<boolean> => {
    const s = useStore.getState();
    if (s.doctorStatus === 'running' || s.doctorStatus === 'streaming') return false;
    const scope = requireScope();
    if (!scope) return false;
    if (!s.doctorThesis.trim()) {
      toast.error('Set a working thesis first — distill one or adopt the document claim.');
      return false;
    }

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
      return false;
    }

    s.setDoctorStatus('running');
    const LABEL: Record<DoctorRowInstrument, string> = {
      claims: 'Outlining…',
      saysDoes: 'Reading Says/Does…',
      thesisCheck: 'Checking coherence…',
    };
    const opId = s.beginOp({ label: LABEL[instrument], workspace: 'doctor' });
    try {
      const result = await aiProvider.runDoctorOutline({
        instrument,
        scopeTitle: scope.title,
        thesis: s.doctorThesis,
        blocks: scope.blocks.map((b) => ({ index: b.index, text: b.text, kind: b.kind })),
        config: s.promptsConfig,
      });
      const st = useStore.getState();
      if (result.instrument === 'claims') st.setDoctorOutlineRows(result.rows, sourceHashOf(scope.text));
      else if (result.instrument === 'saysDoes') st.setDoctorSaysDoesRows(result.rows);
      else st.setDoctorCoherenceRows(result.rows);
      st.setDoctorStatus('idle');
      return true;
    } catch (e) {
      useStore.getState().setDoctorStatus('error');
      notifyAiError(e, `Reading failed: ${errMessage(e)}`);
      return false;
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  /**
   * Run one of the three report instruments. They read the REVERSE OUTLINE (the
   * ported design), so a missing/stale claims outline is generated first — two
   * visible ops, never a hidden call; the interim outline lands as a result too.
   */
  const runReport = useCallback(
    async (instrument: DoctorReportInstrument) => {
      const s = useStore.getState();
      if (s.doctorStatus === 'running' || s.doctorStatus === 'streaming') return;
      const scope = requireScope();
      if (!scope) return;

      let rows: DoctorOutlineRow[] | null = s.doctorOutlineRows;
      const fresh = rows && s.doctorOutlineHash === sourceHashOf(scope.text);
      if (!fresh) {
        const ok = await runRows('claims');
        if (!ok) return;
        rows = useStore.getState().doctorOutlineRows;
      }
      if (!rows || rows.length === 0) return;

      const st = useStore.getState();
      st.setDoctorStatus('running');
      const opId = st.beginOp({ label: 'Analyzing the outline…', workspace: 'doctor' });
      try {
        const markdown = await aiProvider.runDoctorReport({
          instrument,
          scopeTitle: scope.title,
          thesis: st.doctorThesis,
          outlineMarkdown: formatOutlineMarkdown(rows, st.doctorThesis),
          config: st.promptsConfig,
        });
        if (!markdown) {
          useStore.getState().setDoctorStatus('error');
          toast.error('The model returned an empty report — try again.');
          return;
        }
        useStore.getState().setDoctorReport({ instrument, markdown });
        useStore.getState().setDoctorStatus('idle');
      } catch (e) {
        useStore.getState().setDoctorStatus('error');
        notifyAiError(e, `Report failed: ${errMessage(e)}`);
      } finally {
        useStore.getState().endOp(opId);
      }
    },
    [runRows],
  );

  /** The single-paragraph Saying-vs-Doing diagnostic on one scope block. */
  const runParagraph = useCallback(async (blockIndex: number) => {
    const s = useStore.getState();
    if (s.doctorStatus === 'running' || s.doctorStatus === 'streaming') return;
    const scope = requireScope();
    if (!scope) return;
    const block = scope.blocks[blockIndex];
    if (!block || block.kind !== 'prose') {
      toast.error('Pick a prose paragraph to diagnose.');
      return;
    }
    s.setDoctorParagraphIndex(blockIndex);
    s.setDoctorParagraphDiag(null);
    s.setDoctorStatus('running');
    const opId = s.beginOp({ label: 'Saying vs doing…', workspace: 'doctor' });
    try {
      const diag = await aiProvider.runDoctorParagraph({ paragraph: block.text, config: s.promptsConfig });
      if (!diag) {
        useStore.getState().setDoctorStatus('error');
        toast.error('The model returned no usable diagnosis — try again.');
        return;
      }
      useStore.getState().setDoctorParagraphDiag(diag);
      useStore.getState().setDoctorStatus('idle');
    } catch (e) {
      useStore.getState().setDoctorStatus('error');
      notifyAiError(e, `Diagnosis failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  /** The Thesis Distiller: 3 candidate theses over the scope's prose. */
  const runDistiller = useCallback(async () => {
    const s = useStore.getState();
    if (s.doctorStatus === 'running' || s.doctorStatus === 'streaming') return;
    const scope = requireScope();
    if (!scope) return;
    if (scope.text.trim().length < 50) {
      toast.error('The draft is too short to distill a thesis from.');
      return;
    }
    const choice = resolveModelChoice('distillThesis', s.modelConfig, s.globalModelDefault);
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
    const opId = s.beginOp({ label: 'Distilling a thesis…', workspace: 'doctor' });
    try {
      const options = await aiProvider.distillThesis({ text: scope.text, config: s.promptsConfig });
      if (options.length === 0) {
        useStore.getState().setDoctorStatus('error');
        toast.error('The model returned no usable thesis options — try again.');
        return;
      }
      useStore.getState().setDoctorThesisOptions(options);
      useStore.getState().setDoctorStatus('idle');
    } catch (e) {
      useStore.getState().setDoctorStatus('error');
      notifyAiError(e, `Distillation failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  /**
   * Jump the editor to a scope block: relocate the block's verbatim anchor in
   * the LIVE buffer (survives edits elsewhere), hand the offset to the editor's
   * reveal channel, and step out of the workspace.
   */
  const revealBlock = useCallback((blockIndex: number) => {
    const s = useStore.getState();
    const scope = doctorScopeFromState(s);
    const block = scope?.blocks[blockIndex];
    if (!block) return;
    const live = s.localContent || s.markdown;
    const located = relocateBlock(live, anchorFor(block.text));
    if (!located) {
      toast.error('That paragraph has changed too much to locate — regenerate the reading.');
      return;
    }
    if (s.doctorTargetId) s.setSelectedId(s.doctorTargetId);
    s.setPendingEditorReveal({ offset: located.startOffset });
    s.closeDoctor();
  }, []);

  return { runRows, runReport, runParagraph, runDistiller, revealBlock };
};
