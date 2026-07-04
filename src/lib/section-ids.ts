// Stable section IDs via a content-anchored ledger (Phase 1 of the Arpeggio
// integration; see docs/arpeggio-integration.md and the migration log).
//
// The problem: section ids are derived by `generateId` (`title.slug + lineIndex`)
// inside `parseMarkdown`, reconciled across re-parses only by title-matching. So
// a rename mints a new id (orphaning the section's spec), and reordering two
// same-titled sections swaps their ids. Everything persisted is keyed by section
// id (`testSuite`, spec filenames, dependency refs, gist/reverse-outline keys),
// so that fragility silently detaches the user's work.
//
// The fix, chosen over inline heading markers because it keeps `project.md`
// completely pristine (no markers in the prose, nothing leaking into AI context,
// word counts, treemap area, or the clipboard): a persisted ledger that binds
// each stable id to its heading by a verbatim BODY anchor — the same
// content-anchor discipline StructuralPart / gist / provenance already use
// (`anchorFor`, "literal-match-or-orphan, never fuzzy"). `reconcileSectionIds`
// runs on every live parse, resolving each section's stable id from the ledger
// (Pass 1 anchor -> Pass 2 title+level -> Pass 3 freeze/mint) and returning the
// updated ledger. This module is pure — no React, no store, no SDK — and fully
// unit-tested, like the other src/lib/*-helpers engines.

import type { Section, SectionIdBinding } from '../types';

/** The reserved document-root id — never a heading, never rotated. */
const ROOT_ID = 'root';

/** Anchor window — the first N chars of the trimmed body (cf. `anchorFor`, 64). */
const ANCHOR_LEN = 64;

/**
 * A section's stable anchor: the first ~64 chars of its OWN body — the content
 * AFTER the heading line, so the anchor survives a *rename* (which changes the
 * title, not the body). Both ends are trimmed before slicing so the anchor does
 * not depend on the section's position (the last section in a document carries no
 * trailing blank line, unlike the others) — it is an EQUALITY key here, not a
 * substring for relocation, so trimming is correct. Empty for a germ heading with
 * no body yet (Pass 2's title+level fallback then carries it).
 */
export function sectionAnchor(section: Section): string {
  const nl = section.content.indexOf('\n');
  const body = nl === -1 ? '' : section.content.slice(nl + 1);
  return body.trim().slice(0, ANCHOR_LEN);
}

/** Opaque, filename-safe random id (base36 from crypto), unique against `taken`. */
export function newSectionId(taken: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const id = `sec_${randomBase36(10)}`;
    if (!taken.has(id)) return id;
  }
  // Astronomically unlikely fallback — keep it unique by construction.
  return `sec_${randomBase36(10)}_${taken.size}`;
}

function randomBase36(len: number): string {
  const bytes = new Uint8Array(len);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (let i = 0; i < len; i++) out += (bytes[i] % 36).toString(36);
  return out;
}

export interface ReconcileResult {
  /** The section tree with stable ids assigned (new objects; input untouched). */
  sections: Section[];
  /** The rebuilt ledger, in document order, with fresh anchors/ordinals. */
  ledger: SectionIdBinding[];
  /** True when an id assignment changed or the id set gained/lost a member —
   *  the caller persists on this. (Pure anchor/ordinal drift does not churn.) */
  changed: boolean;
}

// Map key over (title, level). The heading regex `^(#{1,6})\s+(.*)` excludes
// newlines from a title, so a newline separator is collision-proof and clean.
const titleLevelKey = (title: string, level: number): string => `${level}\n${title}`;

/**
 * Resolve each section's stable id from the ledger and return the updated tree +
 * ledger. Layered matching, each ledger entry consumable once:
 *   Pass 0 — PINNED (Phase 6 move): force-bind specific nodes to specific ids,
 *            independent of body content, so a structural reorder can pin the moved
 *            subtree's ids (defeating the empty-body germ nearest-ordinal swap that
 *            would otherwise orphan a spec). Empty/absent for a normal parse.
 *   Pass 1 — exact BODY anchor (survives rename + reorder + duplicate-title).
 *   Pass 2 — title + level, nearest ordinal (survives rewording / germ headings).
 *   Pass 3 — SEED (empty ledger): adopt the section's CURRENT id verbatim (the
 *            migration "freeze" — keeps every existing testSuite key attached);
 *            otherwise mint a fresh opaque id (a genuinely new heading). A would-be
 *            duplicate id (e.g. a copy-pasted section) always mints fresh.
 * `'root'` never appears here (`parseMarkdown` returns root.children), and
 * top-level `parentId` stays `'root'`.
 */
