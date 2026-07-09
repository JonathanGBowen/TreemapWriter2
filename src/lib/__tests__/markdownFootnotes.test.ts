import { describe, it, expect } from 'vitest';
import { footnoteAt, footnoteJumpTarget } from '../markdownFootnotes';

const DOC = [
  'The claim stands.[^kant] More prose follows.',
  '',
  'A second reference.[^kant] And a distinct one.[^hume]',
  '',
  '[^kant]: Critique of Pure Reason, B132.',
  '[^hume]: Treatise, 1.4.6.',
].join('\n');

describe('footnoteAt', () => {
  it('finds the token containing the position', () => {
    const at = DOC.indexOf('[^kant]') + 3;
    expect(footnoteAt(DOC, at)).toEqual({
      id: 'kant',
      from: DOC.indexOf('[^kant]'),
      to: DOC.indexOf('[^kant]') + '[^kant]'.length,
    });
  });

  it('returns null in plain prose', () => {
    expect(footnoteAt(DOC, DOC.indexOf('More prose'))).toBeNull();
  });
});

describe('footnoteJumpTarget', () => {
  it('jumps from a reference to its definition', () => {
    const refPos = DOC.indexOf('[^hume]') + 2;
    expect(footnoteJumpTarget(DOC, refPos)).toBe(DOC.indexOf('[^hume]:'));
  });

  it('jumps from the definition back to the first reference', () => {
    const defPos = DOC.indexOf('[^kant]:') + 2;
    expect(footnoteJumpTarget(DOC, defPos)).toBe(DOC.indexOf('[^kant]'));
  });

  it('returns null when there is no counterpart', () => {
    const doc = 'Orphan.[^lost] No definition anywhere.';
    expect(footnoteJumpTarget(doc, doc.indexOf('[^lost]') + 2)).toBeNull();
  });
});
