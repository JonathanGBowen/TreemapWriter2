import { describe, expect, it } from 'vitest';
import { extractFencedJson } from '../fenced-json';

describe('extractFencedJson', () => {
  it('pulls the body of a ```json block', () => {
    const text = 'Here is the spec:\n```json\n{"function":"argue"}\n```\n';
    expect(extractFencedJson(text)).toBe('{"function":"argue"}');
  });

  it('pulls a plain ``` block too', () => {
    expect(extractFencedJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('returns the LAST block when the model showed a draft then a final', () => {
    const text = '```json\n{"v":1}\n```\nrevised:\n```json\n{"v":2}\n```';
    expect(extractFencedJson(text)).toBe('{"v":2}');
  });

  it('returns null when there is no fence', () => {
    expect(extractFencedJson('just prose, no block')).toBeNull();
  });
});
