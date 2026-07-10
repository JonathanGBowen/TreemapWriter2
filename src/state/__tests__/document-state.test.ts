import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createDocumentStateSlice, makeSourceId, type DocumentStateSlice } from '../document-state';
import type { SectionSpec, TestSuiteEntry } from '../../types';

// The slice is typed against the whole AppState (it reads `get().createSnapshot`
// on the AI path); cast it to its own slice so it can be exercised in isolation.
const sliceCreator = createDocumentStateSlice as unknown as StateCreator<DocumentStateSlice>;

// A spy for the one cross-slice call (`createSnapshot`) the AI goals path makes.
const createSnapshot = vi.fn();
const makeStore = () => {
  const store = create<DocumentStateSlice>()(sliceCreator);
  // Inject the cross-slice action the slice reaches for via get().
  store.setState({ createSnapshot } as unknown as Partial<DocumentStateSlice>);
  return store;
};

const spec = (over: Partial<SectionSpec> = {}): SectionSpec => ({
  function: 'argue',
  mainClaim: 'The claim.',
  requiredMoves: [
    { id: 'm1', description: 'Establish the premise.' },
    { id: 'm2', description: 'Draw the inference.' },
  ],
  incomingContext: [],
  outgoingCommitments: [],
  ...over,
});

describe('document-state mutators', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    createSnapshot.mockClear();
    store = makeStore();
  });

  describe('updateSpec', () => {
    it('stores the spec, derives goals/mainClaim, and marks the entry stale', () => {
      store.getState().updateSpec('s1', spec());
      const entry = store.getState().testSuite['s1'];
      expect(entry.spec).toBeDefined();
      expect(entry.mainClaim).toBe('The claim.');
      // goals are the required-move descriptions joined by newlines.
      expect(entry.goals).toBe('Establish the premise.\nDraw the inference.');
      expect(entry.status).toBe('stale');
    });

    it('appends a manual history record capturing the prior goals', () => {
      store.setState({ testSuite: { s1: { goals: 'old goals', status: 'idle', history: [] } } });
      store.getState().updateSpec('s1', spec());
      const history = store.getState().testSuite['s1'].history;
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ goals: 'old goals', type: 'manual' });
    });
  });

  describe('updateSectionGoals', () => {
    it('manual edit records prior goals and does NOT snapshot', () => {
      store.setState({ testSuite: { s1: { goals: 'before', status: 'idle', history: [] } } });
      store.getState().updateSectionGoals('s1', 'after', 'manual');
      const entry = store.getState().testSuite['s1'];
      expect(entry.goals).toBe('after');
      expect(entry.status).toBe('stale');
      expect(entry.history[0]).toMatchObject({ goals: 'before', type: 'manual' });
      expect(createSnapshot).not.toHaveBeenCalled();
    });

    it('AI edit takes a pre-ai-write snapshot of the section', () => {
      store.getState().updateSectionGoals('s1', 'ai goals', 'ai-generate', 'do better');
      expect(createSnapshot).toHaveBeenCalledWith('pre-ai-write', { sectionIds: ['s1'] });
      expect(store.getState().testSuite['s1'].history[0]).toMatchObject({
        type: 'ai-generate',
        instruction: 'do better',
      });
    });
  });

  it('updateDependencies and updateMainClaim mutate the entry in place', () => {
    store.getState().updateDependencies('s1', [{ id: 's0', type: 'prerequisite' }]);
    store.getState().updateMainClaim('s1', 'new claim');
    const entry = store.getState().testSuite['s1'];
    expect(entry.dependencies).toEqual([{ id: 's0', type: 'prerequisite' }]);
    expect(entry.mainClaim).toBe('new claim');
  });

  describe('setCachedSuggestions', () => {
    it('caches suggestions for an existing entry', () => {
      store.setState({ testSuite: { s1: { goals: '', status: 'idle', history: [] } } });
      store.getState().setCachedSuggestions('s1', 'hash1', 'a suggestion');
      expect(store.getState().testSuite['s1'].cachedSuggestions).toEqual({
        inputHash: 'hash1',
        suggestions: 'a suggestion',
      });
    });

    it('is a no-op when the section is absent', () => {
      store.getState().setCachedSuggestions('missing', 'h', 's');
      expect(store.getState().testSuite['missing']).toBeUndefined();
    });
  });

  describe('toggleSectionVisibility', () => {
    it('adds then removes the id', () => {
      store.getState().toggleSectionVisibility('s1');
      expect(store.getState().hiddenSectionIds).toEqual(['s1']);
      store.getState().toggleSectionVisibility('s1');
      expect(store.getState().hiddenSectionIds).toEqual([]);
    });
  });

  describe('pruneOrphanEntries', () => {
    const withContent: TestSuiteEntry = { goals: 'real goals', status: 'idle', history: [] };
    const empty: TestSuiteEntry = { goals: '', status: 'idle', history: [] };

    it('drops empty orphans but keeps live ids and data-bearing orphans', () => {
      store.setState({
        testSuite: { live: empty, orphanEmpty: empty, orphanData: withContent },
      });
      store.getState().pruneOrphanEntries(['live']);
      const suite = store.getState().testSuite;
      expect(suite['live']).toBeDefined(); // live: kept even though empty
      expect(suite['orphanData']).toBeDefined(); // orphan with content: kept
      expect(suite['orphanEmpty']).toBeUndefined(); // orphan, no content: dropped
    });

    it('is a no-op while liveIds is empty (a transient mid-load state)', () => {
      const before = { orphanEmpty: empty };
      store.setState({ testSuite: before });
      store.getState().pruneOrphanEntries([]);
      // Same reference back: nothing removed.
      expect(store.getState().testSuite).toBe(before);
    });
  });

  describe('sources (persisted collection)', () => {
    const src = (id: string) => ({
      id,
      role: 'reference' as const,
      kind: 'Reference',
      label: id,
      glyph: '❡',
      content: `content of ${id}`,
    });

    it('addSource appends; removeSource drops by id', () => {
      const s = store.getState();
      s.addSource(src('a'));
      s.addSource(src('b'));
      expect(store.getState().sources.map((x) => x.id)).toEqual(['a', 'b']);
      store.getState().removeSource('a');
      expect(store.getState().sources.map((x) => x.id)).toEqual(['b']);
    });

    it('setSources replaces the collection (the load path)', () => {
      store.getState().addSource(src('a'));
      store.getState().setSources([src('x'), src('y')]);
      expect(store.getState().sources.map((x) => x.id)).toEqual(['x', 'y']);
    });

    it('mints collision-safe ids', () => {
      expect(makeSourceId()).not.toBe(makeSourceId());
    });

    it('updateSource patches editable fields and recomputes derived ones on a role change', () => {
      store.getState().addSource(src('a'));
      store.getState().updateSource('a', { label: 'Renamed', role: 'guidance' });
      const a = store.getState().sources[0];
      expect(a.label).toBe('Renamed');
      expect(a.role).toBe('guidance');
      expect(a.kind).toBe('Guidance');
      expect(a.glyph).not.toBe('❡');
      expect(a.content).toBe('content of a');
    });

    it('updateSource attaches an exegesis without disturbing siblings', () => {
      store.getState().addSource(src('a'));
      store.getState().addSource(src('b'));
      const exegesis = { content: 'Recon.', createdAt: 1, sourceHash: 'h' };
      store.getState().updateSource('b', { exegesis });
      expect(store.getState().sources[0].exegesis).toBeUndefined();
      expect(store.getState().sources[1].exegesis).toEqual(exegesis);
    });

    it('updateSource is a no-op for an unknown id', () => {
      store.getState().addSource(src('a'));
      const before = store.getState().sources;
      store.getState().updateSource('nope', { label: 'x' });
      expect(store.getState().sources).toEqual(before);
    });
  });

  describe('doctorChecklist (persisted work ledger)', () => {
    const checklist = () => ({
      scopeKey: 'root',
      thesis: 'T',
      criticalIssue: 'The most critical issue is X.',
      roadmapTitle: 'Front-load',
      roadmapOutline: ['step'],
      tasks: [
        { id: 'task-0', text: 'Do A', done: false, paragraphNumbers: [2], anchors: ['a'] },
        { id: 'task-1', text: 'Do B', done: false, paragraphNumbers: [], anchors: [] },
      ],
      createdAt: 1,
      sourceHash: 'h',
    });

    it('setDoctorChecklist replaces whole; null clears', () => {
      store.getState().setDoctorChecklist(checklist());
      expect(store.getState().doctorChecklist?.tasks).toHaveLength(2);
      store.getState().setDoctorChecklist(null);
      expect(store.getState().doctorChecklist).toBeNull();
    });

    it('toggleDoctorTask flips exactly the named task and is a no-op without a checklist', () => {
      store.getState().toggleDoctorTask('task-0'); // no checklist yet
      expect(store.getState().doctorChecklist).toBeNull();

      store.getState().setDoctorChecklist(checklist());
      store.getState().toggleDoctorTask('task-0');
      expect(store.getState().doctorChecklist?.tasks.map((t) => t.done)).toEqual([true, false]);
      store.getState().toggleDoctorTask('task-0'); // undo by re-flip
      expect(store.getState().doctorChecklist?.tasks.map((t) => t.done)).toEqual([false, false]);
    });
  });

  describe('adoptDocumentClaim', () => {
    it('writes the root mainClaim, creating the entry when absent', () => {
      store.getState().adoptDocumentClaim('The adopted thesis.');
      expect(store.getState().testSuite['root']?.mainClaim).toBe('The adopted thesis.');
    });

    it('also patches the root spec mainClaim when a spec exists', () => {
      store.setState({
        testSuite: {
          root: { goals: '', status: 'idle', history: [], spec: spec() } as TestSuiteEntry,
        },
      } as unknown as Partial<DocumentStateSlice>);
      store.getState().adoptDocumentClaim('New claim.');
      const root = store.getState().testSuite['root'];
      expect(root.mainClaim).toBe('New claim.');
      expect(root.spec?.mainClaim).toBe('New claim.');
    });
  });
});
