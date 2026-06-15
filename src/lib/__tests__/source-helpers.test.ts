import { describe, expect, it } from 'vitest';
import { makeSourceId, normalizeSources } from '../source-helpers';

describe('normalizeSources', () => {
  it('keeps valid entries and fills missing metadata', () => {
    const out = normalizeSources([{ id: 's1', content: 'hello world' }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: 's1',
      content: 'hello world',
      kind: 'Source',
      label: 'Pasted source',
      glyph: '❡',
    });
  });

  it('preserves provided metadata', () => {
    const out = normalizeSources([
      { id: 's2', content: 'x', kind: 'Advisor', label: 'Notes', glyph: '✒' },
    ]);
    expect(out[0]).toEqual({ id: 's2', content: 'x', kind: 'Advisor', label: 'Notes', glyph: '✒' });
  });

  it('drops entries lacking id or content, and non-arrays', () => {
    expect(normalizeSources([{ content: 'no id' }, { id: 'a', content: '  ' }, null, 'x'])).toEqual(
      [],
    );
    expect(normalizeSources(null)).toEqual([]);
    expect(normalizeSources({ nope: 1 })).toEqual([]);
  });

  it('makeSourceId returns unique ids', () => {
    expect(makeSourceId()).not.toBe(makeSourceId());
  });
});