export function reconcileSectionIds(
  sections: Section[],
  ledger: SectionIdBinding[],
  pinned?: Map<Section, string>,
): ReconcileResult {
  const flat: Section[] = [];
  const walk = (nodes: Section[]) => {
    for (const n of nodes) {
      flat.push(n);
      walk(n.children);
    }
  };
  walk(sections);

  const seeding = ledger.length === 0;
  const anchors = flat.map(sectionAnchor);

  // Ledger lookups; entries are consumed as they are claimed.
  const byAnchor = new Map<string, SectionIdBinding[]>();
  const byTitleLevel = new Map<string, SectionIdBinding[]>();
  for (const b of ledger) {
    if (b.anchor) {
      const arr = byAnchor.get(b.anchor);
      if (arr) arr.push(b);
      else byAnchor.set(b.anchor, [b]);
    }
    const k = titleLevelKey(b.title, b.level);
    const arr2 = byTitleLevel.get(k);
    if (arr2) arr2.push(b);
    else byTitleLevel.set(k, [b]);
  }

  const consumed = new Set<SectionIdBinding>();
  const claimedIds = new Set<string>();
  const assigned = new Map<Section, string>();

  const claim = (node: Section, binding: SectionIdBinding) => {
    consumed.add(binding);
    claimedIds.add(binding.id);
    assigned.set(node, binding.id);
  };

  // Pass 0 — pinned ids (a structural move force-binds its moved subtree). Assign
  // the pinned id and consume any ledger entry carrying it, so no later pass can
  // reassign that id — deterministic and independent of the section's body.
  if (pinned && pinned.size > 0) {
    const bindingById = new Map<string, SectionIdBinding>();
    for (const b of ledger) if (!bindingById.has(b.id)) bindingById.set(b.id, b);
    for (const node of flat) {
      const pid = pinned.get(node);
      if (!pid || assigned.has(node) || claimedIds.has(pid)) continue;
      const b = bindingById.get(pid);
      if (b) consumed.add(b);
      claimedIds.add(pid);
      assigned.set(node, pid);
    }
  }

  // Pass 1 — exact body anchor.
  flat.forEach((node, i) => {
    const anchor = anchors[i];
    if (!anchor) return;
    const bucket = byAnchor.get(anchor);
    if (!bucket) return;
    const cand = bucket.find((b) => !consumed.has(b) && !claimedIds.has(b.id));
    if (cand) claim(node, cand);
  });

  // Pass 2 — title + level, nearest ordinal.
  flat.forEach((node, i) => {
    if (assigned.has(node)) return;
    const bucket = byTitleLevel.get(titleLevelKey(node.title, node.level));
    if (!bucket) return;
    let best: SectionIdBinding | undefined;
    let bestDist = Infinity;
    for (const b of bucket) {
      if (consumed.has(b) || claimedIds.has(b.id)) continue;
      const d = Math.abs(b.ordinal - i);
      if (d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    if (best) claim(node, best);
  });

  // Pass 3 — seed-freeze or mint.
  for (const node of flat) {
    if (assigned.has(node)) continue;
    if (seeding && node.id && node.id !== ROOT_ID && !claimedIds.has(node.id)) {
      claimedIds.add(node.id);
      assigned.set(node, node.id);
    } else {
      const id = newSectionId(claimedIds);
      claimedIds.add(id);
      assigned.set(node, id);
    }
  }

  const idChanged = flat.some((node) => assigned.get(node) !== node.id);

  // Rewrite ids + parentId links into fresh section objects (input untouched).
  const rewrite = (nodes: Section[], parentId: string): Section[] =>
    nodes.map((n) => {
      const newId = assigned.get(n) as string;
      return { ...n, id: newId, parentId, children: rewrite(n.children, newId) };
    });
  const stable = rewrite(sections, ROOT_ID);

  // Rebuild the ledger from the reconciled tree, in document order.
  const newLedger: SectionIdBinding[] = [];
  let ordinal = 0;
  const collect = (nodes: Section[]) => {
    for (const n of nodes) {
      newLedger.push({ id: n.id, anchor: sectionAnchor(n), title: n.title, level: n.level, ordinal: ordinal++ });
      collect(n.children);
    }
  };
  collect(stable);

  // Persist on id changes OR a change in the id SET (add/remove) — not on pure
  // anchor/ordinal drift, which is re-derived from live text on every parse.
  const oldIds = new Set(ledger.map((b) => b.id));
  const setChanged = newLedger.length !== ledger.length || newLedger.some((b) => !oldIds.has(b.id));

  return { sections: stable, ledger: newLedger, changed: idChanged || setChanged };
}
