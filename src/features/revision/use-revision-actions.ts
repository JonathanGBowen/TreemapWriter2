import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { applyProposal } from '../../lib/revision-helpers';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { useCurrentSection } from '../tests-panel/use-current-section';
import type { SessionProposal } from '../../state/revision-state';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/**
 * Orchestration for the Revision Workspace: generate proposals, accept (write
 * through to the draft + snapshot for undo), reject. Components -> this hook ->
 * slice actions + aiProvider; the SDK never crosses into feature code.
 *
 * Mirrors use-analysis-actions: live config/section read via getState() at call
 * time (stable callbacks), the global `isProcessing` lock for the heavyweight
 * generate call, toast on failure, persistence failure as its own error.
 */
export const useRevisionActions = () => {
  const currentSection = useCurrentSection();
  const setRevisionPhase = useStore((s) => s.setRevisionPhase);
  const setProposals = useStore((s) => s.setProposals);
  const resolveProposal = useStore((s) => s.resolveProposal);
  const setIsProcessing = useStore((s) => s.setIsProcessing);
  const setLocalContent = useStore((s) => s.setLocalContent);
  const createSnapshot = useStore((s) => s.createSnapshot);
  const saveCurrentState = useStore((s) => s.saveCurrentState);

  const generate = useCallback(async () => {
    if (!currentSection) return;
    const { title: sectionTitle, fullContent: sectionText } = currentSection;
    const {
      revisionSources,
      selectedSourceIds,
      directive,
      revisionMode,
      revisionSubMode,
      promptsConfig,
      isProcessing,
      modelConfig,
      globalModelDefault,
      modelCatalog,
    } = useStore.getState();
    if (isProcessing) return;

    const sources = revisionSources.filter((s) => selectedSourceIds.includes(s.id));
    if (sources.length === 0) {
      toast.error('Select at least one source to cite from.');
      return;
    }
    if (revisionMode === 'revision' && !directive.trim()) {
      toast.error('Add a directive — what should this revision accomplish?');
      return;
    }

    // Pre-flight the full section + all selected sources against the model window —
    // the prompt sends them whole, so abort and ask for a larger model on overflow.
    const choice = resolveModelChoice('generateRevisions', modelConfig, globalModelDefault);
    const budgetText = [sectionText, ...sources.map((s) => s.content)].join('\n\n');
    if (!guardContextFit({ catalog: modelCatalog, choice, text: budgetText, what: 'This section and its sources', setting: 'Generate revisions' })) {
      return;
    }

    setRevisionPhase('generating');
    setIsProcessing(true);
    try {
      const proposals = await aiProvider.generateRevisions({
        sectionTitle,
        sectionText,
        directive,
        mode: revisionMode,
        subMode: revisionSubMode,
        sources,
        config: promptsConfig,
      });
      setProposals(proposals.map((p) => ({ ...p, _status: 'pending' as const })));
      setRevisionPhase('review');
      if (proposals.length === 0) toast.info('No well-grounded edits found for this directive.');
    } catch (e) {
      notifyAiError(e, `Revision failed: ${errMessage(e)}`);
      setRevisionPhase('config');
    } finally {
      setIsProcessing(false);
    }
  }, [currentSection, setRevisionPhase, setProposals, setIsProcessing]);

  const accept = useCallback(
    async (proposal: SessionProposal) => {
      if (!currentSection) return;
      const sectionId = currentSection.id;
      // Snapshot BEFORE the write so the change is one undo away. A snapshot
      // failure must not block the edit (it's still autosaved + recoverable).
      try {
        await createSnapshot('pre-ai-write', { sectionIds: [sectionId] });
      } catch {
        /* non-fatal */
      }
      // Literal first-occurrence replace — the engine's "never assume" contract.
      setLocalContent((prev) => applyProposal(prev, proposal));
      resolveProposal(proposal.id, 'accepted');
      try {
        await saveCurrentState();
      } catch (e) {
        toast.error(`Applied, but writing to disk failed: ${errMessage(e)}`);
      }
    },
    [currentSection, createSnapshot, setLocalContent, resolveProposal, saveCurrentState],
  );

  const reject = useCallback((id: string) => resolveProposal(id, 'rejected'), [resolveProposal]);

  return { generate, accept, reject };
};
