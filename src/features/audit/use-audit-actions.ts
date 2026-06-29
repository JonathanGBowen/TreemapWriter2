// Orchestration for the whole-document argument audit (WS4b). Mirrors the WS4a deep
// pass (`use-revision-actions.ts:generateDeep`): build whole-document context + the
// bounded tool set, seed the user turn with the deterministic structural map, run the
// local agent under a locked preamble, then parse + anchor its findings. Read-only —
// the agent reports; the writer fixes through Glass-Box.

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useStore } from '../../state';
import { aiProvider } from '../../services/ai-provider-registry';
import { repository } from '../../services/repository-registry';
import { isTauri } from '../../services/tauri-environment';
import { selectSpecMap } from '../../lib/spec-map';
import { buildAgentContext, buildToolRegistry } from '../../services/ai/agent';
import { getPromptText } from '../../services/prompts';
import { parseAgentProposals } from '../../lib/revision-helpers';
import { buildAuditSeed, normalizeAuditFindings } from '../../lib/audit-helpers';
import { findSectionById } from '../../lib/utils';
import { deriveTopo } from '../modals/topo/topo-derive';
import { computeCentering } from '../modals/topo/topo-centering';
import { notifyAiError } from '../shared/ai-error';
import type { Section, TestSuite } from '../../types';

const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Check API key or try again');

/** A compact note on topology pathologies (cycles, backward arcs) for the seed —
 *  computed in the feature layer so `buildAuditSeed` stays pure/lib-only. */
function topologyNote(sections: Section[], testSuite: TestSuite): string | undefined {
  try {
    const centering = computeCentering(deriveTopo(sections, testSuite));
    const parts: string[] = [];
    if (centering.cycles.length) {
      const cyc = centering.cycles
        .map((ids) => ids.map((id) => findSectionById(sections, id)?.title ?? id).join(' ⇄ '))
        .join('; ');
      parts.push(`dependency cycle(s) — sections that mutually depend (a pathology): ${cyc}.`);
    }
    if (centering.backwardCount > 0) {
      parts.push(
        `${centering.backwardCount} backward dependency arc(s): a prerequisite placed AFTER the section that needs it.`,
      );
    }
    return parts.length ? `Topology: ${parts.join(' ')}` : undefined;
  } catch {
    return undefined; // topology is enrichment; never block the audit on it
  }
}

export const useAuditActions = () => {
  const runAudit = useCallback(async () => {
    const st = useStore.getState();
    if (st.auditStatus === 'running' || st.isProcessing) return;
    if (!st.localAgentEnabled) {
      toast.error('Enable the Local agent in AI settings to run the argument audit.');
      return;
    }
    const { sections, testSuite, markdown } = st;
    if (!sections.length) {
      toast.info('Open a document with sections to audit.');
      return;
    }

    const specs = selectSpecMap(testSuite);
    const context = buildAgentContext({
      scope: 'document',
      selectedSectionId: st.selectedId,
      sections,
      markdown,
      specs,
    });
    const tools = buildToolRegistry({
      repository,
      aiProvider,
      sections,
      markdown,
      specs,
      config: st.promptsConfig,
      enableFsTools: isTauri(),
    });
    // The user turn carries only DATA (the deterministic map); the standing how-to
    // contract is the locked `auditAgentPreamble`.
    const seed = buildAuditSeed(sections, specs, { topologyNote: topologyNote(sections, testSuite) });

    useStore.getState().setAuditStatus('running');
    const opId = useStore.getState().beginOp({ label: 'Argument audit (agent)…' });
    let answer = '';
    try {
      for await (const chunk of aiProvider.runAgent({
        messages: [{ role: 'user', text: seed }],
        context,
        tools,
        config: st.promptsConfig,
        modelChoice: st.localAgentModel,
        preamble: getPromptText('auditAgentPreamble'),
      })) {
        answer += chunk;
      }
      const findings = normalizeAuditFindings(parseAgentProposals(answer), { sections });
      useStore.getState().setAuditFindings(findings, Date.now());
      if (findings.length === 0) toast.info('The audit found no unresolved structural gaps.');
    } catch (e) {
      useStore.getState().setAuditStatus('error');
      notifyAiError(e, `Argument audit failed: ${errMessage(e)}`);
    } finally {
      useStore.getState().endOp(opId);
    }
  }, []);

  return { runAudit };
};
