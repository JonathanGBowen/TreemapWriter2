import { describe, expect, it } from 'vitest';
import { reachAll, reachFrom, sccGroups } from '../graph-scc';

const adj = (pairs: [string, string[]][]): Map<string, string[]> => new Map(pairs);

describe('graph-scc', () => {
  it('reachFrom walks forward and excludes the start unless on a cycle', () => {
    const a = adj([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);
    expect([...reachFrom('a', a)].sort()).toEqual(['b', 'c']);
    expect(reachFrom('a', a).has('a')).toBe(false);
  });

  it('reachFrom includes the start when it lies on a cycle', () => {
    const a = adj([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    expect(reachFrom('a', a).has('a')).toBe(true);
  });

  it('reachAll covers every id', () => {
    const a = adj([
      ['a', ['b']],
      ['b', []],
    ]);
    const r = reachAll(['a', 'b'], a);
    expect(r.get('a')).toEqual(new Set(['b']));
    expect(r.get('b')).toEqual(new Set());
  });

  it('sccGroups collapses a mutual-reachability cycle into one component', () => {
    const ids = ['a', 'b', 'c'];
    const a = adj([
      ['a', ['b']],
      ['b', ['a']],
      ['c', []],
    ]);
    const { compMembers, compId } = sccGroups(ids, reachAll(ids, a));
    const cycles = [...compMembers.values()].filter((m) => m.length > 1);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].sort()).toEqual(['a', 'b']);
    expect(compId.get('a')).toBe(compId.get('b'));
    expect(compId.get('c')).not.toBe(compId.get('a'));
  });

  it('sccGroups gives singletons for a DAG', () => {
    const ids = ['a', 'b', 'c'];
    const a = adj([
      ['a', ['b', 'c']],
      ['b', ['c']],
      ['c', []],
    ]);
    const { compMembers } = sccGroups(ids, reachAll(ids, a));
    expect([...compMembers.values()].every((m) => m.length === 1)).toBe(true);
  });
});
