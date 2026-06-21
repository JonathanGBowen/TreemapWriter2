export type { LLMClient, LLMRequest, LLMMessage } from './llm-client';
export { trimToFirstUser } from './llm-client';
export { GeminiClient } from './gemini-client';
export { AnthropicClient, supportsAdaptiveThinking } from './anthropic-client';
export { OllamaClient, DEFAULT_OLLAMA_BASE_URL } from './ollama-client';
export { AgentSdkClient, DEFAULT_AGENT_SIDECAR_URL, setAgentTraceSink } from './agent-sdk-client';
export type { AgentSidecarHealth, AgentTraceSinkEvent, AgentTraceSink } from './agent-sdk-client';
