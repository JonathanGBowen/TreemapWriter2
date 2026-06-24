import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { getPromptText } from '../../services/prompts';
import { applyProposal } from '../../lib/revision-helpers';
import { segmentParagraphs } from '../../lib/paragraph-helpers';
import { sourceHashOf } from '../../lib/parallel-helpers';
import {
  buildRowsForScope,
  changedRows,
  outlineDocFromRows,
  rowsNeedingRegen,
  type ParallelRow,
} from '../../state/parallel-state';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { scopeFromState } from './use-parallel-scope';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/** Cap concurrent regenerate calls so a whole-doc pass doesn't fan out unbounded. */
const REGEN_CONCURRENCY = 3;
const runPooled = async <T>(items: T[], cap: number, fn: (item: T) => Promise<void>): Promise<void> => {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) await fn(items[cursor++]);
  };
  await Promise.all(Array.from({ length: Math.min(cap, items.length) }, worker));
};

/**
 * Apply one accepted row to the document string. Edited/deleted rows are a literal
 * draftA→draftB splice (deletion is draftB ''); an inserted row's draftB is spliced
 * in after the nearest preceding real paragraph (or prepended if none). Mirrors the
 * Glass Box "first literal occurrence" contract — a no-op if the anchor is gone.
 */
const applyRowToDoc = (doc: string, row: ParallelRow, rows: ParallelRow[]): string => {
  if (row.status === 'inserted') {
    const text = (row.draftB ?? '').trim();
    if (!text) return doc;
    const idx = rows.findIndex((r) => r.id === row.id);
    const prev = rows.slice(0, idx).reverse().find((r) => r.draftA && r.status !== 'deleted');
    if (!prev) return `${text}\n\n${doc}`;
    const at = doc.indexOf(prev.draftA);
    if (at < 0) return doc;
    const end = at + prev.draftA.length;
    return `${doc.slice(0, end)}\n\n${text}${doc.slice(end)}`;
  }
  return applyProposal(doc, { original_text: row.draftA, proposed_text: row.draftB ?? '' });
};

/**
 * Orchestration for the Parallel Editor: hydrate rows from the saved outline,
 * generate the reverse outline, regenerate changed paragraphs, accept (write +
 * snapshot for undo). Components → this hook → slice actions + aiProvider; the AI
 * SDK never crosses into feature code. Mirrors use-revision-actions: live state via
 * getState() at call time, the global `isProcessing` lock for heavyweight calls,
 * toast on failure, persistence failure surfaced separately.
 */
