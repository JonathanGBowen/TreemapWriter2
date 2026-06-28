import { describe, it, expect, afterEach } from 'vitest';
import { runAgentLoop } from '../agent-loop';
import type { AgentTool } from '../agent-types';
import type { LLMClient, LLMRequest } from '../../clients';
import { setAgentTraceSink, type AgentTraceSinkEvent } from '../../clients';
import type { DialogueMessage } from '../../../../types';

/** A scripted LLMClient: each call to streamText yields the next scripted turn whole. */
function fakeClient(turns: string[]): { client: LLMClient; calls: () => number } {
  let i = 0;
  const client: LLMClient = {
    generateText: async () => '',
    async *streamText(_req: LLMRequest) {
      const turn = turns[Math.min(i, turns.length - 1)];
      i += 1;
      yield turn;
    },
  };
  return { client, calls: () => i };
}

const toolCall = (tool: string, args: Record<string, unknown>) =>
  ['```json', JSON.stringify({ action: 'tool', calls: [{ tool, args }] }), '```'].join('\n');

const baseMessages: DialogueMessage[] = [{ role: 'user', text: 'do the thing' }];

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const c of it) out += c;
  return out;
}

afterEach(() => setAgentTraceSink(null));

describe('runAgentLoop', () => {
  it('runs a tool, feeds the result back, and returns the final answer', async () => {
    const ran: Record<string, unknown>[] = [];
    const tools: AgentTool[] = [
      {
        name: 'echo',
        description: 'echo',
        run: async (args) => {
          ran.push(args);
          return `echoed ${String(args.x)}`;
        },
      },
    ];
    const { client } = fakeClient([toolCall('echo', { x: 'hi' }), 'All done.']);

    const out = await collect(
      runAgentLoop({ client, model: 'm', messages: baseMessages, context: 'CTX', tools }),
    );

    expect(out).toBe('All done.');
    expect(ran).toEqual([{ x: 'hi' }]);
  });

  it('emits start, activity, text, and end trace events', async () => {
    const events: AgentTraceSinkEvent[] = [];
    setAgentTraceSink((e) => events.push(e));
    const tools: AgentTool[] = [{ name: 'echo', description: 'echo', run: async () => 'r' }];
    const { client } = fakeClient([toolCall('echo', {}), 'final']);

    await collect(runAgentLoop({ client, model: 'm', messages: baseMessages, context: 'C', tools }));

    const types = events.map((e) => e.type);
    expect(types[0]).toBe('start');
    expect(types).toContain('activity');
    expect(types).toContain('text');
    expect(types[types.length - 1]).toBe('end');
    const end = events[events.length - 1];
    expect(end.type === 'end' && end.status).toBe('success');
  });

  it('respects maxSteps by forcing a final answer (no infinite loop)', async () => {
    const tools: AgentTool[] = [{ name: 'echo', description: 'echo', run: async () => 'r' }];
    // A model that ALWAYS asks for a tool — only the step cap can stop it.
    const { client, calls } = fakeClient([toolCall('echo', {})]);

    const out = await collect(
      runAgentLoop({ client, model: 'm', messages: baseMessages, context: 'C', tools, maxSteps: 2 }),
    );

    // maxSteps tool rounds + 1 forced-final turn = 3 model calls.
    expect(calls()).toBe(3);
    expect(typeof out).toBe('string');
  });

  it('reports a tool error to the model and still completes', async () => {
    const tools: AgentTool[] = [
      {
        name: 'boom',
        description: 'throws',
        run: async () => {
          throw new Error('kaboom');
        },
      },
    ];
    const { client } = fakeClient([toolCall('boom', {}), 'recovered']);

    const out = await collect(
      runAgentLoop({ client, model: 'm', messages: baseMessages, context: 'C', tools }),
    );
    expect(out).toBe('recovered');
  });

  it('propagates a transport error as an error-end trace and throws', async () => {
    const events: AgentTraceSinkEvent[] = [];
    setAgentTraceSink((e) => events.push(e));
    const client: LLMClient = {
      generateText: async () => '',
      // eslint-disable-next-line require-yield
      async *streamText() {
        throw new Error('network down');
      },
    };
    await expect(
      collect(runAgentLoop({ client, model: 'm', messages: baseMessages, context: 'C', tools: [] })),
    ).rejects.toThrow('network down');
    const end = events[events.length - 1];
    expect(end.type === 'end' && end.status).toBe('error');
  });
});
