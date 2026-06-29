import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createSegmentSlice, type SegmentSlice, type SegmentLevel } from '../segment-state';

const sliceCreator = createSegmentSlice as unknown as StateCreator<SegmentSlice>;
const makeStore = () => create<SegmentSlice>()(sliceCreator);

const seedDoc = (store: ReturnType<typeof makeStore>, markdown: string) =>
  store.setState({ markdown, sections: [], modelConfig: {}, globalModelDefault: {} } as unknown as Partial<SegmentSlice>);

const level = (over: Partial<SegmentLevel> = {}): SegmentLevel => ({
  depth: 0,
  targetLevel: 2,
  status: 'proposed',
  edits: [],
  spanCount: 1,
  ...over,
});

describe('segment-state slice', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('openSegment infers genre + baseLevel and seeds the working copy', () => {
    seedDoc(store, 'A short article body with only a few words.');
    store.getState().openSegment();
    const s = store.getState();
    expect(s.segmentOpen).toBe(true);
    expect(s.segmentGenre).toBe('article');
    expect(s.baseLevel).toBe(2); // no existing headings → article idiom
    expect(s.segmentWorking).toContain('A short article body');
    expect(s.segmentLevels).toEqual([]);
    expect(s.segmentCursor).toBe(0);
  });

  it('changing the genre re-anchors the base level', () => {
    seedDoc(store, 'body');
    store.getState().openSegment();
    store.getState().setSegmentGenre('monograph');
    expect(store.getState().baseLevel).toBe(1);
  });

  it('setSegmentLevel inserts by depth; patch updates in place', () => {
    store.getState().setSegmentLevel(level({ depth: 0 }));
    store.getState().setSegmentLevel(level({ depth: 1, targetLevel: 3 }));
    expect(store.getState().segmentLevels).toHaveLength(2);
    store.getState().patchSegmentLevel(1, { status: 'accepted' });
    expect(store.getState().segmentLevels[1].status).toBe('accepted');
  });

  it('toggleSegmentEdit flips accepted ↔ rejected; set-all bulk updates', () => {
    store.getState().setSegmentLevel(
      level({
        depth: 0,
        edits: [
          { id: '0-0', status: 'accepted', edit: { kind: 'merge', anchor: '## A', confidence: 1, rationale: '' } },
          { id: '0-1', status: 'accepted', edit: { kind: 'merge', anchor: '## B', confidence: 1, rationale: '' } },
        ],
      }),
    );
    store.getState().toggleSegmentEdit(0, '0-0');
    expect(store.getState().segmentLevels[0].edits[0].status).toBe('rejected');
    store.getState().setSegmentLevelEditStatus(0, 'rejected');
    expect(store.getState().segmentLevels[0].edits.every((e) => e.status === 'rejected')).toBe(true);
  });

  it('advanceSegmentCursor and closeSegment reset the walk', () => {
    seedDoc(store, 'body');
    store.getState().openSegment();
    store.getState().setSegmentLevel(level());
    store.getState().advanceSegmentCursor();
    expect(store.getState().segmentCursor).toBe(1);
    store.getState().closeSegment();
    const s = store.getState();
    expect(s.segmentOpen).toBe(false);
    expect(s.segmentLevels).toEqual([]);
    expect(s.segmentCursor).toBe(0);
  });
});
