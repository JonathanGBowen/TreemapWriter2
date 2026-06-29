import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { SegmentEdit, SegmentEditStatus, SegmentGenre, SegmentGranularity, SegmentMode } from '../types';
import type { ModelChoice } from '../services/ai/model-types';
import { inferGenre, baseLevelFor } from '../services/ai/ai-provider.segment';
import { hasNoHeadings } from '../lib/segment-helpers';
import { resolveModelChoice } from '../services/ai/resolve-model-choice';
import { DEFAULT_MODEL_CONFIG } from '../services/ai/model-config';

/**
 * The Articulation (segmentation) workspace, as an ephemeral slice — the sibling of
 * the Generate-Specs (interpolation) slice. NOTHING here is persisted: the working
 * copy, the discovered levels, their proposed edits, and the accumulated summaries
 * are all session state. The walk operates on a WORKING COPY (`segmentWorking`),
 * never the live document, until the author explicitly applies it (the hook's
 * `applyToDocument`) — so closing without applying leaves `project.md` untouched.
 *
 * Pure state only: the AI calls, the markdown surgery, and the document write live
 * in features/segment/use-segment-actions (mirroring use-interpolate-actions). The
 * walk is forward-only by DEPTH: depth 0 (the whole document) → its parts → their
 * sub-parts, each level's spans recomputed from the updated working copy on accept.
 */
export type SegmentLevelStatus = 'idle' | 'generating' | 'proposed' | 'accepted' | 'empty' | 'error';

/** One proposed heading edit in the review list, with its accept/reject state. */
export interface ProposedEdit {
  id: string;
  edit: SegmentEdit;
  status: SegmentEditStatus;
}

/** One discovered level of the descent (a depth), with its reviewable edits. */
export interface SegmentLevel {
  depth: number;
  /** The markdown heading level this depth inserts at (e.g. 2 → "## "). */
  targetLevel: number;
  status: SegmentLevelStatus;
  edits: ProposedEdit[];
  /** How many spans were examined at this level (rail subtitle). */
  spanCount: number;
}

export interface SegmentSlice {
  segmentOpen: boolean;
  segmentMode: SegmentMode;
  segmentGranularity: SegmentGranularity;
  segmentGenre: SegmentGenre;
  /** The shallowest heading level the walk inserts (frozen from genre + structure). */
  baseLevel: number;
  segmentDepthChoice: ModelChoice;
  /** The walk's working copy of the markdown (never the live document until applied). */
  segmentWorking: string;
  /** Reverse-outline glosses accumulated across accepted levels (summaries mode). */
  segmentSummaries: { title: string; sentence: string }[];
  /** The discovered levels, indexed by depth. */
  segmentLevels: SegmentLevel[];
  /** Index (== depth) of the level currently being worked. */
  segmentCursor: number;
  /** True once the one `pre-ai-write` snapshot has been taken this session. */
  walkStarted: boolean;
  /** True once a generated level had no spans/edits — the descent bottomed out. */
  segmentDone: boolean;

  /** Open with a fresh walk: infer genre/baseLevel from the live document. */
  openSegment: (mode?: SegmentMode) => void;
  /**
   * The spec-sweep entry. When the document has NO headings, articulation is the
   * necessary first step — open the Articulation workspace (conservative); the
   * author hands off to the spec sweep from there. Otherwise open the spec sweep
   * directly. The one door behind the dock's "Generate specs" glyph.
   */
  startSpecSweep: () => void;
  closeSegment: () => void;
  setSegmentMode: (mode: SegmentMode) => void;
  setSegmentGranularity: (g: SegmentGranularity) => void;
  setSegmentGenre: (genre: SegmentGenre) => void;
  setSegmentDepthChoice: (choice: ModelChoice) => void;
  setSegmentWorking: (markdown: string) => void;
  pushSegmentSummaries: (summaries: { title: string; sentence: string }[]) => void;
  /** Insert or replace (by depth) one discovered level. */
  setSegmentLevel: (level: SegmentLevel) => void;
  patchSegmentLevel: (depth: number, patch: Partial<SegmentLevel>) => void;
  /** Flip one edit between accepted and rejected. */
  toggleSegmentEdit: (depth: number, editId: string) => void;
  /** Edit a proposed heading's title in place (insert/split/retitle only). */
  setSegmentEditTitle: (depth: number, editId: string, title: string) => void;
  /** Accept-all / reject-all for a level. */
  setSegmentLevelEditStatus: (depth: number, status: SegmentEditStatus) => void;
  advanceSegmentCursor: () => void;
  markSegmentWalkStarted: () => void;
  setSegmentDone: (done: boolean) => void;
}

