// Reorder-as-OPERATION (Arpeggio Phase 6) — the FIRST feature to structurally
// rewrite `project.md` (the single source of truth). A move cuts a section's whole
// subtree and reinserts it elsewhere (the pure `applyMove`), then re-derives
// everything the way every structural edit does (mirrors `acceptLevel`). A store
// thunk (like `createSnapshot` / `endSession`) so it is available uniformly to the
// sidebar keyboard path, the SPINE drag, and the command palette. The
// corruption-critical surgery is the pure `applyMove`; this adds the ceremony: a
// pre-move snapshot, Pass-0 id pinning (the moved subtree's stable ids are force-bound
// so no reconcile pass can reassign them — load-bearing when a body-anchor prefix or a
// title+level collision would otherwise let ids swap; a root that is a DUPLICATE germ
// heading is unaddressable in the fresh parse, so it degrades to a normal reconcile,
// exactly as a hand-edit would), a durable realizations re-seed, and an in-memory Undo.
// Dropping into an order-violating position is ALLOWED — nothing here blocks a move.

import type { StateCreator } from 'zustand';
import type { AppState } from '.';
import { applyMove, type MoveSpec } from '../lib/segment-helpers';
import { reconcileSectionIds, sectionAnchor } from '../lib/section-ids';
import { seedRealizations } from '../lib/structural-graph-helpers';
import { recomputeHomotypy } from '../lib/structural-part-helpers';
import { parseMarkdown } from '../lib/utils';
import type { Section } from '../types';

const flattenSections = (sections: Section[]): Section[] => {
  const out: Section[] = [];
  const walk = (ns: Section[]) => ns.forEach((n) => { out.push(n); walk(n.children); });
  walk(sections);
  return out;
};

/** The canonical heading line the pure `applyMove`/`locate` matches against. */
const canonicalHeading = (s: Section): string => `${'#'.repeat(Math.max(1, Math.min(6, s.level)))} ${s.title.trim()}`;

/** Pre-order ids of a section's whole subtree (for Pass-0 pinning). */
const subtreeIds = (root: Section): string[] => {
  const out: string[] = [];
  const walk = (n: Section) => { out.push(n.id); n.children.forEach(walk); };
  walk(root);
  return out;
};

/** Find the moved subtree's root in the FRESH parse (by heading + body anchor); null if ambiguous. */
const findMovedRoot = (parsed: Section[], spec: MoveSpec): Section | null => {
  let cands = flattenSections(parsed).filter((n) => canonicalHeading(n) === spec.sourceHeadingAnchor);
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  if (spec.sourceBodyAnchor) {
    const byBody = cands.filter((n) => sectionAnchor(n) === spec.sourceBodyAnchor);
    if (byBody.length === 1) return byBody[0];
    if (byBody.length > 1) cands = byBody;
  }
  return null; // duplicate germ headings — skip pinning, reconcile normally
};

export interface MoveResult {
  moved: boolean;
  movedTitle: string;
  /** Parts whose text held but whose surround moved because of this reorder. */
  homotypyIds: string[];
  /** Restore the pre-move document (localContent + sections + ledger + realizations). */
  undo: () => Promise<void>;
}

const NO_MOVE: MoveResult = { moved: false, movedTitle: '', homotypyIds: [], undo: async () => {} };

export interface ReorderSlice {
  /** Move section `fromId` to before/after section `toId`; rewrites `project.md`. */
  moveSection: (fromId: string, toId: string, position: 'before' | 'after') => Promise<MoveResult>;
  /** Move a section up/down among its SIBLINGS (the accessible keyboard path). */
  moveSectionSibling: (id: string, dir: 'up' | 'down') => Promise<MoveResult>;
}

export const createReorderSlice: StateCreator<AppState, [], [], ReorderSlice> = (_set, get) => ({
  moveSection: async (fromId, toId, position) => {
    const s = get();
    const flat = flattenSections(s.sections);
    const from = flat.find((n) => n.id === fromId);
    const to = flat.find((n) => n.id === toId);
    if (!from || !to || from.id === to.id) return NO_MOVE;

    const spec: MoveSpec = {
      sourceHeadingAnchor: canonicalHeading(from),
      sourceBodyAnchor: sectionAnchor(from),
      sourceOrdinal: flat.indexOf(from),
      destHeadingAnchor: canonicalHeading(to),
      destBodyAnchor: sectionAnchor(to),
      destOrdinal: flat.indexOf(to),
      position,
    };

    const next = applyMove(s.localContent, spec);
    if (next === s.localContent) return NO_MOVE; // orphan / self / already-in-place

    // Capture the pre-move state for a clean in-memory Undo (independent of the
    // snapshot guards); capture the moved subtree's stable ids for Pass-0 pinning.
    const preContent = s.localContent;
    const preSections = s.sections;
    const preLedger = s.sectionIdLedger;
    const preRealizations = s.realizations;
    const movingIds = subtreeIds(from);

    // Pre-move snapshot — the first structural project.md rewrite genuinely warrants
    // it (git-durable under Tauri; a version-history entry in the browser). Non-fatal.
    try {
      await get().createSnapshot('pre-ai-write', 'all', get().promptsConfig);
    } catch (e) {
      console.warn('pre-move snapshot failed (non-fatal):', e);
    }

    // Write (acceptLevel-exact): the new markdown is the source of truth.
    get().setMarkdown(next);
    get().setLocalContent(next);

    // Re-parse + reconcile, PINNING the moved subtree's ids (so a germ subtree can't
    // swap ids and orphan a spec). Ambiguous (duplicate germ) → reconcile normally.
    const parsed = parseMarkdown(next, preSections);
    const movedRoot = findMovedRoot(parsed, spec);
    const pinned = new Map<Section, string>();
    if (movedRoot) {
      flattenSections([movedRoot]).forEach((n, i) => { if (i < movingIds.length) pinned.set(n, movingIds[i]); });
    }
    const { sections: tree, ledger, changed } = reconcileSectionIds(parsed, preLedger, pinned);
    get().setSections(tree);
    if (changed) get().setSectionIdLedger(ledger);

    // Post-move: durably re-seed realizations against the new configuration (the
    // modal re-seeds for display each render; the persisted sidecar needs this).
    get().setRealizations(seedRealizations(get().structuralParts, tree, preRealizations));
    await get().saveCurrentState();

    const homotypyIds = recomputeHomotypy(get().structuralParts, next, tree).homotypyIds;

    const undo = async () => {
      get().setLocalContent(preContent);
      get().setMarkdown(preContent);
      get().setSections(preSections);
      get().setSectionIdLedger(preLedger);
      get().setRealizations(preRealizations);
      await get().saveCurrentState();
    };

    return { moved: true, movedTitle: from.title, homotypyIds, undo };
  },

  moveSectionSibling: async (id, dir) => {
    const flat = flattenSections(get().sections);
    const node = flat.find((n) => n.id === id);
    if (!node) return NO_MOVE;
    const siblings = flat.filter((n) => n.parentId === node.parentId && n.level === node.level);
    const idx = siblings.findIndex((n) => n.id === id);
    const target = dir === 'up' ? siblings[idx - 1] : siblings[idx + 1];
    if (!target) return NO_MOVE; // already the first / last sibling
    return get().moveSection(id, target.id, dir === 'up' ? 'before' : 'after');
  },
});
