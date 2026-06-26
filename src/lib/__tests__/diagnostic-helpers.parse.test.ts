import { describe, it, expect } from 'vitest';
import { parseCommitmentFindings, parseNextAction } from '../diagnostic-helpers';

describe('parseCommitmentFindings', () => {
  it('keeps well-formed findings and trims fields', () => {
    const out = parseCommitmentFindings([
      { kind: 'unmet-incoming', detail: '  needs the Köhler result  ', relatedSectionTitle: '  Chapter 1  ' },
      { kind: 'center-of-gravity', detail: 'concedes the thesis while defending it' },
    ]);
    expect(out).toEqual([
      { kind: 'unmet-incoming', detail: 'needs the Köhler result', relatedSectionTitle: 'Chapter 1' },
      { kind: 'center-of-gravity', detail: 'concedes the thesis while defending it', relatedSectionTitle: undefined },
    ]);
  });

  it('drops entries with an unknown kind or empty detail', () => {
    const out = parseCommitmentFindings([
      { kind: 'bogus', detail: 'x' },
      { kind: 'dangling-outgoing', detail: '   ' },
      { kind: 'dangling-outgoing', detail: 'real one' },
    ]);
    expect(out).toEqual([{ kind: 'dangling-outgoing', detail: 'real one', relatedSectionTitle: undefined }]);
  });

  it('returns undefined for non-arrays and for an all-malformed array', () => {
    expect(parseCommitmentFindings(undefined)).toBeUndefined();
    expect(parseCommitmentFindings('nope')).toBeUndefined();
    expect(parseCommitmentFindings([{ kind: 'bogus', detail: 'x' }])).toBeUndefined();
    expect(parseCommitmentFindings([])).toBeUndefined();
  });
});

describe('parseNextAction', () => {
  it('parses a complete gap → vector and trims', () => {
    expect(
      parseNextAction({ gap: '  the bridge to S2 is missing ', vector: ' state the distinction ', location: ' after Köhler ' }),
    ).toEqual({ gap: 'the bridge to S2 is missing', vector: 'state the distinction', location: 'after Köhler' });
  });

  it('omits location when blank but keeps gap+vector', () => {
    expect(parseNextAction({ gap: 'a', vector: 'b' })).toEqual({ gap: 'a', vector: 'b', location: undefined });
  });

  it('returns undefined unless BOTH gap and vector are present', () => {
    expect(parseNextAction({ gap: 'only gap' })).toBeUndefined();
    expect(parseNextAction({ vector: 'only vector' })).toBeUndefined();
    expect(parseNextAction({})).toBeUndefined();
    expect(parseNextAction(null)).toBeUndefined();
    expect(parseNextAction('nope')).toBeUndefined();
  });
});
