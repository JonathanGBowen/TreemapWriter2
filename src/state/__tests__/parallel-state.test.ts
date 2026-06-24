import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import {
  buildRowsForScope,
  changedRows,
  createParallelSlice,
  outlineDocFromRows,
  rowsFromOutline,
  rowsNeedingRegen,
  type ParallelRow,
  type ParallelSlice,
} from '../parallel-state';
import { segmentParagraphs } from '../../lib/paragraph-helpers';
import type { ReverseOutlineDoc } from '../../types';

// Standalone store: createParallelSlice uses only `set` and pure lib imports, so
// it never loads the full app store graph (which would pull in the AI SDK).
const sliceCreator = createParallelSlice as unknown as StateCreator<ParallelSlice>;
const makeStore = () => create<ParallelSlice>()(sliceCreator);

const SRC = '# Title\n\nPara one makes a claim.\n\nPara two defends it.';

describe('row builders (pure)', () => {
  it('buildRowsForScope with no saved outline blanks prose, echoes non-prose', () => {
    const rows = buildRowsForScope(SRC);
    expect(rows.map((r) => r.kind)).toEqual(['heading', 'prose', 'prose']);
    expect(rows[0].outlineA).toBe('# Title'); // heading echoed
    expect(rows[1].outlineA).toBe(''); // prose blank — needs generation
    expect(rows.every((r) => r.status === 'unchanged' && r.draftB === r.draftA)).toBe(true);
  });

  it('buildRowsForScope fills outlineA from a saved bullet matched by anchor', () => {
    const blocks = segmentParagraphs(SRC);
    const proseBlock = blocks[1];
    const saved: ReverseOutlineDoc = {
      scopeKey: 'root',
      sourceHash: 'h',
      generatedAt: 0,
      bullets: [{ id: 'b1', sentence: 'A claim is made.', kind: 'prose', anchor: proseBlock.text.slice(0, 64) }],
    };
    const rows = buildRowsForScope(SRC, saved);
    expect(rows[1].outlineA).toBe('A claim is made.');
    expect(rows[2].outlineA).toBe(''); // unmatched prose stays blank (never guessed)
  });

  it('rowsFromOutline aligns bullets to blocks 1:1', () => {
    const blocks = segmentParagraphs(SRC);
    const rows = rowsFromOutline(blocks, [
      { index: 0, sentence: 'ignored for heading', kind: 'heading' },
      { index: 1, sentence: 'Claim.', kind: 'prose' },
      { index: 2, sentence: 'Defense.', kind: 'prose' },
    ]);
    expect(rows.map((r) => r.outlineA)).toEqual(['ignored for heading', 'Claim.', 'Defense.']);
  });
});

describe('parallel slice', () => {
  let store: ReturnType<typeof makeStore>;
  const prose = () => store.getState().rows.find((r) => r.kind === 'prose')!;
  beforeEach(() => {
    store = makeStore();
    store.getState().setRows(buildRowsForScope(SRC));
  });

  it('editOutlineB marks edited and invalidates draftB; reverting restores unchanged', () => {
    const id = prose().id;
    store.getState().editOutlineA(id, 'Original distillation.');
    store.getState().editOutlineB(id, 'A different target.');
    let r = store.getState().rows.find((x) => x.id === id)!;
    expect(r.status).toBe('edited');
    expect(r.draftB).toBeNull();

    store.getState().editOutlineB(id, 'Original distillation.'); // back to outlineA
    r = store.getState().rows.find((x) => x.id === id)!;
    expect(r.status).toBe('unchanged');
    expect(r.draftB).toBe(r.draftA);
  });

  it('insertRowAfter adds an inserted row; deleteRow on it removes it', () => {
    const id = prose().id;
    store.getState().insertRowAfter(id);
    const inserted = store.getState().rows.find((r) => r.status === 'inserted')!;
    expect(inserted.draftA).toBe('');
    store.getState().deleteRow(inserted.id);
    expect(store.getState().rows.find((r) => r.id === inserted.id)).toBeUndefined();
  });

  it('deleteRow on a real row marks it deleted with an empty draftB', () => {
    const id = prose().id;
    store.getState().deleteRow(id);
    const r = store.getState().rows.find((x) => x.id === id)!;
    expect(r.status).toBe('deleted');
    expect(r.draftB).toBe('');
  });

  it('resetRow restores an edited row to unchanged', () => {
    const id = prose().id;
    store.getState().editOutlineB(id, 'changed');
    store.getState().resetRow(id);
    const r = store.getState().rows.find((x) => x.id === id)!;
    expect(r.status).toBe('unchanged');
    expect(r.outlineB).toBe(r.outlineA);
    expect(r.draftB).toBe(r.draftA);
  });

  it('setRegenerating toggles the per-row spinner set', () => {
    const id = prose().id;
    store.getState().setRegenerating(id, true);
    expect(store.getState().regeneratingIds).toContain(id);
    store.getState().setRegenerating(id, false);
    expect(store.getState().regeneratingIds).not.toContain(id);
  });

  it('closeParallel drops all rows and the open flag', () => {
    store.getState().openParallel(false);
    store.getState().setRows(buildRowsForScope(SRC));
    store.getState().closeParallel();
    expect(store.getState().parallelOpen).toBe(false);
    expect(store.getState().rows).toEqual([]);
  });
});

describe('derived selectors', () => {
  const rows: ParallelRow[] = [
    { id: '1', kind: 'prose', draftA: 'a', outlineA: 'x', outlineB: 'x', draftB: 'a', status: 'unchanged', anchor: 'a' },
    { id: '2', kind: 'prose', draftA: 'b', outlineA: 'y', outlineB: 'Y!', draftB: null, status: 'edited', anchor: 'b' },
    { id: '3', kind: 'prose', draftA: '', outlineA: '', outlineB: 'new', draftB: null, status: 'inserted', anchor: '' },
    { id: '4', kind: 'prose', draftA: 'd', outlineA: 'w', outlineB: 'w', draftB: '', status: 'deleted', anchor: 'd' },
  ];

  it('rowsNeedingRegen is edited + inserted (not deleted/unchanged)', () => {
    expect(rowsNeedingRegen(rows).map((r) => r.id)).toEqual(['2', '3']);
  });

  it('changedRows is edited + inserted + deleted', () => {
    expect(changedRows(rows).map((r) => r.id)).toEqual(['2', '3', '4']);
  });

  it('outlineDocFromRows persists only real current paragraphs (no inserted/deleted/empty)', () => {
    const doc = outlineDocFromRows('root', rows, 'hash');
    expect(doc.bullets.map((b) => b.id)).toEqual(['1', '2']);
    expect(doc.scopeKey).toBe('root');
    expect(doc.sourceHash).toBe('hash');
  });
});