export const createSegmentSlice: StateCreator<AppState, [], [], SegmentSlice> = (set, get) => ({
  segmentOpen: false,
  segmentMode: 'conservative',
  segmentGranularity: 'medium',
  segmentGenre: 'monograph',
  baseLevel: 1,
  segmentDepthChoice: DEFAULT_MODEL_CONFIG.segmentSpan,
  segmentWorking: '',
  segmentSummaries: [],
  segmentLevels: [],
  segmentCursor: 0,
  walkStarted: false,
  segmentDone: false,

  openSegment: (mode = 'conservative') => {
    const s = get();
    const wordCount = s.markdown.trim() ? s.markdown.trim().split(/\s+/).length : 0;
    const genre = inferGenre(wordCount);
    set({
      segmentOpen: true,
      segmentMode: mode,
      segmentGranularity: 'medium',
      segmentGenre: genre,
      baseLevel: baseLevelFor(genre, s.sections),
      segmentDepthChoice: resolveModelChoice('segmentSpan', s.modelConfig, s.globalModelDefault),
      segmentWorking: s.markdown,
      segmentSummaries: [],
      segmentLevels: [],
      segmentCursor: 0,
      walkStarted: false,
      segmentDone: false,
    });
  },

  startSpecSweep: () => {
    const s = get();
    if (hasNoHeadings(s.sections)) get().openSegment('conservative');
    else (get() as AppState).openInterpolate();
  },

  closeSegment: () =>
    set({
      segmentOpen: false,
      segmentWorking: '',
      segmentSummaries: [],
      segmentLevels: [],
      segmentCursor: 0,
      walkStarted: false,
      segmentDone: false,
    }),

  setSegmentMode: (segmentMode) => set({ segmentMode }),
  setSegmentGranularity: (segmentGranularity) => set({ segmentGranularity }),
  // Changing the genre re-anchors the base heading level (situated number).
  setSegmentGenre: (genre) =>
    set((s) => ({ segmentGenre: genre, baseLevel: baseLevelFor(genre, s.sections) })),
  setSegmentDepthChoice: (segmentDepthChoice) => set({ segmentDepthChoice }),
  setSegmentWorking: (segmentWorking) => set({ segmentWorking }),
  pushSegmentSummaries: (summaries) =>
    set((s) => ({ segmentSummaries: [...s.segmentSummaries, ...summaries] })),

  setSegmentLevel: (level) =>
    set((s) => {
      const next = [...s.segmentLevels];
      next[level.depth] = level;
      return { segmentLevels: next };
    }),

  patchSegmentLevel: (depth, patch) =>
    set((s) => {
      const existing = s.segmentLevels[depth];
      if (!existing) return {};
      const next = [...s.segmentLevels];
      next[depth] = { ...existing, ...patch };
      return { segmentLevels: next };
    }),

  toggleSegmentEdit: (depth, editId) =>
    set((s) => {
      const level = s.segmentLevels[depth];
      if (!level) return {};
      const flip = (st: SegmentEditStatus): SegmentEditStatus => (st === 'rejected' ? 'accepted' : 'rejected');
      const edits = level.edits.map((e) => (e.id === editId ? { ...e, status: flip(e.status) } : e));
      const next = [...s.segmentLevels];
      next[depth] = { ...level, edits };
      return { segmentLevels: next };
    }),

  setSegmentEditTitle: (depth, editId, title) =>
    set((s) => {
      const level = s.segmentLevels[depth];
      if (!level) return {};
      const edits = level.edits.map((e) => {
        if (e.id !== editId) return e;
        const k = e.edit.kind;
        if (k === 'insert' || k === 'split' || k === 'retitle') {
          return { ...e, edit: { ...e.edit, title } };
        }
        return e;
      });
      const next = [...s.segmentLevels];
      next[depth] = { ...level, edits };
      return { segmentLevels: next };
    }),

  setSegmentLevelEditStatus: (depth, status) =>
    set((s) => {
      const level = s.segmentLevels[depth];
      if (!level) return {};
      const edits = level.edits.map((e) => ({ ...e, status }));
      const next = [...s.segmentLevels];
      next[depth] = { ...level, edits };
      return { segmentLevels: next };
    }),

  advanceSegmentCursor: () => set((s) => ({ segmentCursor: s.segmentCursor + 1 })),
  markSegmentWalkStarted: () => set({ walkStarted: true }),
  setSegmentDone: (segmentDone) => set({ segmentDone }),
});
