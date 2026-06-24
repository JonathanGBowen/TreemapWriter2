import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import type { ParagraphKind, ReverseOutlineBullet, ReverseOutlineDoc } from '../types';
import { anchorFor, segmentParagraphs, type ParagraphBlock } from '../lib/paragraph-helpers';

/**
 * The Parallel Editor workflow, as an ephemeral slice. Like the Glass Box
 * (revision-state) NOTHING here is persisted: the rows hold the working session
 * (outlineB edits + regenerated draftB). Only the faithful outline (outlineA)
 * persists — and it lives in document-state (`reverseOutlines`), because it is
 * durable domain data that must survive closing the workspace. The open flag
 * lives here because it is inseparable from the workflow it gates.
 *
 * Pure state only: async orchestration (the two AI calls, accept→write+snapshot)
 * lives in features/parallel/use-parallel-actions.ts.
 */
export type ParallelPhase = 'idle' | 'outlining' | 'editing' | 'regenerating' | 'review';

/**
 * A row's working status. `regenerating` is tracked separately by `regeneratingIds`
 * (a row's spinner), so it is NOT a status here — status is the semantic state:
 * unchanged ⇄ edited, plus inserted / deleted (structural edits), regenerated (a
 * draftB is ready), accepted (applied to the document), error (regeneration failed).
 */
export type BlockStatus =
  | 'unchanged'
  | 'edited'
  | 'inserted'
  | 'deleted'
  | 'regenerated'
  | 'accepted'
  | 'error';

/** One aligned row: a paragraph plus its three companions (outlineA · outlineB · draftB). */
export interface ParallelRow {
  /** Stable row id (also the persisted SavedOutlineBullet id). */
  id: string;
  kind: ParagraphKind;
  /** The original paragraph (read-only). Empty string for an inserted row. */
  draftA: string;
  /** The faithful distillation (editable to correct faithfulness; persists). */
  outlineA: string;
  /** The working target the user edits (drives regeneration). */
  outlineB: string;
  /** Regenerated prose; === draftA when unchanged, null when a change is pending. */
  draftB: string | null;
  status: BlockStatus;
  /** Verbatim anchor of draftA — the persistence/relocation link. */
  anchor: string;
}

export interface ParallelSlice {
  parallelOpen: boolean;
  parallelPhase: ParallelPhase;
  /**
   * false = section-at-a-time (rail shown; scope follows the shared `selectedId`);
   * true = whole document. The section scope itself is the shared `selectedId`, so
   * the rail reuse "just works" — only this toggle lives in the slice.
   */
  parallelWholeDoc: boolean;
  rows: ParallelRow[];
  /** Hash of the source the rows were built from — flags a stale saved outline. */
  sourceHash: string | null;
  /** Rows with an in-flight regenerate call (drives the per-row spinner). */
  regeneratingIds: string[];

  openParallel: (wholeDoc: boolean) => void;
  closeParallel: () => void;
  setParallelWholeDoc: (wholeDoc: boolean) => void;
  setParallelPhase: (phase: ParallelPhase) => void;
  setRows: (rows: ParallelRow[]) => void;
  setSourceHash: (hash: string | null) => void;
  /** Correct a faithful distillation (outlineA). Re-derives the row's status. */
  editOutlineA: (id: string, sentence: string) => void;
  /** Edit the target distillation (outlineB). Re-derives status; invalidates draftB. */
  editOutlineB: (id: string, sentence: string) => void;
  insertRowAfter: (id: string) => void;
  deleteRow: (id: string) => void;
  resetRow: (id: string) => void;
  setRowDraftB: (id: string, draftB: string, status: BlockStatus) => void;
  markRowAccepted: (id: string) => void;
  setRegenerating: (id: string, on: boolean) => void;
  resetParallel: () => void;
}

let rowSeq = 0;
/** Monotonic row id — Date.now alone can collide within a tick (cf. makeSourceId). */
export const makeRowId = (): string => `row_${Date.now()}_${rowSeq++}`;

/**
 * Re-derive a row's status after an outline edit. An inserted row stays inserted;
 * otherwise the row is `edited` when its two outlines differ and `unchanged` when
 * they match. Either edit invalidates a prior regeneration: `edited` clears draftB
 * (a change is pending), `unchanged` restores draftB to draftA verbatim.
 */
const recompute = (r: ParallelRow): ParallelRow => {
  if (r.status === 'inserted') return r;
  const changed = r.outlineB.trim() !== r.outlineA.trim();
  return changed
    ? { ...r, status: 'edited', draftB: null }
    : { ...r, status: 'unchanged', draftB: r.draftA };
};

const rowFrom = (b: ParagraphBlock, sentence: string): ParallelRow => ({
  id: makeRowId(),
  kind: b.kind,
  draftA: b.text,
  outlineA: sentence,
  outlineB: sentence,
  draftB: b.text,
  status: 'unchanged',
  anchor: anchorFor(b.text),
});

/** A non-prose block is its own distillation; a prose block with no bullet is blank. */
const fallbackSentence = (b: ParagraphBlock): string => (b.kind === 'prose' ? '' : b.text.trim());

/** Build rows from blocks + a 1:1 bullet array (the post-generation path). */
export const rowsFromOutline = (
  blocks: ParagraphBlock[],
  bullets: ReverseOutlineBullet[],
): ParallelRow[] => blocks.map((b, i) => rowFrom(b, bullets[i]?.sentence ?? fallbackSentence(b)));

