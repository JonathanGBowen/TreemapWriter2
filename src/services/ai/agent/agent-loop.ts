// The multi-turn, tool-using agent loop.
//
// Provider-agnostic: it drives whatever LLMClient the AIProvider hands it (the
// dispatched one — fallback/throttle/context-budget already wrapped). Each turn it
// streams a model response, emitting deltas to the live trace; once the turn
// completes it parses an action (tool calls vs final answer). Tool turns run the
// tools and feed results back as a synthesized user turn; a final answer is
// emitted to the trace AND yielded to the caller. Bounded by `maxSteps` tool
// rounds, after which it forces a final answer.
//
// Trace events go through the SAME sink the Claude Agent SDK client uses
// (`emitAgentTrace`), so the existing live ticker / modal light up unchanged for
// any provider — including local Ollama, which emits no trace of its own.

import { emitAgentTrace, newRunId, trimToFirstUser } from '../clients';
import type { LLMClient, LLMMessage } from '../clients';
import { AI_CALL_KIND_LABELS } from '../model-types';
import type { DialogueMessage } from '../../../types';
import type { AgentTool, ToolResult } from './agent-types';
import {
  buildAgentSystemInstruction,
  finalTextOf,
  parseAgentAction,
  serializeToolResults,
  toolActivityLabel,
} from './tool-protocol';

const MAX_STEPS_DEFAULT = 8;

export interface RunAgentLoopOptions {
  /** The dispatched transport (already wrapped with fallback/throttle by the provider). */
  client: LLMClient;
  model: string;
  thinkingBudget?: number;
  /** The conversation so far; the last message is the new user turn. */
  messages: DialogueMessage[];
  /** Whole-text working context + structural surround (from buildAgentContext). */
  context: string;
  /** The bounded tools the agent may call (from buildToolRegistry). */
  tools: AgentTool[];
  /** Optional extra preamble folded into the system instruction. */
  preamble?: string;
  /** Max tool-use rounds before a final answer is forced. Default 8. */
  maxSteps?: number;
}

/**
 * Run the agent to a final answer, yielding the final text (once, when ready).
 * Intermediate reasoning, tool activity, and progress flow to the trace sink, so
 * the live UI shows work-in-progress while the loop runs.
 */
export async function* runAgentLoop(opts: RunAgentLoopOptions): AsyncIterable<string> {
  const { client, model, thinkingBudget, tools, context } = opts;
  const maxSteps = opts.maxSteps ?? MAX_STEPS_DEFAULT;
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const knownTools = new Set(toolByName.keys());

  const runId = newRunId();
  emitAgentTrace({
    type: 'start',
    runId,
    label: AI_CALL_KIND_LABELS.runAgent,
    callKind: 'runAgent',
    model,
    at: Date.now(),
  });

  const systemInstruction = buildAgentSystemInstruction(tools, context, opts.preamble);
  // The working transcript: the caller's conversation, grown with assistant turns
  // and synthesized tool-result user turns. The provider is stateless — the whole
  // transcript travels every turn.
  const transcript: LLMMessage[] = trimToFirstUser(
    opts.messages.map((m) => ({ role: m.role, text: m.text })),
  );

  try {
    for (let step = 0; step <= maxSteps; step++) {
      const lastTurn = step === maxSteps;
      const sys = lastTurn
        ? `${systemInstruction}\n\n(You have reached the tool-use limit. Give your FINAL answer now, with no further tool calls.)`
        : systemInstruction;

      // Stream the model turn; accumulate the full text while showing live
      // progress as 'think' on the trace.
      let full = '';
      for await (const delta of client.streamText({
        model,
        messages: transcript,
        systemInstruction: sys,
        thinkingBudget,
      })) {
        full += delta;
        emitAgentTrace({ type: 'think', runId, delta, at: Date.now() });
      }

      const action = lastTurn
        ? ({ kind: 'final', text: finalTextOf(full) } as const)
        : parseAgentAction(full, knownTools);

      if (action.kind === 'final') {
        emitAgentTrace({ type: 'text', runId, delta: action.text, at: Date.now() });
        emitAgentTrace({ type: 'end', runId, status: 'success', at: Date.now() });
        yield action.text;
        return;
      }

      // Tool turn: record the assistant's request, run the calls, feed results back.
      transcript.push({ role: 'model', text: full });
      const results: ToolResult[] = [];
      for (const call of action.calls) {
        emitAgentTrace({ type: 'activity', runId, label: toolActivityLabel(call), at: Date.now() });
        const tool = toolByName.get(call.tool);
        if (!tool) {
          results.push({ tool: call.tool, ok: false, error: `Unknown tool: ${call.tool}` });
          continue;
        }
        try {
          const result = await tool.run(call.args ?? {});
          results.push({ tool: call.tool, ok: true, result });
        } catch (e) {
          results.push({ tool: call.tool, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      transcript.push({ role: 'user', text: serializeToolResults(results) });
    }
  } catch (e) {
    emitAgentTrace({
      type: 'end',
      runId,
      status: 'error',
      errorMessage: e instanceof Error ? e.message : String(e),
      at: Date.now(),
    });
    throw e;
  }
}
