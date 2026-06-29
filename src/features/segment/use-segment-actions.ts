import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Section, SegmentEdit } from '../../types';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { parseMarkdown } from '../../lib/utils';
import { segmentParagraphs } from '../../lib/paragraph-helpers';
import { applySegmentEdits, stripHeadings } from '../../lib/segment-helpers';
import {
  spansForDepth,
  spanBlocks,
  SEGMENT_CONSERVATIVE_THRESHOLD,
  MAX_SEGMENT_DEPTH,
} from '../../services/ai/ai-provider.segment';
import type { ProposedEdit } from '../../state/segment-state';
import { notifyAiError } from '../shared/ai-error';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/** Module-level guard: a level generation in flight survives a remount. */
const generating = new Set<number>();

/** Depth-first lookup of a section by exact title (for resolving a summary to a part). */
function findByTitle(nodes: Section[], title: string): Section | null {
  for (const n of nodes) {
    if (n.title === title) return n;
    const found = findByTitle(n.children, title);
    if (found) return found;
  }
  return null;
}

/**
 * Orchestration for the Articulation workspace. Components → this hook → slice
 * actions + `aiProvider`; the SDK never crosses into feature code. Mirrors
 * use-interpolate-actions: `startWalk` takes the one `pre-ai-write` snapshot,
 * `generateLevel` runs one depth's spans, `acceptLevel` applies the accepted edits
 * to the working copy AND commits them to the document (reparse), `runAllRemaining`
 * finishes the descent non-interactively. The walk reads live state via getState()
 * so the callbacks keep a stable identity.
 */