/**
 * Build rows for a scope's prose on workspace open. With a saved outline, each
 * block takes the saved distillation matched by verbatim anchor (literal-match-or-
 * blank — never guess); a prose block with no saved match is left blank for the
 * user to generate. With no saved outline, every prose row starts blank.
 */
export const buildRowsForScope = (
  scopeText: string,
  savedDoc?: ReverseOutlineDoc,
): ParallelRow[] => {
  const blocks = segmentParagraphs(scopeText);
  if (!savedDoc) return blocks.map((b) => rowFrom(b, fallbackSentence(b)));
  const byAnchor = new Map(savedDoc.bullets.map((bl) => [bl.anchor, bl]));
  return blocks.map((b) => {
    const saved = byAnchor.get(anchorFor(b.text));
    return rowFrom(b, saved ? saved.sentence : fallbackSentence(b));
  });
};

/** Rows that need an AI regenerate call (a pending change with no fresh draftB). */
export const rowsNeedingRegen = (rows: ParallelRow[]): ParallelRow[] =>
  rows.filter((r) => r.status === 'edited' || r.status === 'inserted');

/** Rows that produce a proposal when accepted (changed prose to splice into the doc). */
export const changedRows = (rows: ParallelRow[]): ParallelRow[] =>
  rows.filter((r) => r.status === 'edited' || r.status === 'inserted' || r.status === 'deleted');

/** Project the durable outline (outlineA) to persist — only real, current paragraphs. */
export const outlineDocFromRows = (
  scopeKey: string,
  rows: ParallelRow[],
  sourceHash: string,
): ReverseOutlineDoc => ({
  scopeKey,
  bullets: rows
    .filter((r) => r.status !== 'inserted' && r.status !== 'deleted' && r.draftA !== '')
    .map((r) => ({ id: r.id, sentence: r.outlineA, kind: r.kind, anchor: r.anchor })),
  sourceHash,
  generatedAt: Date.now(),
});

/** Cleared session state for a fresh scope (drops rows + in-flight work). */
const CLEARED = {
  parallelPhase: 'idle' as ParallelPhase,
  rows: [] as ParallelRow[],
  sourceHash: null as string | null,
  regeneratingIds: [] as string[],
};

export const createParallelSlice: StateCreator<AppState, [], [], ParallelSlice> = (set) => ({
  parallelOpen: false,
  parallelWholeDoc: false,
  ...CLEARED,

  openParallel: (parallelWholeDoc) =>
    set({ parallelOpen: true, parallelWholeDoc, ...CLEARED }),
  // Close drops all ephemeral rows; the persisted outlineA (document-state) is
  // untouched and nothing was written to the document, so reopening re-segments
  // from the saved outline. No confirm — closing is inherently non-destructive.
  closeParallel: () => set({ parallelOpen: false, ...CLEARED }),
  // Switching scope (toggle whole-doc) drops the in-flight pass; the workspace
  // re-hydrates rows from the saved outline for the new scope.
  setParallelWholeDoc: (parallelWholeDoc) => set({ parallelWholeDoc, ...CLEARED }),
  setParallelPhase: (parallelPhase) => set({ parallelPhase }),
  setRows: (rows) => set({ rows }),
  setSourceHash: (sourceHash) => set({ sourceHash }),

  editOutlineA: (id, outlineA) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === id ? recompute({ ...r, outlineA }) : r)) })),
  editOutlineB: (id, outlineB) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === id ? recompute({ ...r, outlineB }) : r)) })),

  insertRowAfter: (id) =>
    set((s) => {
      const idx = s.rows.findIndex((r) => r.id === id);
      if (idx < 0) return s;
      const fresh: ParallelRow = {
        id: makeRowId(),
        kind: 'prose',
        draftA: '',
        outlineA: '',
        outlineB: '',
        draftB: null,
        status: 'inserted',
        anchor: '',
      };
      return { rows: [...s.rows.slice(0, idx + 1), fresh, ...s.rows.slice(idx + 1)] };
    }),

  deleteRow: (id) =>
    set((s) => {
      const r = s.rows.find((x) => x.id === id);
      if (!r) return s;
      // An inserted row never existed in the document — just drop it. A real row
      // is marked deleted (kept for undo); draftB '' is the deletion proposal.
      if (r.status === 'inserted') return { rows: s.rows.filter((x) => x.id !== id) };
      return {
        rows: s.rows.map((x) => (x.id === id ? { ...x, status: 'deleted', draftB: '' } : x)),
      };
    }),

  resetRow: (id) =>
    set((s) => {
      const r = s.rows.find((x) => x.id === id);
      if (!r) return s;
      if (r.status === 'inserted') return { rows: s.rows.filter((x) => x.id !== id) };
      return {
        rows: s.rows.map((x) =>
          x.id === id ? { ...x, outlineB: x.outlineA, draftB: x.draftA, status: 'unchanged' } : x,
        ),
      };
    }),

  setRowDraftB: (id, draftB, status) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, draftB, status } : r)) })),
  markRowAccepted: (id) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r)) })),

  setRegenerating: (id, on) =>
    set((s) => ({
      regeneratingIds: on
        ? s.regeneratingIds.includes(id)
          ? s.regeneratingIds
          : [...s.regeneratingIds, id]
        : s.regeneratingIds.filter((x) => x !== id),
    })),

  resetParallel: () => set({ ...CLEARED }),
});
