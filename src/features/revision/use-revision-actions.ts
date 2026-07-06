import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { applyProposal, normalizeRevisions, parseAgentProposals } from '../../lib/revision-helpers';
import { makeProvenanceMark } from '../../lib/provenance';
import { resolveActiveInstruction } from '../../lib/defaultInstructions';
import { revisionBudgetText } from './revision-budget';
import { resolveModelChoice } from '../../services/ai/resolve-model-choice';
import { guardContextFit } from '../shared/context-guard';
import { notifyAiError } from '../shared/ai-error';
import { useCurrentSection } from '../tests-panel/use-current-section';
import { repository } from '../../services/repository-registry';
import { isTauri } from '../../services/tauri-environment';
import { selectSpecMap } from '../../lib/spec-map';
import { buildAgentContext, buildToolRegistry } from '../../services/ai/agent';
import { getPromptText } from '../../services/prompts';
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
      sources: allSources,
      selectedSourceIds,
      directive,
      revisionMode,
      revisionSubMode,
      promptsConfig,
      isProcessing,
      modelConfig,
      globalModelDefault,
      modelCatalog,
      revisionInstructions,
      activeRevisionInstructionId,
    } = useStore.getState();
    if (isProcessing) return;

    const sources = allSources.filter((s) => selectedSourceIds.includes(s.id));
    // Sourceless revision is now the default when no sources exist: the engine
    // grounds proposals in the document itself via the active Instruction. Assembly
    // (assembles FROM sources) and Citations (checks the draft AGAINST sources) are
    // the exceptions — both require at least one source.
    if (revisionMode === 'assembly' && sources.length === 0) {
      toast.error('Assembly mode needs at least one source to assemble from.');
      return;
    }
    if (revisionMode === 'citations' && sources.length === 0) {
      toast.error('Citations mode needs the cited source(s) to check against.');
      return;
    }
    if (revisionMode === 'revision' && !directive.trim()) {
      toast.error('Add a directive — what should this revision accomplish?');
      return;
    }

    const instruction = resolveActiveInstruction(revisionInstructions, activeRevisionInstructionId).body;

    // Pre-flight the full section + sources (+ the grounding instruction) against the
    // model window — the prompt sends them whole, so abort and ask for a larger
    // model on overflow.
    const choice = resolveModelChoice('generateRevisions', modelConfig, globalModelDefault);
    const budgetText = revisionBudgetText(sectionText, instruction, sources);
    // Citations runs whole-document (sectionText is the full draft when 'root' is
    // selected), so name that in the overflow message.
    const budgetWhat =
      revisionMode === 'citations' ? 'The whole document and its sources' : 'This section and its sources';
    if (!guardContextFit({ catalog: modelCatalog, choice, text: budgetText, what: budgetWhat, setting: 'Generate revisions' })) {
      return;
    }

    setRevisionPhase('generating');
    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Generating revisions…', workspace: 'revision' });
    try {
      const proposals = await aiProvider.generateRevisions({
        sectionTitle,
        sectionText,
        directive,
        mode: revisionMode,
        subMode: revisionSubMode,
        sources,
        instruction,
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
      useStore.getState().endOp(opId);
    }
  }, [currentSection, setRevisionPhase, setProposals, setIsProcessing]);

  /**
   * The bounded + gated "deep pass": run the local agent so it can gather
   * cross-section / manuscript-search / history context BEFORE proposing, then route
   * its proposals through the SAME Glass-Box review + accept gate as the single-pass
   * engine. The agent only proposes; the human accepts. Off unless the Local agent is
   * enabled (AI settings). Reuses the agent context/tool builders + the tolerant
   * revision normalizer — no new call kind, no new gate.
   */
  const generateDeep = useCallback(async () => {
    if (!currentSection) return;
    const st = useStore.getState();
    if (st.isProcessing) return;
    if (!st.localAgentEnabled) {
      toast.error('Enable the Local agent in AI settings to run a deep pass.');
      return;
    }
    if (st.revisionMode === 'revision' && !st.directive.trim()) {
      toast.error('Add a directive — what should this deep revision accomplish?');
      return;
    }

    const specs = selectSpecMap(st.testSuite);
    const context = buildAgentContext({
      scope: 'section',
      selectedSectionId: st.selectedId,
      sections: st.sections,
      markdown: st.markdown,
      specs,
    });
    const tools = buildToolRegistry({
      repository,
      aiProvider,
      sections: st.sections,
      markdown: st.markdown,
      specs,
      config: st.promptsConfig,
      enableFsTools: isTauri(),
    });
    const sources = st.sources.filter((s) => st.selectedSourceIds.includes(s.id));
    const instruction = resolveActiveInstruction(
      st.revisionInstructions,
      st.activeRevisionInstructionId,
    ).body;
    // The user turn carries only the task PARAMETERS; the standing how-to-revise
    // contract lives in the locked `revisionAgentPreamble` (.md), folded into the
    // agent's system instruction.
    const task = [
      `Section: "${currentSection.title}"`,
      st.revisionMode === 'revision' && st.directive.trim()
        ? `Directive — what this revision must accomplish: ${st.directive.trim()}`
        : '',
      instruction.trim() ? `Grounding instruction: ${instruction.trim()}` : '',
      sources.length ? `${sources.length} source document(s) are available to you.` : '',
      'Propose deep, well-grounded revisions to this section per your instructions. The section and its structural surround are already in your context.',
    ]
      .filter(Boolean)
      .join('\n\n');

    setRevisionPhase('generating');
    setIsProcessing(true);
    const opId = useStore.getState().beginOp({ label: 'Deep revision (agent)…', workspace: 'revision' });
    let answer = '';
    try {
      for await (const chunk of aiProvider.runAgent({
        messages: [{ role: 'user', text: task }],
        context,
        tools,
        config: st.promptsConfig,
        modelChoice: st.localAgentModel,
        preamble: getPromptText('revisionAgentPreamble'),
      })) {
        answer += chunk;
      }
      const proposals =
        normalizeRevisions(parseAgentProposals(answer), {
          sectionLabel: currentSection.title,
          // The deep pass is grounded in the document itself (see revision-agent.md),
          // so receipts are optional — only Assembly / Citations are strict.
          receiptRequired: st.revisionMode === 'assembly' || st.revisionMode === 'citations',
        }) ?? [];
      setProposals(proposals.map((p) => ({ ...p, _status: 'pending' as const })));
      setRevisionPhase('review');
      if (proposals.length === 0) toast.info('The deep pass found no well-grounded edits.');
    } catch (e) {
      notifyAiError(e, `Deep revision failed: ${errMessage(e)}`);
      setRevisionPhase('config');
    } finally {
      setIsProcessing(false);
      useStore.getState().endOp(opId);
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
      // Durable provenance (F2): record this span as AI-introduced, anchored to the
      // inserted text. Never touches project.md — only the .twriter sidecar.
      const mark = makeProvenanceMark(proposal.proposed_text, 'revision', Date.now());
      if (mark) useStore.getState().addProvenanceMark(mark);
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

  return { generate, generateDeep, accept, reject };
};
