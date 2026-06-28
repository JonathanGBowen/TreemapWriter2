// Shared live-trace sink for agentic AI runs.
//
// Two emitters use it: the Claude Agent SDK client (`agent-sdk-client.ts`) and
// the provider-agnostic local agent loop (`../agent/agent-loop.ts`). Keeping the
// sink in its own leaf means neither emitter imports the store — boot injects the
// real sink via `setAgentTraceSink` (mirrors `setModelConfigSource`), and the
// trace store folds the events into the live ticker / modal. The event shape is
// the contract `state/trace-state.ts::applyTraceEvent` consumes; do not change it
// without updating that reducer.

/** A trace event emitted as an agentic run progresses. Consumed by the trace store. */
export type AgentTraceSinkEvent =
  | { type: 'start'; runId: string; label?: string; callKind?: string; model: string; at: number }
  | { type: 'think'; runId: string; delta: string; at: number }
  | { type: 'text'; runId: string; delta: string; at: number }
  | { type: 'activity'; runId: string; label: string; at: number }
  | { type: 'end'; runId: string; status: 'success' | 'error'; errorMessage?: string; at: number };

export type AgentTraceSink = (event: AgentTraceSinkEvent) => void;

// Injected at boot (mirrors setModelConfigSource) so emitters never import the
// store — avoids a cycle. Null in tests / before boot, which is harmless.
let traceSink: AgentTraceSink | null = null;

export function setAgentTraceSink(sink: AgentTraceSink | null): void {
  traceSink = sink;
}

export function emitAgentTrace(event: AgentTraceSinkEvent): void {
  try {
    traceSink?.(event);
  } catch {
    // A misbehaving sink must never break an AI call.
  }
}

/** Best-effort unique id for one run (crypto.randomUUID when available). */
export function newRunId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