export const useParallelActions = () => {
  const setRows = useStore((s) => s.setRows);
  const setSourceHash = useStore((s) => s.setSourceHash);
  const setParallelPhase = useStore((s) => s.setParallelPhase);
  const setRowDraftB = useStore((s) => s.setRowDraftB);
  const setRegenerating = useStore((s) => s.setRegenerating);
  const markRowAccepted = useStore((s) => s.markRowAccepted);
  const resetRow = useStore((s) => s.resetRow);
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setLocalContent = useStore((s) => s.setLocalContent);
  const upsertReverseOutline = useStore((s) => s.upsertReverseOutline);
  const createSnapshot = useStore((s) => s.createSnapshot);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

  /** (Re)build rows for the current scope from its saved outline. */
  const hydrate = useCallback(() => {
    const s = useStore.getState();
    const scope = scopeFromState(s);
    if (!scope) {
      setRows([]);
      setParallelPhase('idle');
      return;
    }
    const saved = s.reverseOutlines.find((d) => d.scopeKey === scope.scopeKey);
    const rows = buildRowsForScope(scope.text, saved);
    setRows(rows);
    setSourceHash(sourceHashOf(scope.text));
    setParallelPhase(rows.length ? 'editing' : 'idle');
  }, [setRows, setSourceHash, setParallelPhase]);

  /** Persist the current outlineA (corrections + generated distillations). */
  const persistOutline = useCallback(async () => {
    const s = useStore.getState();
    const scope = scopeFromState(s);
    if (!scope) return;
    upsertReverseOutline(outlineDocFromRows(scope.scopeKey, s.rows, sourceHashOf(scope.text)));
    try {
      await saveCurrentState();
    } catch {
      /* outline persistence is best-effort; the prose is the durable artifact */
    }
  }, [upsertReverseOutline, saveCurrentState]);

  /** Distill the blank prose paragraphs into one-sentence reverse-outline bullets. */
  const generateOutline = useCallback(async () => {
    const s = useStore.getState();
    const scope = scopeFromState(s);
    if (!scope || s.isProcessing) return;
    const rows = s.rows;
    const blocks = segmentParagraphs(scope.text);
    const blanks = blocks.filter((b, i) => b.kind === 'prose' && !rows[i]?.outlineA.trim());
    if (!blanks.length) return;

    const choice = resolveModelChoice('generateReverseOutline', s.modelConfig, s.globalModelDefault);
    if (
      !guardContextFit({
        catalog: s.modelCatalog,
        choice,
        text: scope.text,
        what: scope.scopeKey === 'root' ? 'The whole document' : 'This section',
        setting: 'Reverse outline',
      })
    ) {
      return;
    }

    setParallelPhase('outlining');
    setIsProcessing(true);
    try {
      const bullets = await aiProvider.generateReverseOutline({
        sectionTitle: scope.title,
        blocks: blanks.map((b) => ({ index: b.index, text: b.text, kind: b.kind })),
        config: s.promptsConfig,
      });
      const byIndex = new Map(bullets.map((b) => [b.index, b.sentence]));
      // Fill only the rows we distilled; existing/corrected outlineA is preserved.
      const next = useStore.getState().rows.map((r, i) =>
        byIndex.has(i) ? { ...r, outlineA: byIndex.get(i) ?? '', outlineB: byIndex.get(i) ?? '' } : r,
      );
      setRows(next);
      setParallelPhase('editing');
      await persistOutline();
    } catch (e) {
      notifyAiError(e, `Reverse outline failed: ${errMessage(e)}`);
      setParallelPhase('editing');
    } finally {
      setIsProcessing(false);
    }
  }, [setParallelPhase, setIsProcessing, setRows, persistOutline]);

  /** Regenerate each changed paragraph (edited bullet or inserted row). */
  const regenerateChanged = useCallback(async () => {
    const s = useStore.getState();
    const scope = scopeFromState(s);
    if (!scope || s.isProcessing) return;
    const targets = rowsNeedingRegen(s.rows);
    if (!targets.length) {
      toast.info('No edited bullets to regenerate.');
      return;
    }
    const voice = getPromptText('regenerateVoiceDefault');
    setParallelPhase('regenerating');
    setIsProcessing(true);
    try {
      await runPooled(targets, REGEN_CONCURRENCY, async (row) => {
        const live = useStore.getState().rows;
        const idx = live.findIndex((r) => r.id === row.id);
        setRegenerating(row.id, true);
        try {
          const rewrite = await aiProvider.regenerateParagraph({
            originalParagraph: row.draftA,
            faithfulBullet: row.outlineA,
            editedBullet: row.outlineB,
            precedingContext: live[idx - 1]?.draftA,
            followingContext: live[idx + 1]?.draftA,
            voiceInstruction: voice,
            sectionTitle: scope.title,
            config: s.promptsConfig,
          });
          if (rewrite) setRowDraftB(row.id, rewrite.proposed_text, 'regenerated');
          else {
            setRowDraftB(row.id, row.draftB ?? '', 'error');
            toast.error('A paragraph could not be regenerated — left unchanged.');
          }
        } catch (e) {
          setRowDraftB(row.id, row.draftB ?? '', 'error');
          notifyAiError(e, `Regenerate failed: ${errMessage(e)}`);
        } finally {
          setRegenerating(row.id, false);
        }
      });
      setParallelPhase('review');
    } finally {
      setIsProcessing(false);
    }
  }, [setParallelPhase, setIsProcessing, setRegenerating, setRowDraftB]);

  /** Accept one row's proposal into the document (snapshot-per-accept, like Glass Box). */
  const acceptRow = useCallback(
    async (row: ParallelRow) => {
      const s = useStore.getState();
      const scope = scopeFromState(s);
      if (!scope || row.draftB == null) return;
      try {
        await createSnapshot('pre-ai-write', { sectionIds: [scope.scopeKey] });
      } catch {
        /* non-fatal — the change is still autosaved + recoverable */
      }
      setLocalContent((doc) => applyRowToDoc(doc, row, useStore.getState().rows));
      markRowAccepted(row.id);
      try {
        await saveCurrentState();
      } catch (e) {
        toast.error(`Applied, but writing to disk failed: ${errMessage(e)}`);
      }
    },
    [createSnapshot, setLocalContent, markRowAccepted, saveCurrentState],
  );

  /** Accept every changed row behind ONE snapshot (one undo reverts the batch). */
  const acceptAll = useCallback(async () => {
    const s = useStore.getState();
    const scope = scopeFromState(s);
    if (!scope) return;
    const targets = changedRows(s.rows);
    if (!targets.length) return;
    try {
      await createSnapshot('pre-ai-write', { sectionIds: [scope.scopeKey] });
    } catch {
      /* non-fatal */
    }
    setLocalContent((doc) => targets.reduce((acc, r) => applyRowToDoc(acc, r, s.rows), doc));
    targets.forEach((r) => markRowAccepted(r.id));
    try {
      await saveCurrentState();
    } catch (e) {
      toast.error(`Applied, but writing to disk failed: ${errMessage(e)}`);
    }
  }, [createSnapshot, setLocalContent, markRowAccepted, saveCurrentState]);

  /** Reset every row to its original (pre-edit) state. */
  const resetAll = useCallback(() => {
    useStore.getState().rows.map((r) => r.id).forEach((id) => resetRow(id));
  }, [resetRow]);

  return {
    hydrate,
    persistOutline,
    generateOutline,
    regenerateChanged,
    acceptRow,
    acceptAll,
    resetAll,
  };
};
