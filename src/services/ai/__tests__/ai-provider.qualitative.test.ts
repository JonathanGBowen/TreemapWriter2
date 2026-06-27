import { describe, it, expect } from 'vitest';
import { __test } from '../ai-provider.qualitative';

const { normalizeQualitativeSignature, normalizePartQuality, normalizeArticulatedTrouble } = __test;

describe('normalizeQualitativeSignature', () => {
  it('keeps a well-formed reading, trims, and filters empty registers', () => {
    const out = normalizeQualitativeSignature({
      quality: '  patient, accreting, faintly wry  ',
      registers: ['  slow accretion  ', '', '   ', 'wry under-statement'],
      note: '  strongest in the middle  ',
    });
    expect(out).toEqual({
      quality: 'patient, accreting, faintly wry',
      registers: ['slow accretion', 'wry under-statement'],
      note: 'strongest in the middle',
    });
  });

  it('drops registers/note when absent or empty', () => {
    expect(normalizeQualitativeSignature({ quality: 'X', registers: [] })).toEqual({
      quality: 'X',
      registers: undefined,
      note: undefined,
    });
  });

  it('returns null without a quality or for junk', () => {
    expect(normalizeQualitativeSignature({ registers: ['a'] })).toBeNull();
    expect(normalizeQualitativeSignature({ quality: '  ' })).toBeNull();
    expect(normalizeQualitativeSignature(null)).toBeNull();
    expect(normalizeQualitativeSignature('nope')).toBeNull();
  });
});

describe('normalizePartQuality (the Goya test)', () => {
  it('keeps a well-formed result and trims', () => {
    const out = normalizePartQuality(
      { partQuality: '  brisk and clinical  ', belonging: 'shifted', divergence: '  colder than the whole  ', note: ' n ' },
      true,
    );
    expect(out).toEqual({
      partQuality: 'brisk and clinical',
      belonging: 'shifted',
      divergence: 'colder than the whole',
      note: 'n',
    });
  });

  it('drops divergence when it belongs', () => {
    const out = normalizePartQuality({ partQuality: 'X', belonging: 'belongs', divergence: 'drop me' }, true);
    expect(out).toEqual({ partQuality: 'X', belonging: 'belongs', divergence: undefined, note: undefined });
  });

  it('forces no-baseline (and drops divergence) when no signature was provided', () => {
    const out = normalizePartQuality({ partQuality: 'X', belonging: 'alien', divergence: 'x' }, false);
    expect(out).toEqual({ partQuality: 'X', belonging: 'no-baseline', divergence: undefined, note: undefined });
  });

  it('falls back to shifted for an unknown belonging when a signature exists', () => {
    const out = normalizePartQuality({ partQuality: 'X', belonging: 'bogus' }, true);
    expect(out?.belonging).toBe('shifted');
  });

  it('returns null without a part quality or for junk', () => {
    expect(normalizePartQuality({ belonging: 'belongs' }, true)).toBeNull();
    expect(normalizePartQuality({ partQuality: '   ' }, true)).toBeNull();
    expect(normalizePartQuality(null, true)).toBeNull();
  });
});

describe('normalizeArticulatedTrouble', () => {
  it('keeps a well-formed gap → vector and trims', () => {
    const out = normalizeArticulatedTrouble({ gap: '  the claim is asserted, not earned  ', vector: '  add the bridging step  ', location: '  para 2  ' });
    expect(out).toEqual({ gap: 'the claim is asserted, not earned', vector: 'add the bridging step', location: 'para 2' });
  });

  it('drops an empty location', () => {
    expect(normalizeArticulatedTrouble({ gap: 'g', vector: 'v', location: '   ' })).toEqual({ gap: 'g', vector: 'v', location: undefined });
  });

  it('returns null when gap or vector is missing, or for junk', () => {
    expect(normalizeArticulatedTrouble({ gap: 'g' })).toBeNull();
    expect(normalizeArticulatedTrouble({ vector: 'v' })).toBeNull();
    expect(normalizeArticulatedTrouble(null)).toBeNull();
  });
});
