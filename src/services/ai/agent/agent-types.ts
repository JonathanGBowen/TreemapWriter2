// Local agent — shared types.
//
// The provider-agnostic, multi-turn, tool-using loop (`agent-loop.ts`) drives any
// LLMClient through a prompted JSON tool protocol (`tool-protocol.ts`). Tools are
// built by `buildToolRegistry` (`tool-registry.ts`), already bound to their
// dependencies (the Repository, the AIProvider, and a snapshot of the live
// document), so the loop only ever calls `tool.run(args)`.

/** One tool the agent may call. Bound to its deps at construction; the loop just runs it. */
export interface AgentTool {
  /** Stable identifier the model uses in a tool call. */
  name: string;
  /** One-line capability description, shown to the model in the tool catalog. */
  description: string;
  /** Optional argument hint shown in the catalog, e.g. `{ "path": "<relative path>" }`. */
  argsHint?: string;
  /**
   * Execute the tool. `args` come from the model and are UNTRUSTED — validate
   * inside. Resolve to a string result the model reads back; throwing is fine
   * (the loop converts it to a tool error the model can recover from).
   */
  run: (args: Record<string, unknown>) => Promise<string>;
}

/** A tool invocation requested by the model in one turn. */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

/** The outcome of running one tool call, fed back to the model. */
export interface ToolResult {
  tool: string;
  ok: boolean;
  result?: string;
  error?: string;
}

/** A parsed assistant turn: either a request to run tools, or the final answer. */
export type AgentAction =
  | { kind: 'tool'; calls: ToolCall[] }
  | { kind: 'final'; text: string };
