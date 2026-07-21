// The local agent's invocation surface.
//
// Assembles the whole-text context (the Gestalt default) + the bounded tool set
// from the live store snapshot, then streams `aiProvider.runAgent`. Multi-turn:
// it keeps the conversation and resends the whole transcript each run (the
// provider is stateless). Intermediate reasoning + tool activity show in the live
// trace ticker (mounted globally); this hook surfaces the final answers.

import { useCallback, useRef, useState } from 'react';
import { useStore } from '../../../state';
import { aiProvider } from '../../../services/ai-provider-registry';
import { repository } from '../../../services/repository-registry';
import { isTauri } from '../../../services/tauri-environment';
import { selectSpecMap } from '../../../lib/spec-map';
import { buildAgentContext, buildToolRegistry } from '../../../services/ai/agent';
import type { DialogueMessage } from '../../../types';

export type AgentScope = 'document' | 'section';

export interface UseLocalAgent {
  messages: DialogueMessage[];
  running: boolean;
  error: string | null;
  run: (prompt: string, scope: AgentScope) => Promise<void>;
  reset: () => void;
}

export function useLocalAgent(): UseLocalAgent {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous re-entrancy guard: the `running` state lags a render, so two
  // rapid invocations (e.g. ⌘/Ctrl+Enter twice) could both pass a state-based
  // check and start concurrent runs. The ref flips immediately.
  const runningRef = useRef(false);

  const run = useCallback(
    async (prompt: string, scope: AgentScope) => {
      if (runningRef.current || !prompt.trim()) return;
      const st = useStore.getState();
      const specs = selectSpecMap(st.testSuite);

      const context = buildAgentContext({
        scope,
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

      const nextMessages: DialogueMessage[] = [...messages, { role: 'user', text: prompt }];
      runningRef.current = true;
      setMessages(nextMessages);
      setRunning(true);
      setError(null);
      const opId = useStore.getState().beginOp({ label: 'Local agent…' });
      let answer = '';
      try {
        for await (const chunk of aiProvider.runAgent({
          messages: nextMessages,
          context,
          tools,
          config: st.promptsConfig,
          modelChoice: st.localAgentModel,
        })) {
          answer += chunk;
        }
        setMessages((m) => [...m, { role: 'model', text: answer }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        // Drop the optimistic user turn so the transcript never ends on a
        // dangling user message — resending [user, user] next run is rejected by
        // providers (e.g. Anthropic) that require alternating roles.
        setMessages(messages);
      } finally {
        runningRef.current = false;
        setRunning(false);
        useStore.getState().endOp(opId);
      }
    },
    [messages],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, running, error, run, reset };
}
