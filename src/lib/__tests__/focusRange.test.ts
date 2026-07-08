import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { focusModeExtension, focusRangeField, setFocusRange } from '../focusRange';

// "# A\naaa\n# B\nbbb\n# C\nccc" — section B spans offsets 8..15 ("# B\nbbb").
const DOC = '# A\naaa\n# B\nbbb\n# C\nccc';
const B_RANGE = { from: 8, to: 15 };

const stateWithFocus = (range: { from: number; to: number } | null = B_RANGE) => {
  const state = EditorState.create({ doc: DOC, extensions: [focusModeExtension] });
  return state.update({ effects: setFocusRange.of(range) }).state;
};

describe('focusRangeField', () => {
  it('stores a dispatched range and clears on null', () => {
    const focused = stateWithFocus();
    expect(focused.field(focusRangeField)).toEqual(B_RANGE);
    const cleared = focused.update({ effects: setFocusRange.of(null) }).state;
    expect(cleared.field(focusRangeField)).toBeNull();
  });

  it('maps the range through edits before it', () => {
    const focused = stateWithFocus();
    // Programmatic insert (no userEvent) before the range — passes the filter.
    const next = focused.update({ changes: { from: 0, insert: 'XX' } }).state;
    expect(next.field(focusRangeField)).toEqual({ from: 10, to: 17 });
  });

  it('extends the range when text is inserted at its end', () => {
    const focused = stateWithFocus();
    const next = focused.update({
      changes: { from: B_RANGE.to, insert: ' more' },
      annotations: [],
    }).state;
    expect(next.field(focusRangeField)!.to).toBe(B_RANGE.to + ' more'.length);
  });
});

describe('confinement (changeFilter)', () => {
  it('drops a user edit outside the focused range', () => {
    const focused = stateWithFocus();
    const tr = focused.update({
      changes: { from: 0, insert: 'Z' },
      userEvent: 'input.type',
    });
    // The out-of-range change is filtered out: doc unchanged.
    expect(tr.state.doc.toString()).toBe(DOC);
  });

  it('keeps a user edit inside the focused range', () => {
    const focused = stateWithFocus();
    const tr = focused.update({
      changes: { from: B_RANGE.to, insert: '!' },
      userEvent: 'input.type',
    });
    expect(tr.state.doc.toString()).toContain('bbb!');
  });

  it('lets programmatic replaces through untouched (controlled-value reconcile)', () => {
    const focused = stateWithFocus();
    const tr = focused.update({
      changes: { from: 0, to: DOC.length, insert: 'entirely new document' },
    });
    expect(tr.state.doc.toString()).toBe('entirely new document');
  });

  it('is dormant with no range set', () => {
    const state = EditorState.create({ doc: DOC, extensions: [focusModeExtension] });
    const tr = state.update({ changes: { from: 0, insert: 'Z' }, userEvent: 'input.type' });
    expect(tr.state.doc.toString()).toBe('Z' + DOC);
  });
});
