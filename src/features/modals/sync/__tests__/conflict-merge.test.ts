import { describe, expect, it } from 'vitest';
import {
  conflictCount,
  hasUnresolvedMarkers,
  parseMergedText,
  reassemble,
  type MergeSegment,
} from '../conflict-merge';

const conflict = (merged: string) => parseMergedText(merged);

describe('parseMergedText', () => {
  it('splits a single conflict into stable / conflict / stable', () => {
    const segs = conflict(
      'line A\n<<<<<<< LOCAL\nours 1\nours 2\n=======\ntheirs 1\n>>>>>>> REMOTE\nline B',
    );
    expect(segs).toEqual<MergeSegment[]>([
      { kind: 'stable', lines: ['line A'] },
      { kind: 'conflict', ours: ['ours 1', 'ours 2'], theirs: ['theirs 1'] },
      { kind: 'stable', lines: ['line B'] },
    ]);
  });

  it('does NOT misparse a Setext h1 underline as a separator', () => {
    // `=======` outside a <<<<<<< envelope is just prose (an h1 underline).
    const segs = conflict('My Heading\n=======\nSome prose.');
    expect(conflictCount(segs)).toBe(0);
    expect(segs).toEqual<MergeSegment[]>([
      { kind: 'stable', lines: ['My Heading', '=======', 'Some prose.'] },
    ]);
  });

  it('strips CR so CRLF inputs do not smuggle markers', () => {
    const segs = conflict('a\r\n<<<<<<< LOCAL\r\no\r\n=======\r\nt\r\n>>>>>>> REMOTE\r\nb');
    expect(segs).toEqual<MergeSegment[]>([
      { kind: 'stable', lines: ['a'] },
      { kind: 'conflict', ours: ['o'], theirs: ['t'] },
      { kind: 'stable', lines: ['b'] },
    ]);
  });

  it('handles multiple hunks', () => {
    const segs = conflict(
      '<<<<<<< LOCAL\no1\n=======\nt1\n>>>>>>> REMOTE\nmid\n<<<<<<< LOCAL\no2\n=======\nt2\n>>>>>>> REMOTE',
    );
    expect(conflictCount(segs)).toBe(2);
  });

  it('handles an empty side', () => {
    const segs = conflict('<<<<<<< LOCAL\n=======\ntheirs\n>>>>>>> REMOTE');
    expect(segs).toEqual<MergeSegment[]>([{ kind: 'conflict', ours: [], theirs: ['theirs'] }]);
  });
});

describe('reassemble', () => {
  const segs = conflict('line A\n<<<<<<< LOCAL\nours\n=======\ntheirs\n>>>>>>> REMOTE\nline B');

  it('reproduces the LOCAL side when all hunks choose ours', () => {
    expect(reassemble(segs, ['ours'])).toBe('line A\nours\nline B');
  });

  it('reproduces the REMOTE side when all hunks choose theirs', () => {
    expect(reassemble(segs, ['theirs'])).toBe('line A\ntheirs\nline B');
  });

  it('mixes choices across multiple hunks', () => {
    const two = conflict(
      '<<<<<<< LOCAL\no1\n=======\nt1\n>>>>>>> REMOTE\nmid\n<<<<<<< LOCAL\no2\n=======\nt2\n>>>>>>> REMOTE',
    );
    expect(reassemble(two, ['ours', 'theirs'])).toBe('o1\nmid\nt2');
  });
});

describe('hasUnresolvedMarkers', () => {
  it('flags <<<<<<< and >>>>>>> but not a lone =======', () => {
    expect(hasUnresolvedMarkers('a\n<<<<<<< LOCAL\nb')).toBe(true);
    expect(hasUnresolvedMarkers('a\n>>>>>>> REMOTE\nb')).toBe(true);
    expect(hasUnresolvedMarkers('Heading\n=======\nbody')).toBe(false);
    expect(hasUnresolvedMarkers('clean prose\nwith no markers')).toBe(false);
  });
});
