import { describe, expect, it } from 'vitest';
import { selectSpecMap } from '../spec-map';
import type { SectionSpec, TestSuite } from '../../types';

const spec = (mainClaim: string): SectionSpec => ({
  function: 'argue',
  mainClaim,
  requiredMoves: [],
  incomingContext: [],
  outgoingCommitments: [],
});

describe('selectSpecMap', () => {
  it('projects each testSuite entry to its spec, carrying root through', () => {
    const suite = {
      root: { goals: '', spec: spec('whole') },
      'sec-1': { goals: '', spec: spec('part one') },
    } as unknown as TestSuite;

    const map = selectSpecMap(suite);
    expect(map['root']?.mainClaim).toBe('whole');
    expect(map['sec-1']?.mainClaim).toBe('part one');
  });

  it('keeps the id key even when an entry has no spec', () => {
    const suite = { 'sec-2': { goals: '' } } as unknown as TestSuite;
    const map = selectSpecMap(suite);
    expect('sec-2' in map).toBe(true);
    expect(map['sec-2']).toBeUndefined();
  });

  it('returns an empty map for an empty suite', () => {
    expect(selectSpecMap({} as TestSuite)).toEqual({});
  });
});
