// Low-level transport boundary. An LLMClient knows how to turn a provider-
// agnostic request into one provider's API call and back into text — and
// nothing else. All prompt-building and response parsing lives one layer up in
// the AIProvider implementation, so adding a provider means writing one client,
// not re-implementing ten AI flows.

/** A chat turn. Domain roles are user | model; clients translate at the edge. */
export interface LLMMessage {
  role: 'user' | 'model' | 'assistant';
  text: string;
}

export interface LLMRequest {
  model: string;
  /** Single-shot prompt (most calls). Mutually exclusive with `messages`. */
  prompt?: string;
  /** Multi-turn history (dialogue). Mutually exclusive with `prompt`. */
  messages?: LLMMessage[];
  /** System / developer instruction, applied out-of-band where supported. */
  systemInstruction?: string;
  /** Force JSON output where the provider can; tolerant parsing covers the rest. */
  json?: boolean;
  /**
   * A JSON Schema constraining the response shape. Gemini enforces it as
   * structured output (the reliable way to pin field names + array shape);
   * Anthropic/Ollama ignore it and lean on the prompt. Requires `json`.
   */
  responseJsonSchema?: unknown;
  /**
   * Gemini numeric thinking budget (the Gemini 2.5 convention). `-1` means
   * dynamic/maximum. Anthropic maps coarsely; Ollama ignores. Mutually exclusive
   * with `thinkingLevel`.
   */
  thinkingBudget?: number;
  /**
   * Gemini 3 thinking convention: a coarse level instead of a numeric budget. The
   * dispatch layer sets exactly one of `thinkingLevel` / `thinkingBudget` based on
   * the chosen model's catalog `thinking` style. Honored by Gemini; ignored elsewhere.
   */
  thinkingLevel?: 'low' | 'high';
  /**
   * Sampling temperature (0–1). Set per-call where fidelity matters most (e.g. the
   * Gist flows pin 0.25). Omitted ⇒ the provider's own default. Honored by
   * Gemini/Anthropic/Ollama; the Agent SDK ignores it.
   */
  temperature?: number;
  /** Required by Anthropic; ignored by Gemini/Ollama. Per-call default applies. */
  maxTokens?: number;
  /**
   * Client-side-only trace metadata (never sent to a provider). The Agent SDK
   * client uses these to label/scope the live thinking/activity trace it emits;
   * other clients ignore them. Injected by the AIProvider per call kind.
   */
  traceLabel?: string;
  traceKind?: string;
}

export interface LLMClient {
  /** One request, full text back. */
  generateText(req: LLMRequest): Promise<string>;
  /** One request, streamed as text chunks. */
  streamText(req: LLMRequest): AsyncIterable<string>;
}

/** Normalize a history so the first turn is `user` (every provider requires it). */
export function trimToFirstUser(messages: LLMMessage[]): LLMMessage[] {
  const firstUser = messages.findIndex((m) => m.role === 'user');
  return firstUser > 0 ? messages.slice(firstUser) : messages;
}