export const useSegmentActions = () => {
  const createSnapshot = useStore((s) => s.createSnapshot);
  const saveCurrentState = useStore((s) => s.saveCurrentState);
  const markSegmentWalkStarted = useStore((s) => s.markSegmentWalkStarted);
  const setSegmentWorking = useStore((s) => s.setSegmentWorking);
  const setSegmentLevel = useStore((s) => s.setSegmentLevel);
  const patchSegmentLevel = useStore((s) => s.patchSegmentLevel);
  const advanceSegmentCursor = useStore((s) => s.advanceSegmentCursor);
  const setSegmentDone = useStore((s) => s.setSegmentDone);
  const pushSegmentSummaries = useStore((s) => s.pushSegmentSummaries);
  const closeSegment = useStore((s) => s.closeSegment);
  const openInterpolate = useStore((s) => s.openInterpolate);

  /** Take the one pre-ai-write snapshot for the whole walk (idempotent, non-fatal),
   *  and for exploratory mode strip the working copy down to heading-free prose. */
  const startWalk = useCallback(async () => {
    if (useStore.getState().walkStarted) return;
    markSegmentWalkStarted();
    if (useStore.getState().segmentMode === 'exploratory') {
      setSegmentWorking(stripHeadings(useStore.getState().segmentWorking));
    }
    try {
      await createSnapshot('pre-ai-write', 'all', useStore.getState().promptsConfig);
    } catch {
      toast.warning('Could not save an undo snapshot before articulating — proceeding.');
    }
  }, [createSnapshot, markSegmentWalkStarted, setSegmentWorking]);

  /** Generate one depth's proposed edits from the current working copy. Returns the
   *  span count (0 ⇒ the descent has bottomed out at this depth). */
  const generateLevel = useCallback(
    async (depth: number): Promise<number> => {
      if (generating.has(depth)) return 0;
      const s = useStore.getState();
      const { segmentWorking, segmentMode, segmentGranularity, segmentGenre, baseLevel, segmentDepthChoice, promptsConfig } = s;
      const targetLevel = baseLevel + depth;
      const sections = parseMarkdown(segmentWorking);
      const blocks = segmentParagraphs(segmentWorking);
      const spans = spansForDepth(sections, blocks, depth, baseLevel, segmentGenre);

      if (spans.length === 0) {
        setSegmentLevel({ depth, targetLevel, status: 'empty', edits: [], spanCount: 0 });
        setSegmentDone(true);
        return 0;
      }

      generating.add(depth);
      setSegmentLevel({ depth, targetLevel, status: 'generating', edits: [], spanCount: spans.length });
      const opId = useStore.getState().beginOp({ label: 'Articulating…', workspace: 'segment' });
      const threshold = segmentMode === 'exploratory' ? 0.5 : SEGMENT_CONSERVATIVE_THRESHOLD;
      const collected: SegmentEdit[] = [];
      try {
        for (const span of spans) {
          try {
            const result = await aiProvider.segmentSpan({
              blocks: spanBlocks(blocks, span),
              headingPath: span.headingPath,
              targetLevel: span.targetLevel,
              mode: segmentMode,
              granularity: segmentGranularity,
              genre: segmentGenre,
              config: promptsConfig,
              modelChoice: segmentDepthChoice,
            });
            for (const edit of result.edits) {
              if ((edit.confidence ?? 0) >= threshold) collected.push(edit);
            }
          } catch (e) {
            // One span failing shouldn't abort the level — surface and continue.
            notifyAiError(e, `A span failed to articulate: ${errMessage(e)}`);
          }
        }
        const edits: ProposedEdit[] = collected.map((edit, i) => ({
          id: `${depth}-${i}`,
          edit,
          status: 'accepted',
        }));
        setSegmentLevel({
          depth,
          targetLevel,
          status: edits.length > 0 ? 'proposed' : 'empty',
          edits,
          spanCount: spans.length,
        });
        return spans.length;
      } catch (e) {
        patchSegmentLevel(depth, { status: 'error' });
        notifyAiError(e, `Articulation failed: ${errMessage(e)}`);
        return spans.length;
      } finally {
        generating.delete(depth);
        useStore.getState().endOp(opId);
      }
    },
    [setSegmentLevel, patchSegmentLevel, setSegmentDone],
  );

  /** Apply a level's ACCEPTED edits to the working copy, commit to the document
   *  (reparse), write any summaries, and advance to the next depth. */
  const acceptLevel = useCallback(
    async (depth: number) => {
      const s = useStore.getState();
      const level = s.segmentLevels[depth];
      if (!level) return;
      const accepted = level.edits.filter((e) => e.status === 'accepted').map((e) => e.edit);
      const next = applySegmentEdits(s.segmentWorking, accepted);
      setSegmentWorking(next);

      // Commit to the live document (both, per the importer's contract) + reparse so
      // the next level's spans see the new structure and ids exist for summaries.
      s.setMarkdown(next);
      s.setLocalContent(next);
      const newSections = parseMarkdown(next, s.sections);
      s.setSections(newSections);

      // Summaries (summaries mode): tie each accepted new part's gloss to its section.
      const summaries: { title: string; sentence: string }[] = [];
      for (const e of accepted) {
        if ((e.kind === 'insert' || e.kind === 'split') && e.summary) {
          summaries.push({ title: e.title, sentence: e.summary });
          const sec = findByTitle(newSections, e.title);
          if (sec) s.setReverseSummary(sec.id, e.summary);
        }
      }
      if (summaries.length) pushSegmentSummaries(summaries);

      patchSegmentLevel(depth, { status: 'accepted' });
      advanceSegmentCursor();
      try {
        await saveCurrentState();
      } catch (e) {
        toast.error(`Applied in memory, but writing to disk failed: ${errMessage(e)}`);
      }
    },
    [setSegmentWorking, patchSegmentLevel, advanceSegmentCursor, pushSegmentSummaries, saveCurrentState],
  );

  /** Finish the descent non-interactively: generate + auto-accept each remaining
   *  level until a level is empty or the depth fuse trips. */
  const runAllRemaining = useCallback(async () => {
    await startWalk();
    const opId = useStore.getState().beginOp({ label: 'Articulating all levels…', workspace: 'segment' });
    try {
      for (let depth = useStore.getState().segmentCursor; depth <= MAX_SEGMENT_DEPTH; depth++) {
        const spanCount = await generateLevel(depth);
        if (spanCount === 0) break;
        const level = useStore.getState().segmentLevels[depth];
        if (!level || level.status === 'error') break;
        await acceptLevel(depth);
      }
      toast.success('Articulation complete.');
    } catch (e) {
      notifyAiError(e, `Run-all stopped: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, [startWalk, generateLevel, acceptLevel]);

  /** Hand off to the spec sweep: the document now carries headings. */
  const continueToSpecs = useCallback(() => {
    closeSegment();
    openInterpolate();
  }, [closeSegment, openInterpolate]);

  return { startWalk, generateLevel, acceptLevel, runAllRemaining, continueToSpecs };
};
