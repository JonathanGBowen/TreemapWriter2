// Pure write-side section math: slicing a section out of the document and
// splicing edited content back in. The read side (parseMarkdown) lives in
// lib/utils.ts; every writer that maps section-scoped edits onto the whole
// markdown goes through here so the boundary math has exactly one home — and
// one test suite (see __tests__/section-edit.test.ts, which round-trips these
// against parseMarkdown). No React, no store (the lib rule).

import type { Section } from '../types';
import { parseMarkdown } from './utils';

/** A section's character-offset span in a document. `to` is exclusive. */
export interface SectionRange {
  from: number;
  to: number;
  startLine: number;
  /** Inclusive, matching parseMarkdown's convention. */
  endLine: number;
}

/** Depth-first flatten of a section tree (document order). */
export const flattenSections = (nodes: Section[]): Section[] => {
  const out: Section[] = [];
  const walk = (list: Section[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
};

/**
 * Locate a section's live character span by re-parsing the given document —
 * never trust cached Section offsets against a buffer that may have changed
 * since the (debounced) parse. `'root'` spans the whole document. Returns null
 * when the id no longer resolves (renamed / deleted heading).
 *
 * ALWAYS thread the store's current `oldSections` when you have them: derived
 * ids embed the heading's line index, so a fresh parse of a buffer whose line
 * count shifted would mint ids that no longer match the store's — the
 * id-continuity chain (parseMarkdown's reuse-by-title) is what keeps the
 * lookup honest across edits.
 *
 * The span covers the section's fullContent: heading line through the last
 * line before the next same-or-higher heading (parseMarkdown's inclusive
 * `endLine`), excluding the trailing newline that separates it from what
 * follows.
 */
export const sectionRangeInDoc = (
  doc: string,
  sectionId: string,
  oldSections: Section[] = [],
): SectionRange | null => {
  const lines = doc.split('\n');
  if (sectionId === 'root') {
    return { from: 0, to: doc.length, startLine: 0, endLine: lines.length - 1 };
  }
  const sec = flattenSections(parseMarkdown(doc, oldSections)).find((s) => s.id === sectionId);
  if (!sec) return null;

  let offset = 0;
  const lineOffsets: number[] = [];
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }
  const from = lineOffsets[sec.startLine];
  const to = lineOffsets[sec.endLine] + lines[sec.endLine].length;
  return { from, to, startLine: sec.startLine, endLine: sec.endLine };
};

/**
 * Replace a section's OWN content (heading line through the line before its
 * first child, or its whole span when childless) with `newContent`, leaving
 * every other byte of the document untouched. This is the save path for the
 * sprint/section editors, whose buffer is seeded from `Section.content`.
 *
 * Returns null when the section can't be found (caller surfaces the error).
 *
 * Boundary note: parseMarkdown's `endLine` is INCLUSIVE, so a childless
 * section's own content ends AT `endLine` and the splice resumes at
 * `endLine + 1`. (The pre-2026-07 App-local version resumed at `endLine`,
 * which re-emitted the section's last line after every save.)
 */
export const replaceSectionContent = (
  doc: string,
  sectionId: string,
  newContent: string,
  oldSections: Section[] = [],
): string | null => {
  const sec = flattenSections(parseMarkdown(doc, oldSections)).find((s) => s.id === sectionId);
  if (!sec) return null;

  const lines = doc.split('\n');
  const resumeAt = sec.children.length > 0 ? sec.children[0].startLine : sec.endLine + 1;
  const before = lines.slice(0, sec.startLine);
  const after = lines.slice(resumeAt);
  return [...before, newContent, ...after].join('\n');
};

/**
 * First occurrence of `needle` that lies entirely inside `range`, or -1.
 * The range-confined sibling of findProposalOffset (revision-helpers) — used
 * so a section-scoped accept can never splice an earlier section's duplicate
 * of the same phrase.
 */
export const findInRange = (
  doc: string,
  needle: string,
  range: { from: number; to: number },
): number => {
  if (!needle) return -1;
  const at = doc.indexOf(needle, range.from);
  if (at < 0 || at + needle.length > range.to) return -1;
  return at;
};

/**
 * Case-insensitive first occurrence of `needle` inside `range`, or -1. The
 * search-relay locator: a sidebar FTS hit names a section; this finds where the
 * query actually sits in that section's live span so the editor can land the
 * caret on it (the caller falls back to the section start when FTS's stemmed
 * match has no literal occurrence).
 */
export const findInRangeInsensitive = (
  doc: string,
  needle: string,
  range: { from: number; to: number },
): number => {
  const n = needle.trim().toLowerCase();
  if (!n) return -1;
  const at = doc.slice(range.from, range.to).toLowerCase().indexOf(n);
  return at < 0 ? -1 : range.from + at;
};
