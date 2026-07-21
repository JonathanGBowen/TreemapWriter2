import { describe, expect, it } from 'vitest';
import { consumeDialogueStream } from '../stream';

async function* chunks(...parts: string[]): AsyncIterable<string> {
  for (const p of parts) yield p;
}

async function* failsAfter(...parts: string[]): AsyncIterable<string> {
  for (const p of parts) yield p;
  throw new Error('boom');
}

type Log = { progress: string[]; committed: string[]; empty: number; errors: string[] };

const record = (over: { commitPartial?: boolean } = {}) => {
  const log: Log = { progress: [], committed: [], empty: 0, errors: [] };
  const cb = {
    onProgress: (t: string) => log.progress.push(t),
    onCommit: (t: string) => log.committed.push(t),
    onEmpty: () => log.empty++,
    onError: (e: unknown, partial: string) =>
      log.errors.push(`${e instanceof Error ? e.message : String(e)}|${partial}`),
    ...over,
  };
  return { log, cb };
};

describe('consumeDialogueStream', () => {
  it('accumulates progress and commits the full text once on success', async () => {
    const { log, cb } = record();
    await consumeDialogueStream(chunks('a', 'b', 'c'), cb);
    expect(log.progress).toEqual(['a', 'ab', 'abc']);
    expect(log.committed).toEqual(['abc']);
    expect(log.empty).toBe(0);
    expect(log.errors).toEqual([]);
  });

  it('reports empty (no commit) when the stream yields nothing', async () => {
    const { log, cb } = record();
    await consumeDialogueStream(chunks(), cb);
    expect(log.committed).toEqual([]);
    expect(log.empty).toBe(1);
    expect(log.errors).toEqual([]);
  });

  it('commits the partial and reports the error on mid-stream failure', async () => {
    const { log, cb } = record();
    await consumeDialogueStream(failsAfter('a', 'b'), cb);
    expect(log.committed).toEqual(['ab']);
    expect(log.errors).toEqual(['boom|ab']);
  });

  it('discards the partial when commitPartial is false', async () => {
    const { log, cb } = record({ commitPartial: false });
    await consumeDialogueStream(failsAfter('a'), cb);
    expect(log.committed).toEqual([]);
    expect(log.errors).toEqual(['boom|a']);
  });

  it('does not double-report: an immediate failure commits nothing and errors once', async () => {
    const { log, cb } = record();
    await consumeDialogueStream(failsAfter(), cb);
    expect(log.committed).toEqual([]);
    expect(log.empty).toBe(0);
    expect(log.errors).toEqual(['boom|']);
  });
});
