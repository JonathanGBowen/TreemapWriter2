import { describe, it, expect } from 'vitest';
import { cleanPastedText } from '../paste';

describe('cleanPastedText', () => {
  it('strips zero-width characters and BOMs', () => {
    expect(cleanPastedText('a​b‌c‍d﻿e')).toBe('abcde');
  });

  it('converts non-breaking spaces to plain spaces', () => {
    expect(cleanPastedText('word word')).toBe('word word');
  });

  it('leaves visible typography (curly quotes, dashes) untouched', () => {
    const text = '“quoted” — em-dash ‘single’';
    expect(cleanPastedText(text)).toBe(text);
  });

  it('is the identity on clean text', () => {
    expect(cleanPastedText('plain prose, nothing to fix.')).toBe('plain prose, nothing to fix.');
  });
});
