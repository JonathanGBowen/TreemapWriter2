// Local agent module — provider-agnostic, multi-turn, tool-using loop + its
// bounded tool set and whole-text context builder. Consumers (the AIProvider
// impl and the UI hook) import from here.

export type { AgentTool, ToolCall, ToolResult, AgentAction } from './agent-types';
export { buildAgentContext } from './agent-context';
export type { AgentContextInput } from './agent-context';
export { buildToolRegistry } from './tool-registry';
export type { ToolRegistryDeps } from './tool-registry';
export { runAgentLoop } from './agent-loop';
export type { RunAgentLoopOptions } from './agent-loop';
export {
  AGENT_CONTRACT,
  buildAgentSystemInstruction,
  parseAgentAction,
  serializeToolResults,
  finalTextOf,
} from './tool-protocol';
