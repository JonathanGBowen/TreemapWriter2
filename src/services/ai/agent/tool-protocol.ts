// Provider-agnostic, prompted JSON tool protocol.
//
// The LLMClient seam is deliberately text-only (one client per provider, no
// per-provider native function-calling), and local models vary in tool support.
// So tool use rides a prompted convention parsed by the app's tolerant JSON
// extractors — the SAME mechanism `developSpecLevel` already ships: the model
// emits one fenced ```json block per turn, and `extractFencedJson` +
// `safeJsonParse` recover it even from surrounding prose. Anything unparseable
// degrades to "treat the turn as the final answer" — never an error.

import { extractFencedJson } from '../../../lib/fenced-json';
import { safeJsonParse } from '../../../lib/utils';
import type { AgentAction, AgentTool, ToolCall, ToolResult } from './agent-types';

/** The contract prepended to every agent turn's system instruction. */
export const AGENT_CONTRACT = [
  'You are operating as a tool-using assistant for an academic writing app.',
  'Each turn, respond in ONE of two ways:',
  '',
  '1. To use tools, output ONLY a single fenced ```json block:',
  '   { "action": "tool", "calls": [ { "tool": "<name>", "args": { ... } } ] }',
  '   You may request several calls; they run in order and their results return to you before your next turn.',
  '',
  '2. To answer (no more tools needed), either output a fenced ```json block:',
  '   { "action": "final", "text": "<your answer in markdown>" }',
  '   — or simply write your answer as plain prose with no JSON block.',
  '',
  'Rules:',
  '- Use EXACT tool names from the catalog; unknown tools are ignored.',
  '- The WORKING TEXT below is already provided IN FULL. Do not use read/search tools to',
  '  reassemble it — read it as a whole and judge parts in their context. The read/search',
  '  tools are for reaching BEYOND the working text: other project files, AI-generated',
  '  artifacts (.twriter/agent-output, specs), and version history.',
  '- Prefer the fewest tool calls that answer the question. Do not invent file contents.',
].join('\n');

/** Render the tool catalog block for the system instruction. */
export function formatToolCatalog(tools: AgentTool[]): string {
  if (tools.length === 0) return 'AVAILABLE TOOLS: (none)';
  const lines = tools.map((t) => {
    const hint = t.argsHint ? `  args: ${t.argsHint}` : '';
    return `- ${t.name} — ${t.description}${hint ? `\n  ${hint.trim()}` : ''}`;
  });
  return ['AVAILABLE TOOLS:', ...lines].join('\n');
}

/** Assemble the full per-turn system instruction. */
export function buildAgentSystemInstruction(
  tools: AgentTool[],
  context: string,
  preamble?: string,
): string {
  return [
    AGENT_CONTRACT,
    '',
    formatToolCatalog(tools),
    preamble ? `\n${preamble}` : '',
    '',
    '--- WORKING TEXT & CONTEXT ---',
    context,
  ]
    .filter((s) => s !== '')
    .join('\n');
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Coerce the model's `calls` array into validated ToolCalls against known tools. */
function parseToolCalls(raw: unknown, knownTools: Set<string>): ToolCall[] {
  if (!Array.isArray(raw)) return [];
  const calls: ToolCall[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const tool = typeof item.tool === 'string' ? item.tool : undefined;
    if (!tool || !knownTools.has(tool)) continue;
    calls.push({ tool, args: isRecord(item.args) ? item.args : {} });
  }
  return calls;
}

/**
 * Parse one assistant turn into an action. A fenced ```json block with
 * `action: "tool"` and ≥1 known call becomes a tool action; anything else
 * (`action: "final"`, an unknown/empty action, or no JSON at all) becomes the
 * final answer — so a model that just answers in prose Just Works.
 */
export function parseAgentAction(text: string, knownTools: Set<string>): AgentAction {
  const fenced = extractFencedJson(text);
  const parsed = fenced ? safeJsonParse(fenced, null) : null;

  if (isRecord(parsed) && parsed.action === 'tool') {
    const calls = parseToolCalls(parsed.calls, knownTools);
    if (calls.length > 0) return { kind: 'tool', calls };
  }
  return { kind: 'final', text: finalTextOf(text, parsed) };
}

/**
 * Extract the final answer text from a turn. Prefers an explicit
 * `{ "action": "final", "text": ... }`; otherwise returns the prose as-is (the
 * model answered directly). `parsed` may be passed when already extracted.
 */
export function finalTextOf(text: string, parsed?: unknown): string {
  const obj = parsed !== undefined ? parsed : (() => {
    const fenced = extractFencedJson(text);
    return fenced ? safeJsonParse(fenced, null) : null;
  })();
  if (isRecord(obj) && obj.action === 'final' && typeof obj.text === 'string') {
    return obj.text.trim();
  }
  return text.trim();
}

/** Serialize tool results into the synthesized user turn the model reads next. */
export function serializeToolResults(results: ToolResult[]): string {
  const payload = JSON.stringify({ tool_results: results }, null, 2);
  return [
    'TOOL RESULTS:',
    '```json',
    payload,
    '```',
    'Use these to continue. Either request more tools or give your final answer.',
  ].join('\n');
}

/** A short, glanceable activity label for the live trace (e.g. `read_section: intro-0`). */
export function toolActivityLabel(call: ToolCall): string {
  const a = call.args ?? {};
  const key =
    (typeof a.path === 'string' && a.path) ||
    (typeof a.name === 'string' && a.name) ||
    (typeof a.sectionId === 'string' && a.sectionId) ||
    (typeof a.id === 'string' && a.id) ||
    (typeof a.query === 'string' && a.query) ||
    '';
  return key ? `${call.tool}: ${key}` : call.tool;
}
