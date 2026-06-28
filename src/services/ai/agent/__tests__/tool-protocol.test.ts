import { describe, it, expect } from 'vitest';
import {
  parseAgentAction,
  finalTextOf,
  serializeToolResults,
  buildAgentSystemInstruction,
} from '../tool-protocol';
import type { AgentTool } from '../agent-types';

const known = new Set(['read_section', 'write_output']);

describe('parseAgentAction', () => {
  it('parses a fenced tool action with known calls', () => {
    const text = [
      'Sure, let me look.',
      '```json',
      '{ "action": "tool", "calls": [ { "tool": "read_section", "args": { "sectionId": "intro-0" } } ] }',
      '```',
    ].join('\n');
    const action = parseAgentAction(text, known);
    expect(action.kind).toBe('tool');
    if (action.kind === 'tool') {
      expect(action.calls).toHaveLength(1);
      expect(action.calls[0]).toEqual({ tool: 'read_section', args: { sectionId: 'intro-0' } });
    }
  });

  it('drops unknown tools and falls back to a final answer when none remain', () => {
    const text = '```json\n{ "action": "tool", "calls": [ { "tool": "rm_rf", "args": {} } ] }\n```';
    const action = parseAgentAction(text, known);
    expect(action.kind).toBe('final');
  });

  it('treats an explicit final action as the final answer', () => {
    const text = '```json\n{ "action": "final", "text": "The argument holds." }\n```';
    const action = parseAgentAction(text, known);
    expect(action).toEqual({ kind: 'final', text: 'The argument holds.' });
  });

  it('treats plain prose (no fence) as the final answer', () => {
    const action = parseAgentAction('Just a normal answer.', known);
    expect(action).toEqual({ kind: 'final', text: 'Just a normal answer.' });
  });

  it('recovers from a malformed JSON block by treating the turn as final', () => {
    const text = '```json\n{ "action": "tool", "calls": [ {bad json } ] }\n```';
    const action = parseAgentAction(text, known);
    expect(action.kind).toBe('final');
  });

  it('uses the LAST fenced block (iterative drafting)', () => {
    const text = [
      '```json',
      '{ "action": "final", "text": "draft" }',
      '```',
      'on reflection:',
      '```json',
      '{ "action": "tool", "calls": [ { "tool": "write_output", "args": { "name": "n.md", "contents": "x" } } ] }',
      '```',
    ].join('\n');
    const action = parseAgentAction(text, known);
    expect(action.kind).toBe('tool');
  });
});

describe('finalTextOf', () => {
  it('prefers an explicit final.text', () => {
    expect(finalTextOf('```json\n{ "action": "final", "text": "hi" }\n```')).toBe('hi');
  });
  it('returns raw prose when there is no final action', () => {
    expect(finalTextOf('plain answer')).toBe('plain answer');
  });
});

describe('serializeToolResults', () => {
  it('embeds a tool_results JSON block', () => {
    const out = serializeToolResults([{ tool: 'read_section', ok: true, result: 'body' }]);
    expect(out).toContain('tool_results');
    expect(out).toContain('read_section');
    expect(out).toContain('"ok": true');
  });
});

describe('buildAgentSystemInstruction', () => {
  it('lists tools and includes the working context, with the whole-text rule', () => {
    const tools: AgentTool[] = [
      { name: 'read_section', description: 'read a section', run: async () => '' },
    ];
    const sys = buildAgentSystemInstruction(tools, 'WORKING TEXT — the whole document:\nbody');
    expect(sys).toContain('read_section — read a section');
    expect(sys).toContain('WORKING TEXT');
    expect(sys).toContain('already provided IN FULL');
  });
});
